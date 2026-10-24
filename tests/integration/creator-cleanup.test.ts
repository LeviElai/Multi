import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeSqliteDatabase} from '../../packages/db/src/sqlite';
import {SqlStore} from '../../packages/db/src/store';
import {migrateRuntimeDatabase} from '../../apps/game-service/src/runtime';
import {handleApi} from '../../apps/game-service/src/api';
import {GameEngine} from '../../apps/game-service/src/engine';
import {avatarFor,type Avatar} from '../../packages/contracts/src/avatar';
import {getDemoQuiz,getEmptyRound} from '../../packages/game-modes/src/fixtures';
import {MODES} from '../../packages/contracts/src/index';
import {GenerationInput,decodeGeneration,queueGeneration,runGenerationWorker,generationStatus,quota} from '../../apps/game-service/src/ai';

async function payload<T>(response:Response):Promise<T>{return ((await response.json()) as {data:T}).data;}
async function fixture(t:test.TestContext){const db=new NodeSqliteDatabase(':memory:');await migrateRuntimeDatabase(db);const store=new SqlStore(db);const owner=await store.ensureUser(crypto.randomUUID(),'Character owner');t.after(()=>db.close());return{db,store,owner};}
test('account appearance is owner-scoped, survives reload, exports and joins atomically with the saved look',async t=>{
 const {store,owner}=await fixture(t),other=await store.ensureUser(crypto.randomUUID(),'Other');
 const call=(path:string,method='GET',body?:unknown,user:typeof owner|null=owner)=>handleApi(new Request(`https://test.example/api/v1/${path}`,{method,headers:{Origin:'https://test.example','Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:body?JSON.stringify(body):undefined}),{store,user,pinSecret:'test-account-look-secret'});
 assert.equal((await call('account/appearance','GET',undefined,null)).status,401);
 const avatar={...avatarFor(owner.id),hair:9,hat:8,skin:7};
 assert.equal((await call('account/appearance','PATCH',{avatar,ownerId:other.id})).status,422);
 assert.equal((await call('account/appearance','PATCH',{avatar})).status,200);
 assert.deepEqual((await payload<{avatar:Avatar}>(await call('account/appearance'))).avatar,avatar);
 assert.notDeepEqual((await payload<{avatar:Avatar}>(await call('account/appearance','GET',undefined,other))).avatar,avatar);
 assert.deepEqual((await payload<{avatar:Avatar}>(await call('account/export'))).avatar,avatar);
 const quiz=await store.createQuiz(owner.id,getDemoQuiz()),version=await store.publishQuiz(quiz.id,owner.id,quiz.revision);
 const engine=new GameEngine(store,undefined,{pinSecret:'test-account-look-secret'}),room=await engine.createSession(owner.id,version.id,crypto.randomUUID());
 const response=await call('sessions/join','POST',{pin:room.pin,nickname:'My saved character'});assert.equal(response.status,201);
 const joined=await payload<{participantId:string}>(response);const restored=new SqlStore(store.db);
 assert.deepEqual((await restored.getSession(room.sessionId)).members.find(m=>m.id===joined.participantId)?.avatar,avatar);
});
test('new manual rounds keep empty questions and reveals through durable saves',async t=>{
 const {store,owner}=await fixture(t);const input={...getDemoQuiz(),rounds:MODES.map(getEmptyRound)};
 const quiz=await store.createQuiz(owner.id,input),saved=await store.getQuiz(quiz.id,owner.id);
 assert.ok(saved.rounds.every(r=>r.question===''&&r.explanation===''));
 const think=saved.rounds.find(r=>r.mode==='rare_answers');if(think?.mode==='rare_answers')assert.deepEqual(think.secretConfig.answers,[]);
});
test('AI formatting cleanup accepts fenced Word data and rejects the removed mode',()=>{
 const input=GenerationInput.parse({topic:'football',count:1,modes:['word_puzzle']});
 const quiz=decodeGeneration({title:'Football',questions:[{mode:'word_puzzle',question:'A player who protects the net.',explanation:'The keeper defends the goal.',answerData:'```json\n{"word":" keeper "}\n```'}]},input);
 const word=quiz.rounds[0];if(word.mode==='word_puzzle')assert.equal(word.secretConfig.answer,'KEEPER');
 assert.throws(()=>GenerationInput.parse({topic:'football',count:1,modes:['rare_answers']}));
 assert.ok(quiz.rounds.every(r=>r.provenance==='needs_review'));
});
test('failed generation keeps a safe diagnostic and returns credits once',async t=>{
 const {store,db,owner}=await fixture(t);const job=await queueGeneration(store,owner.id,crypto.randomUUID(),GenerationInput.parse({topic:'football',count:5}));
 await runGenerationWorker(store,async()=>{throw new Error('Provider status 503');});
 assert.equal((await db.query<{error_code:string}>('SELECT error_code FROM creator_generations WHERE id=?',[job.id])).rows[0].error_code,'PROVIDER_UNAVAILABLE');
 assert.match((await generationStatus(store,owner.id,job.id)).message??'',/temporarily unavailable/);assert.equal((await quota(store,owner.id)).remaining,20);
});


test('AI cannot invent Size artwork or leave Count facts implicit',()=>{
 const input=GenerationInput.parse({topic:'Science',count:2,modes:['size_it_up','amountle']});
 const quiz=decodeGeneration({title:'Football',questions:[
 {mode:'size_it_up',question:'Resize a football goal.',explanation:'Unsupported model suggestion.',answerData:JSON.stringify({answer:2.44,referenceSize:1.75,asset:'goal',referenceAsset:'person',referenceLabel:'Person',targetLabel:'Goal',unit:'m'})},
 {mode:'amountle',question:'How many players in 7 matches?',explanation:'Assumes an unstated team size.',answerData:JSON.stringify({factId:'gold-number'})}
 ]},input);
 const size=quiz.rounds[0];if(size.mode!=='size_it_up')throw new Error('Size missing');assert.equal(size.publicConfig.asset,'car');assert.equal(size.secretConfig.targetSize,1.5);assert.doesNotMatch(size.question,/goal|1[.,]5/);
 const count=quiz.rounds[1];if(count.mode!=='amountle')throw new Error('Count missing');assert.equal(count.secretConfig.answer,79);assert.match(count.question,/atomic number of gold/);assert.doesNotMatch(count.question,/79/);
});


test('Guess uses a curated definition even when the model leaks or invents its clue',()=>{
 const input=GenerationInput.parse({topic:'football',count:1,modes:['word_puzzle']});
 const quiz=decodeGeneration({title:'Tactics',questions:[{mode:'word_puzzle',question:'Name the 5-letter tactic where teams press opponents after losing possession.',explanation:'The tactic is PRESS.',answerData:'{"word":"PRESS"}'}]},input);
 assert.match(quiz.rounds[0].question,/regain the ball/);assert.doesNotMatch(quiz.rounds[0].question,/\bpress\b/i);assert.equal(quiz.rounds[0].provenance,'needs_review');
});


test('a football Guess can never use an invented football definition of ORBIT',()=>{
 const input=GenerationInput.parse({topic:'football',count:1,modes:['word_puzzle']});
 const quiz=decodeGeneration({title:'Football',questions:[{mode:'word_puzzle',question:'A ball curving through the air.',explanation:'An invented definition.',answerData:'{"word":"ORBIT"}'}]},input);
 const r=quiz.rounds[0];if(r.mode!=='word_puzzle')throw new Error('Guess missing');assert.notEqual(r.secretConfig.answer,'ORBIT');assert.doesNotMatch(r.explanation??'',/invented|orbit/i);
});
