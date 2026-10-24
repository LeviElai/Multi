import test from 'node:test';
import assert from 'node:assert/strict';
import {compactTemporaryData} from '../../apps/game-service/src/cost-maintenance';
import type {Store,SqlStatement} from '../../packages/db/src/types';
test('Postgres cleanup uses JSONB predicates and returns JSONB for assignment',async()=>{
 let statements:SqlStatement[]=[];
 const store={db:{dialect:'postgres',batch:async(input:SqlStatement[])=>{statements=input;return [];}}} as unknown as Store;
 await compactTemporaryData(store);
 for(const statement of statements.slice(0,2)){assert.match(statement.sql,/jsonb_exists/);assert.doesNotMatch(statement.sql,/LIKE|::text/);}
});
