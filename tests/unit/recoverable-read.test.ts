import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverableRead} from '../../apps/web/lib/recoverable-read';

test('cold-start reads recover within a bounded budget without changing credentials',async t=>{
 let calls=0,retries=0;
 t.mock.method(globalThis,'fetch',async(_url:RequestInfo|URL,options:RequestInit)=>{
  assert.equal(options.credentials,'same-origin');
  assert.equal(options.method,undefined);
  if(++calls<3)return Response.json({error:{message:'Waking',code:'SERVICE_UNAVAILABLE'}},{status:503});
  return Response.json({data:{id:'persisted-user'}});
 });
 assert.deepEqual(await recoverableRead('/api/auth/me',undefined,()=>retries++),{id:'persisted-user'});
 assert.equal(calls,3);assert.equal(retries,2);
});
test('unauthorized reads fail immediately; cancellation stops cold-start retry',async t=>{
 let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({error:{message:'Expired',code:'SESSION_EXPIRED'}},{status:401});});
 await assert.rejects(recoverableRead('/api/auth/me'),/Expired/);assert.equal(calls,1);
 const controller=new AbortController();controller.abort();
 await assert.rejects(recoverableRead('/daily',controller.signal));assert.equal(calls,1);
});
test('a fourth cold-start read recovers without asking the player to reconnect',async t=>{
 let calls=0;
 t.mock.method(globalThis,'fetch',async()=>++calls<4
  ?Response.json({error:{message:'Waking',code:'SERVICE_UNAVAILABLE'}},{status:503})
  :Response.json({data:{day:'2026-11-03'}}));
 assert.deepEqual(await recoverableRead('/daily'),{day:'2026-11-03'});
 assert.equal(calls,4);
});
