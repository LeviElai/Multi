import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import type { SqlDatabase, SqlResult, SqlStatement, SqlValue } from './types';

/** Real file-backed SQLite adapter for deterministic integration and local use. */
export class NodeSqliteDatabase implements SqlDatabase {
  readonly dialect='sqlite' as const;
  private readonly connection:DatabaseSync;
  constructor(path:string){
    this.connection=new DatabaseSync(path);
    this.connection.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  }
  private execute<T>(sql:string,params:SqlValue[]=[]):SqlResult<T>{
    const statement=this.connection.prepare(sql);
    if(statement.columns().length){
      const rows=statement.all(...params) as T[];
      // SELECT must not reuse changes() from an earlier write.
      const mutation=/^\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      const changes=mutation?Number((this.connection.prepare('SELECT changes() AS n').get() as {n:number}).n):0;
      return {rows,changes};
    }
    const result=statement.run(...params);
    return {rows:[],changes:Number(result.changes)};
  }
  async query<T=Record<string,unknown>>(sql:string,params:SqlValue[]=[]):Promise<SqlResult<T>>{return this.execute<T>(sql,params);}
  async batch(statements:SqlStatement[]):Promise<SqlResult[]>{
    this.connection.exec('BEGIN IMMEDIATE');
    try{
      const result=statements.map(s=>this.execute<Record<string,unknown>>(s.sql,s.params));
      this.connection.exec('COMMIT');return result;
    }catch(error){this.connection.exec('ROLLBACK');throw error;}
  }
  async migrate(sql:string,migrationId='0001_initial'):Promise<void>{
    this.connection.exec('BEGIN IMMEDIATE');
    try{
      this.connection.exec('CREATE TABLE IF NOT EXISTS _schema_migrations (migration_id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)');
      const checksum=createHash('sha256').update(sql).digest('hex');
      const applied=this.connection.prepare('SELECT checksum FROM _schema_migrations WHERE migration_id=?').get(migrationId) as {checksum:string}|undefined;
      if(applied&&applied.checksum!==checksum)throw new Error(`Applied migration ${migrationId} was modified. Add a forward migration instead.`);
      if(!applied){
        this.connection.exec(sql);
        this.connection.prepare('INSERT INTO _schema_migrations (migration_id,checksum,applied_at) VALUES (?,?,?)').run(migrationId,checksum,new Date().toISOString());
      }
      this.connection.exec('COMMIT');
    }
    catch(error){this.connection.exec('ROLLBACK');throw error;}
  }
  close(){this.connection.close();}
}
