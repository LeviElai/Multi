import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeSqliteDatabase} from '../../packages/db/src/sqlite';
import {SqlStore} from '../../packages/db/src/store';
import {migrateRuntimeDatabase} from '../../apps/game-service/src/runtime';
import {GenerationInput,queueGeneration,quota,runGenerationWorker,generationStatus,validatedGeneration} from '../../apps/game-service/src/ai';
import {rewardTicket,claimReward} from '../../apps/game-service/src/ads';
import {browseCommunity,communityQuiz,shareCommunity,copyCommunity} from '../../apps/game-service/src/community';
import {handleApi} from '../../apps/game-service/src/api';
import {getDemoQuiz} from '../../packages/game-modes/src/index';

async function fixture(t:test.TestContext){const db=new NodeSqliteDatabase(':memory:');await migrateRuntimeDatabase(db);const store=new SqlStore(db);const owner=await store.ensureUser(crypto.randomUUID(),'Quiz maker');t.after(()=>db.close());return{db,store,owner};}
const request=(count=5)=>GenerationInput.parse({topic:'Space puzzles',count,modes:['fermi']});
const mockQuiz=(count:number)=>{const quiz=getDemoQuiz();return{...quiz,rounds:Array.from({length:count},()=>({...quiz.rounds[0],id:crypto.randomUUID(),provenance:'needs_review' as const}))};};
test('concurrent reservations never exceed 20; duplicate keys do not reserve twice; months are independent',async t=>{
 const{store,owner}=await fixture(t),key=crypto.randomUUID();
 await Promise.all([queueGeneration(store,owner.id,key,request()),queueGeneration(store,owner.id,key,request())]);
 assert.equal((await quota(store,owner.id)).reserved,5);
 await assert.rejects(queueGeneration(store,owner.id,key,request(6)),/another topic/);
 const result=await Promise.allSettled(Array.from({length:10},()=>queueGeneration(store,owner.id,crypto.randomUUID(),request())));
 assert.equal(result.filter(r=>r.status==='fulfilled').length,3);assert.equal((await quota(store,owner.id)).remaining,0);
 assert.equal((await quota(store,owner.id,new Date('2030-01-01T00:00:00Z'))).remaining,20);
});
test('generation creates one editable private draft, consumes question count once and survives worker replay',async t=>{
 const{store,owner}=await fixture(t);const job=await queueGeneration(store,owner.id,crypto.randomUUID(),request());let calls=0;
 await Promise.all([runGenerationWorker(store,async()=>{calls++;return mockQuiz(5);}),runGenerationWorker(store,async()=>{calls++;return mockQuiz(5);})]);
 assert.equal(calls,1);const done=await generationStatus(store,owner.id,job.id);assert.equal(done.status,'done');assert.ok(done.quizId);
 const quiz=await store.getQuiz(done.quizId!,owner.id);assert.equal(quiz.status,'draft');assert.equal(quiz.rounds.length,5);assert.ok(quiz.rounds.every(r=>r.provenance==='needs_review'));
 await runGenerationWorker(store,async()=>{throw new Error('must not call');});assert.equal((await quota(store,owner.id)).used,5);assert.equal((await quota(store,owner.id)).reserved,0);
 assert.equal((await browseCommunity(store,'','All',0)).items.some(q=>q.id===quiz.id),false);
 await assert.rejects(generationStatus(store,crypto.randomUUID(),job.id),/unavailable/);
});
test('provider failure and expired jobs refund once, without retrying the provider',async t=>{
 const{store,db,owner}=await fixture(t);const job=await queueGeneration(store,owner.id,crypto.randomUUID(),request(10));
 await runGenerationWorker(store,async()=>{throw new Error('blocked or invalid output');});assert.equal((await generationStatus(store,owner.id,job.id)).status,'failed');assert.equal((await quota(store,owner.id)).remaining,20);
 const stale=await queueGeneration(store,owner.id,crypto.randomUUID(),request(10));await db.query("UPDATE creator_generations SET status='processing',updated_at=? WHERE id=?",['2000-01-01T00:00:00.000Z',stale.id]);
 await runGenerationWorker(store,async()=>{throw new Error('must not call');});await runGenerationWorker(store,async()=>{throw new Error('must not call');});assert.equal((await quota(store,owner.id)).remaining,20);
});
test('unreviewed or malformed AI answers cannot enter a hosted version',async t=>{
 const input=request(1);const quiz=validatedGeneration({title:'Space',questions:[{mode:'fermi',question:'A light minute is roughly how many kilometres?',answer:18000000,unit:'km',explanation:'60 × 300,000 km.'}]},input);
 assert.equal(quiz.rounds[0].provenance,'needs_review');assert.throws(()=>validatedGeneration({title:'Bad',questions:[]},input));assert.throws(()=>validatedGeneration({title:'Bad',questions:[{mode:'word_puzzle',question:'?',word:'ORBIT',explanation:''}]},input),/Unrequested/);
 const{store,owner}=await fixture(t);const draft=await store.createQuiz(owner.id,quiz);const response=await handleApi(new Request(`https://test.example/api/v1/quizzes/${draft.id}/publish`,{method:'POST',headers:{Origin:'https://test.example','Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({expectedRevision:1})}),{store,user:owner});assert.equal(response.status,422);
});
test('reward tickets fail closed, expire, belong to an owner and grant +5 exactly once with a three/day cap',async t=>{
 const{store,owner}=await fixture(t),config={unitPath:'/123456/multigame_rewarded',approved:true,consentReady:true};
 await assert.rejects(rewardTicket(store,owner.id,crypto.randomUUID()),/not available/);
 const ticket=await rewardTicket(store,owner.id,crypto.randomUUID(),config);
 await assert.rejects(claimReward(store,crypto.randomUUID(),ticket.id,config));
 await Promise.all([claimReward(store,owner.id,ticket.id,config),claimReward(store,owner.id,ticket.id,config)]);assert.equal((await quota(store,owner.id)).allowance,25);
 const expired=await rewardTicket(store,owner.id,crypto.randomUUID(),config,new Date(Date.now()-700000));await assert.rejects(claimReward(store,owner.id,expired.id,config),/expired/);
 const attempts=await Promise.allSettled(Array.from({length:5},()=>rewardTicket(store,owner.id,crypto.randomUUID(),config)));assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
});
test('community publishing is explicit, immutable, removable and owner-scoped; copies do not mutate the original',async t=>{
 const{store,db,owner}=await fixture(t);const draft=await store.createQuiz(owner.id,getDemoQuiz());assert.equal((await browseCommunity(store,'','All',0)).items.length,3);
 await assert.rejects(communityQuiz(store,draft.id),/unavailable/);await assert.rejects(shareCommunity(store,crypto.randomUUID(),draft.id,crypto.randomUUID(),{reviewed:true,category:'General',expectedRevision:1}));
 await shareCommunity(store,owner.id,draft.id,crypto.randomUUID(),{reviewed:true,category:'Science',expectedRevision:1});const shared=await communityQuiz(store,draft.id);assert.equal(shared.title,draft.title);
 const current=await store.getQuiz(draft.id,owner.id);await store.saveQuiz(draft.id,owner.id,current.revision,{...draft,title:'Private next revision'});assert.equal((await communityQuiz(store,draft.id)).title,draft.title);
 const other=await store.ensureUser(crypto.randomUUID(),'Another host');const copy=await copyCommunity(store,other.id,draft.id,crypto.randomUUID());assert.notEqual(copy.id,draft.id);assert.equal(copy.ownerId,other.id);assert.notEqual(copy.rounds[0].id,draft.rounds[0].id);
 const cards=await browseCommunity(store,'five','Science',0);assert.ok(cards.items.some(q=>q.id===draft.id));assert.ok(cards.items.every(q=>!('rounds'in q)));
 await db.query('UPDATE community_quizzes SET visible=0 WHERE quiz_id=?',[draft.id]);await assert.rejects(communityQuiz(store,draft.id));assert.equal((await store.getQuiz(copy.id,other.id)).title,draft.title);
});
