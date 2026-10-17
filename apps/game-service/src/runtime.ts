import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SqlStore } from '../../../packages/db/src/store';
import { PostgresDatabase } from '../../../packages/db/src/postgres';
import { NodeSqliteDatabase } from '../../../packages/db/src/sqlite';
import type { SqlDatabase } from '../../../packages/db/src/types';

export type RuntimeDatabase=SqlDatabase & {migrate(sql:string):Promise<void>|void;close():Promise<void>|void};
export async function createRuntimeDatabase(environment:NodeJS.ProcessEnv=process.env):Promise<RuntimeDatabase> {
  if(environment.DATABASE_URL) return PostgresDatabase.connect(environment.DATABASE_URL,{schema:environment.DATABASE_SCHEMA,sslCa:environment.DATABASE_SSL_CA});
  if(environment.NODE_ENV==='production')throw new Error('DATABASE_URL is required in production. SQLite is development/test only.');
  return new NodeSqliteDatabase(environment.SQLITE_PATH??'./multigame-dev.sqlite');
}
export async function migrateRuntimeDatabase(db:RuntimeDatabase) {
  const migration=db.dialect==='postgres'?'packages/db/migrations/postgres/0001_initial.sql':'packages/db/migrations/sqlite/0001_initial.sql';
  await db.migrate(await readFile(resolve(process.cwd(),migration),'utf8'));
}
export async function createRuntime(environment:NodeJS.ProcessEnv=process.env) {
  const db=await createRuntimeDatabase(environment);
  try {
    if(environment.AUTO_MIGRATE==='1'||environment.NODE_ENV!=='production')await migrateRuntimeDatabase(db);
    return {db,store:new SqlStore(db)};
  } catch(error) {await db.close();throw error;}
}
