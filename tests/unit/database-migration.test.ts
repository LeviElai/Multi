import test from 'node:test';
import assert from 'node:assert/strict';
import {postgresConnectionConfig} from '../../packages/db/src/postgres';
import {dependencyOrder,quoteIdentifier} from '../../scripts/copy-postgres';

test('private schema connection rejects SQL/startup-option injection',()=>{
 for(const schema of ['public,auth','multigame -c role=postgres','multigame;DROP TABLE users','"public"','']){
  if(schema)assert.throws(()=>postgresConnectionConfig('postgres://app:password@localhost/db',{schema}));
 }
 const config=postgresConnectionConfig('postgres://app:password@localhost/db',{schema:'multigame'});
 assert.equal(config.options,'-c search_path=multigame');assert.equal(config.max,4);
});

test('rolling deployments fit the observed 15-slot Supabase session budget',()=>{
 const pool=postgresConnectionConfig('postgres://app:password@localhost/db').max!;
 assert.ok(pool+10<15,'the new process fits alongside the previous ten-slot process');
 assert.ok(pool*2<15,'two current processes leave operational connection headroom');
});
test('custom CA enforces certificate verification even when URL asks for weaker TLS',()=>{
 const config=postgresConnectionConfig('postgres://app:password@localhost/db?sslmode=no-verify',{sslCa:'certificate'});
 assert.equal(new URL(config.connectionString!).searchParams.has('sslmode'),false);
 assert.deepEqual(config.ssl,{ca:'certificate',rejectUnauthorized:true});
});
test('database copy orders foreign keys across multiple levels and preserves isolated tables',()=>{
 const order=dependencyOrder(['scores','users','quizzes','versions','receipts'],[{table:'quizzes',parent:'users'},{table:'versions',parent:'quizzes'},{table:'scores',parent:'versions'}]);
 for(const [parent,child]of [['users','quizzes'],['quizzes','versions'],['versions','scores']])assert.ok(order.indexOf(parent)<order.indexOf(child));
 assert.equal(new Set(order).size,5);assert.ok(order.includes('receipts'));
 assert.throws(()=>dependencyOrder(['a','b'],[{table:'a',parent:'b'},{table:'b',parent:'a'}]),/Cyclic/);
 assert.deepEqual(dependencyOrder(['self'],[{table:'self',parent:'self'}]),['self']);
});
test('migration identifiers remain quoted even with unusual database names',()=>{
 assert.equal(quoteIdentifier('safe'),'"safe"');assert.equal(quoteIdentifier('a"; SELECT 1; --'),'"a""; SELECT 1; --"');
});
