import test from 'node:test';
import assert from 'node:assert/strict';
import {PourQueue,pourRepresentation} from '../../apps/web/lib/pour-state';

test('every allowed count is represented exactly with at most 128 visible pieces',()=>{
 for(let count=0;count<=10000;count++){
  const v=pourRepresentation(count);
  assert.ok(v.pieces<=128);
  assert.ok(Math.abs((Math.max(0,v.pieces-1)+v.finalFraction)*v.unit-count)<1e-8);
 }
});
test('queued input is not visible before acknowledgment; rapid input coalesces without loss',async()=>{
 let accept!:(n:number)=>void;const sent:number[]=[];
 const queue=new PourQueue(0,count=>{sent.push(count);return new Promise(resolve=>{accept=resolve})},()=>{});
 queue.add(1,100);queue.add(1,100);queue.add(3,100);
 assert.equal(queue.accepted,0);assert.deepEqual(sent,[1]);
 accept(1);await Promise.resolve();assert.equal(queue.accepted,1);assert.deepEqual(sent,[1,5]);
 accept(5);await Promise.resolve();assert.equal(queue.accepted,5);assert.equal(queue.pending,false);
});
test('deadline freezes unsent input but preserves a server acceptance arriving later',async()=>{
 let accept!:(n:number)=>void;const sent:number[]=[];
 const queue=new PourQueue(7,count=>{sent.push(count);return new Promise(resolve=>{accept=resolve})},()=>{});
 queue.add(1,100);queue.add(5,100);queue.enabled=false;queue.add(1,100);
 accept(8);await Promise.resolve();assert.equal(queue.accepted,8);assert.deepEqual(sent,[8]);
 await queue.flush();assert.equal(queue.accepted,8);assert.deepEqual(sent,[8]);
});
test('a rejected pour does not change displayed mass; reconnect reconciles accepted count',async()=>{
 const queue=new PourQueue(4,async()=>{throw new Error('ANSWER_LATE')},()=>{});
 queue.add(2,100);await Promise.resolve();assert.equal(queue.accepted,4);assert.equal(queue.failed,true);
 queue.reconcile(5);assert.equal(queue.accepted,5);queue.reconcile(3);assert.equal(queue.accepted,5);
});

test('a new zero-target round sends its initial zero exactly once without requiring a pour',async()=>{
 const sent:number[]=[];
 const queue=new PourQueue(0,async count=>{sent.push(count);return count},()=>{},false);
 await queue.flush();await queue.flush();assert.deepEqual(sent,[0]);assert.equal(queue.accepted,0);
});

test('hold pouring is elapsed-time based and catches delayed frames without changing tap size',async()=>{
 const {holdPourTotal}=await import('../../apps/web/lib/pour-state');
 assert.equal(holdPourTotal(0),1);assert.equal(holdPourTotal(299),1);
 assert.equal(holdPourTotal(300),2);assert.equal(holdPourTotal(2500),24);
 assert.equal(holdPourTotal(299,100),1);assert.equal(holdPourTotal(500,100),301);
});
