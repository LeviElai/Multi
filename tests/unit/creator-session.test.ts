import test from 'node:test';
import assert from 'node:assert/strict';
import {creatorDestination,signInCreator} from '../../apps/web/lib/creator-session';
import {api} from '../../apps/web/lib/api';
test('creator returns stay local and cannot loop into authentication',()=>{
 for(const target of ['//evil.test','/\\evil.test','/login?return_to=/login','/api/auth/logout','/\n/evil.test',null])assert.equal(creatorDestination(target),'/create');
 assert.equal(creatorDestination('/host/room-1'),'/host/room-1');
 assert.equal(creatorDestination('/quiz/id?tab=questions'),'/quiz/id?tab=questions');
});
test('sign-in checks the retained session and rejects missing or mismatched identity',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 for(const identity of [null,{id:'someone-else'},{id:'host'}]){
  const paths:string[]=[];
  globalThis.fetch=async path=>{paths.push(String(path));return Response.json({data:String(path).endsWith('/me')?identity:{id:'host'}});};
  const result=signInCreator(false,{email:'test@example.test',password:'fixture-only',displayName:''});
  if(identity?.id==='host')assert.deepEqual(await result,identity);else await assert.rejects(result,/did not persist/);
  assert.deepEqual(paths,['/api/auth/login','/api/auth/me']);
 }
});
test('malformed successful responses cannot masquerade as signed-out identities',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 for(const body of ['<html>Backend unavailable</html>','null','{}']){
  globalThis.fetch=async()=>new Response(body,{status:200});
  await assert.rejects(api('/me'),/incomplete response/);
 }
 globalThis.fetch=async()=>Response.json({data:null});assert.equal(await api('/me'),null);
});

test('service readiness retries transient GET failures but never credentials',async t=>{
 const {waitForService}=await import('../../apps/web/lib/service-ready');
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);let calls=0;
 globalThis.fetch=async path=>{assert.equal(path,'/api/v1/features');return ++calls===1?Response.json({error:{message:'Starting',code:'SERVICE_UNAVAILABLE'}},{status:503}):Response.json({data:{auth:'credentials'}});};
 assert.equal((await waitForService()).auth,'credentials');assert.equal(calls,2);
 const controller=new AbortController();controller.abort();await assert.rejects(waitForService(controller.signal));assert.equal(calls,2);
});
