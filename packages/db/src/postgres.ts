import pg from 'pg';
import { createHash } from 'node:crypto';
import type { SqlDatabase, SqlResult, SqlStatement, SqlValue } from './types';

/** Replace parameter markers without altering quoted SQL strings/identifiers. */
export function postgresPlaceholders(sql:string):string{
  let result='',index=0,quote:string|null=null,lineComment=false,blockComment=false;
  for(let i=0;i<sql.length;i++){
    const c=sql[i],next=sql[i+1];
    if(lineComment){result+=c;if(c==='\n')lineComment=false;continue;}
    if(blockComment){result+=c;if(c==='*'&&next==='/'){result+=next;i++;blockComment=false;}continue;}
    if(quote){result+=c;if(c===quote){if(next===quote){result+=next;i++;}else quote=null;}continue;}
    if(c==='-'&&next==='-'){result+=c+next;i++;lineComment=true;continue;}
    if(c==='/'&&next==='*'){result+=c+next;i++;blockComment=true;continue;}
    if(c==="'"||c==='"'){quote=c;result+=c;continue;}
    result+=c==='?'?`$${++index}`:c;
  }
  return result;
}
function normalizeRow(row:Record<string,unknown>){return Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value instanceof Date?value.toISOString():value!==null&&typeof value==='object'?JSON.stringify(value):value]));}
export class PostgresDatabase implements SqlDatabase {
  readonly dialect='postgres' as const;
  constructor(private readonly pool:pg.Pool){}
  static async connect(connectionString:string,settings:{schema?:string;sslCa?:string}={}):Promise<PostgresDatabase>{
    // TLS follows the connection string/PG environment. Never disable certificate
    // verification globally; managed providers supply their own trusted CA policy.
    const pool=new pg.Pool(postgresConnectionConfig(connectionString,settings));
    await pool.query('SELECT 1');return new PostgresDatabase(pool);
  }
  async query<T=Record<string,unknown>>(sql:string,params:SqlValue[]=[]):Promise<SqlResult<T>>{
    const result=await this.pool.query(postgresPlaceholders(sql),params);
    return {rows:result.rows.map(normalizeRow) as T[],changes:result.command==='SELECT'?0:result.rowCount??0};
  }
  async batch(statements:SqlStatement[]):Promise<SqlResult[]>{
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const results:SqlResult[]=[];
      for(const statement of statements){const result=await client.query(postgresPlaceholders(statement.sql),statement.params??[]);results.push({rows:result.rows.map(normalizeRow),changes:result.command==='SELECT'?0:result.rowCount??0});}
      await client.query('COMMIT');return results;
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }
  async migrate(sql:string,migrationId='0001_initial'):Promise<void>{
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(586471239)');
      await client.query('CREATE TABLE IF NOT EXISTS _schema_migrations (migration_id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL)');
      const checksum=createHash('sha256').update(sql).digest('hex');
      const applied=(await client.query<{checksum:string}>('SELECT checksum FROM _schema_migrations WHERE migration_id=$1',[migrationId])).rows[0];
      if(applied&&applied.checksum!==checksum)throw new Error(`Applied migration ${migrationId} was modified. Add a forward migration instead.`);
      if(!applied){
        await client.query(sql);
        await client.query('INSERT INTO _schema_migrations (migration_id,checksum,applied_at) VALUES ($1,$2,$3)',[migrationId,checksum,new Date().toISOString()]);
      }
      await client.query('COMMIT');
    }
    catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }
  async close(){await this.pool.end();}
}

/** Private application schemas keep Supabase's browser Data API outside the game store. */
export function postgresConnectionConfig(connectionString:string,settings:{schema?:string;sslCa?:string}={}):pg.PoolConfig{
  if(settings.schema&&!/^[a-z][a-z0-9_]{0,62}$/.test(settings.schema))throw new Error('Invalid DATABASE_SCHEMA.');
  const url=new URL(connectionString);
  if(settings.sslCa)for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
  return {connectionString:url.toString(),max:10,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,
    ...(settings.schema?{options:`-c search_path=${settings.schema}`} : {}),
    ...(settings.sslCa?{ssl:{ca:settings.sslCa,rejectUnauthorized:true}}:{})};
}
