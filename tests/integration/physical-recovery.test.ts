import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeSqliteDatabase} from '../../packages/db/src/sqlite';
import {SqlStore} from '../../packages/db/src/store';
import {migrateRuntimeDatabase} from '../../apps/game-service/src/runtime';
import {GameEngine} from '../../apps/game-service/src/engine';
import {compactTemporaryData} from '../../apps/game-service/src/cost-maintenance';
import {getDemoQuiz,getDefaultRound} from '../../packages/game-modes/src/index';
import type {Principal,HostAction} from '../../packages/contracts/src/index';
test('original handwriting stays private, survives scoring/reload, then expires without changing points',async t=>{
 const db=new NodeSqliteDatabase(':memory:');t.after(()=>db.close());await migrateRuntimeDatabase(db);let now=Date.now();const store=new SqlStore(db,()=>new Date(now)),host=await store.ensureUser(crypto.randomUUID(),'Ink QA');
 const quiz=getDemoQuiz();quiz.rounds=[getDefaultRound('draw')];const draft=await store.createQuiz(host.id,quiz),version=await store.publishQuiz(draft.id,host.id,draft.revision),engine=new GameEngine(store,()=>now,{pinSecret:'test-ink-recovery-only-32characters'}),room=await engine.createSession(host.id,version.id,crypto.randomUUID());
 const joined=await engine.join(room.pin,'Writer'),other=await engine.join(room.pin,'Viewer');const player:Principal={role:'player',id:joined.participantId,sessionId:room.sessionId},viewer:Principal={role:'player',id:other.participantId,sessionId:room.sessionId},owner:Principal={role:'host',id:host.id};
 async function action(action:HostAction['action']){const data=await store.getSession(room.sessionId);await engine.hostAction(host.id,room.sessionId,{action,expectedStateVersion:data.session.stateVersion},crypto.randomUUID());}
 await action('START');now+=5001;await engine.reconcile(room.sessionId);const ink=[[{x:10,y:10},{x:22,y:180},{x:60,y:180}]],input={roundId:version.rounds[0].id,revision:1,clientMutationId:crypto.randomUUID(),payload:{value:6,ink,locked:true}};
 const ack=await engine.submit(player,room.sessionId,input);assert.deepEqual(await engine.submit(player,room.sessionId,input),ack);
 assert.deepEqual((await engine.snapshot(player,room.sessionId)).ownSubmission?.payload.ink,ink);for(const principal of [viewer,owner])assert.equal(JSON.stringify(await engine.snapshot(principal,room.sessionId)).includes('"ink"'),false);
 await action('LOCK');await engine.reconcile(room.sessionId);await action('REVEAL');const before=await engine.snapshot(player,room.sessionId),award=before.roundAwards!.find(a=>a.participantId===player.id)!;assert.equal(award.points,1000);assert.deepEqual(award.detail.ink,ink);
 const restored=new GameEngine(new SqlStore(db),()=>now,{pinSecret:'test-ink-recovery-only-32characters'});assert.deepEqual((await restored.snapshot(owner,room.sessionId)).roundAwards?.find(a=>a.participantId===player.id)?.detail.ink,ink);
 assert.equal((await restored.snapshot(viewer,room.sessionId)).roundAwards?.find(a=>a.participantId===player.id)?.detail.ink,undefined);
 await compactTemporaryData(store,new Date(now+48*3600000));const after=await restored.snapshot(player,room.sessionId),expired=after.roundAwards!.find(a=>a.participantId===player.id)!;assert.equal(expired.points,1000);assert.equal(expired.detail.ink,undefined);assert.equal(after.ownSubmission?.payload.ink,undefined);assert.equal(after.ownSubmission?.payload.value,6);
});
