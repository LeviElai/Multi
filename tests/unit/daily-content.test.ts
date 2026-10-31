import test from 'node:test';
import assert from 'node:assert/strict';
import {DAILY_POOL,selectDaily} from '../../apps/game-service/src/daily-pool';
test('daily fallback is deterministic, balanced, sourced and has unique answer choices',()=>{
 assert.ok(DAILY_POOL.length>=70);
 for(let i=0;i<31;i++){
  const day=new Date(Date.UTC(2026,10,i+1)).toISOString().slice(0,10),questions=selectDaily(day);
  assert.deepEqual(questions,selectDaily(day));assert.equal(questions.length,10);
  assert.equal(questions.filter(q=>q.difficulty==='easy').length,3);assert.equal(questions.filter(q=>q.difficulty==='medium').length,5);assert.equal(questions.filter(q=>q.difficulty==='challenging').length,2);
  assert.ok(new Set(questions.map(q=>q.category)).size>=4);
  assert.ok(questions.every(q=>new Set(q.options).size===4&&q.sourceUrl.startsWith('https://')));
 }
 // Five consecutive releases avoid the previous four full sets while retaining
 // the exact difficulty mix and a stable order for everyone.
 const history:ReturnType<typeof selectDaily>[]=[];
 for(let i=1;i<=5;i++){
  const recent=new Set(history.flatMap(set=>set.map(q=>q.id)));
  const next=selectDaily(`2026-11-0${i}`,recent);
  assert.equal(next.filter(q=>recent.has(q.id)).length,0);
  history.push(next);
 }
 assert.equal(new Set(history.flatMap(set=>set.map(q=>q.id))).size,50);
});
