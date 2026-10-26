import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreSession} from '../../apps/web/lib/session-restoration';
test('restoration distinguishes transient failure, expired identity and valid returning sessions',async t=>{
 let calls=0;let status=503;let data:unknown=null;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json(status===200?{data}:{error:{code:'UNAVAILABLE',message:'Unavailable'}},{status});});
 const [a,b]=await Promise.all([restoreSession(),restoreSession()]);
 assert.equal(calls,1);assert.equal(a.status,'recoverable_failure');assert.deepEqual(a,b);
 status=200;data={id:'returning-user',displayName:'Player'};
 assert.equal((await restoreSession()).status,'authenticated');
 status=401;assert.equal((await restoreSession()).status,'expired');
 status=200;data=null;assert.equal((await restoreSession()).status,'anonymous');
});
