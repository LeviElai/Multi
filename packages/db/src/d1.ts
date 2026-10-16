import type { SqlDatabase, SqlResult, SqlStatement, SqlValue } from './types';

/** D1 batch is one transaction. Every post-CAS write in SqlStore is nonce-guarded. */
export class D1DatabaseAdapter implements SqlDatabase {
  readonly dialect='sqlite' as const;
  constructor(private readonly binding:D1Database){}
  async query<T=Record<string,unknown>>(sql:string,params:SqlValue[]=[]):Promise<SqlResult<T>>{
    const result=await this.binding.prepare(sql).bind(...params).all<T>();
    if(!result.success) throw new Error(result.error || 'D1 query failed');
    return {rows:result.results ?? [],changes:result.meta.changes ?? 0};
  }
  async batch(statements:SqlStatement[]):Promise<SqlResult[]>{
    if(!statements.length) return [];
    const results=await this.binding.batch(statements.map(s=>this.binding.prepare(s.sql).bind(...(s.params??[]))));
    return results.map(r=>{if(!r.success) throw new Error(r.error || 'D1 transaction failed');return {rows:(r.results??[]) as Record<string,unknown>[],changes:r.meta.changes??0};});
  }
}
