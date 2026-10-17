import pg from 'pg';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PostgresDatabase,postgresConnectionConfig} from '../packages/db/src/postgres';

export function quoteIdentifier(value:string){return '"'+value.replaceAll('"','""')+'"';}
export function dependencyOrder(tables:string[],dependencies:{table:string;parent:string}[]){
  const result:string[]=[],pending=new Set(tables);
  while(pending.size){
    const ready=[...pending].filter(table=>!dependencies.some(d=>d.table===table&&d.parent!==table&&pending.has(d.parent))).sort();
    if(!ready.length)throw new Error('Cyclic foreign keys require a reviewed migration strategy.');
    for(const table of ready){pending.delete(table);result.push(table);}
  }
  return result;
}
async function signature(client:pg.PoolClient,schema:string,table:string){
  const result=await client.query<{row:string}>(`SELECT to_jsonb(t)::text AS row FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)} t ORDER BY to_jsonb(t)::text`);
  const hash=createHash('sha256');for(const item of result.rows)hash.update(item.row+'\n');
  return {rows:result.rowCount??0,sha256:hash.digest('hex')};
}

/** Runs on the private source network only after a maintenance deployment has frozen writes.
 * The destination must be empty. It never deletes or alters source data.
 */
export async function copyPostgresDatabase(environment:NodeJS.ProcessEnv){
  const sourceUrl=environment.DATABASE_URL,targetUrl=environment.MIGRATION_TARGET_DATABASE_URL;
  const sourceSchema=environment.DATABASE_SCHEMA||'public',targetSchema=environment.MIGRATION_TARGET_SCHEMA||'multigame';
  if(environment.MAINTENANCE_MODE!=='1'||environment.MIGRATION_SOURCE_FROZEN!=='1')throw new Error('A confirmed maintenance deployment is required before copying.');
  if(!sourceUrl||!targetUrl||sourceUrl===targetUrl)throw new Error('Separate source and target database connections are required.');
  const source=new pg.Pool({...postgresConnectionConfig(sourceUrl,{schema:sourceSchema,sslCa:environment.DATABASE_SSL_CA}),max:1});
  const targetSettings={schema:targetSchema,sslCa:environment.MIGRATION_TARGET_SSL_CA};
  // The target schema is provisioned privately before this command; no public-schema changes.
  const targetDb=await PostgresDatabase.connect(targetUrl,targetSettings);
  try {await targetDb.migrate(await readFile(resolve('packages/db/migrations/postgres/0001_initial.sql'),'utf8'));}
  finally{await targetDb.close();}
  const target=new pg.Pool({...postgresConnectionConfig(targetUrl,targetSettings),max:1});
  let from:pg.PoolClient|undefined,to:pg.PoolClient|undefined;
  try{
    from=await source.connect();to=await target.connect();
    // Preserve timestamp microseconds and JSON numeric precision as database text.
    for(const oid of [1082,1114,1184,114,3802])from.setTypeParser(oid,value=>value);
    await from.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await to.query('BEGIN');
    await from.query("SET LOCAL timezone='UTC'");await to.query("SET LOCAL timezone='UTC'");
    const names=(await from.query<{name:string}>('SELECT tablename AS name FROM pg_tables WHERE schemaname=$1',[sourceSchema])).rows.map(r=>r.name);
    if(!names.includes('auth_accounts')||!names.includes('quizzes')||!names.includes('sessions'))throw new Error('Source is not a MULTIGAME database.');
    const dependencies=(await from.query<{table:string;parent:string}>(`SELECT c.relname AS "table",p.relname AS parent FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid JOIN pg_class p ON p.oid=f.confrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE f.contype='f' AND n.nspname=$1`,[sourceSchema])).rows;
    const order=dependencyOrder(names,dependencies);
    for(const table of order){
      const existing=await to.query(`SELECT count(*)::int AS count FROM ${quoteIdentifier(targetSchema)}.${quoteIdentifier(table)}`);
      if(table!=='_schema_migrations'&&existing.rows[0].count!==0)throw new Error('Destination is not empty; refusing to overwrite data.');
    }
    // Published-round triggers intentionally reject edits; disable them only on the
    // empty destination, in this transaction. Foreign keys and checks remain active.
    for(const table of order)await to.query(`ALTER TABLE ${quoteIdentifier(targetSchema)}.${quoteIdentifier(table)} DISABLE TRIGGER USER`);
    const report:{table:string;rows:number;sha256:string}[]=[];
    for(const table of order){
      const columns=(await from.query<{name:string;type:string}>(`SELECT column_name AS name,data_type AS type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`,[sourceSchema,table])).rows;
      const rows=(await from.query(`SELECT * FROM ${quoteIdentifier(sourceSchema)}.${quoteIdentifier(table)}`)).rows;
      const fields=columns.map(c=>quoteIdentifier(c.name)).join(',');
      const params=columns.map((_,i)=>'$'+(i+1)).join(',');
      const conflict=table==='_schema_migrations'?' ON CONFLICT (migration_id) DO UPDATE SET checksum=EXCLUDED.checksum,applied_at=EXCLUDED.applied_at':'';
      for(const row of rows)await to.query(`INSERT INTO ${quoteIdentifier(targetSchema)}.${quoteIdentifier(table)} (${fields}) VALUES (${params})${conflict}`,columns.map(c=>row[c.name]));
      const expected=await signature(from,sourceSchema,table),actual=await signature(to,targetSchema,table);
      if(expected.rows!==actual.rows||expected.sha256!==actual.sha256)throw new Error('Destination verification failed for table '+table);
      report.push({table,...actual});
    }
    for(const table of order)await to.query(`ALTER TABLE ${quoteIdentifier(targetSchema)}.${quoteIdentifier(table)} ENABLE TRIGGER USER`);
    // Data API roles have no schema access. RLS adds a second barrier if exposure changes.
    for(const table of order)await to.query(`ALTER TABLE ${quoteIdentifier(targetSchema)}.${quoteIdentifier(table)} ENABLE ROW LEVEL SECURITY`);
    await to.query(`REVOKE ALL ON SCHEMA ${quoteIdentifier(targetSchema)} FROM PUBLIC,anon,authenticated`);
    await to.query(`REVOKE ALL ON ALL TABLES IN SCHEMA ${quoteIdentifier(targetSchema)} FROM anon,authenticated`);
    await to.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${quoteIdentifier(targetSchema)} FROM PUBLIC,anon,authenticated`);
    for(const name of ['prevent_published_version_mutation','prevent_published_round_mutation'])await to.query(`ALTER FUNCTION ${quoteIdentifier(targetSchema)}.${quoteIdentifier(name)}() SET search_path TO ${quoteIdentifier(targetSchema)},pg_catalog`);
    await to.query('COMMIT');await from.query('COMMIT');
    process.stdout.write(JSON.stringify({event:'database_copy_verified',sourceSchema,targetSchema,tables:report.length,rows:report.reduce((n,r)=>n+r.rows,0),report})+'\n');
  }catch(error){await to?.query('ROLLBACK').catch(()=>{});await from?.query('ROLLBACK').catch(()=>{});throw error;}
  finally{from?.release();to?.release();await source.end();await target.end();}
}
