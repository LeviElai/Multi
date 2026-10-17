import test from 'node:test';
import assert from 'node:assert/strict';
import {NodeSqliteDatabase} from '../../packages/db/src/sqlite';
import {SqlStore} from '../../packages/db/src/store';
import {migrateRuntimeDatabase} from '../../apps/game-service/src/runtime';
import {handleApi} from '../../apps/game-service/src/api';
import {getDemoQuiz} from '../../packages/game-modes/src/fixtures';
import {questionSeed,roundFromAnswer} from '../../packages/game-modes/src/question';
import {scoreFermi} from '../../packages/game-modes/src/fermi';
import {publicQuestionProjection} from '../../packages/game-modes/src/index';

test('question semantics survive database save, fresh repository read and immutable publication',async t=>{
 const db=new NodeSqliteDatabase(':memory:');t.after(()=>db.close());await migrateRuntimeDatabase(db);const store=new SqlStore(db),owner=await store.ensureUser(crypto.randomUUID(),'Persistence QA');
 const r=roundFromAnswer({type:'single',kind:'integer',text:'What is two minus five?',answer:'-3',unit:'',exact:true,alternatives:[],distractors:[]},'fermi',questionSeed('single'));
 const quiz=await store.createQuiz(owner.id,{...getDemoQuiz(),rounds:[r]});const reopened=await new SqlStore(db).getQuiz(quiz.id,owner.id);
 assert.equal(reopened.rounds[0].questionType,'single');assert.equal(reopened.rounds[0].answerStructure,'integer');assert.equal(reopened.rounds[0].scoringPolicy,'exact');assert.equal(reopened.rounds[0].answerProvided,true);
 const version=await store.publishQuiz(quiz.id,owner.id,quiz.revision),published=(await new SqlStore(db).getVersion(version.id)).rounds[0];assert.equal(published.scoringPolicy,'exact');assert.equal(published.mode,'fermi');if(published.mode!=='fermi')return;assert.equal(scoreFermi(published,-2),0);assert.equal(scoreFermi(published,-3),1000);
 const view=JSON.stringify(publicQuestionProjection(published));assert.ok(!view.includes('__question'));assert.ok(!view.includes('answerProvided'));assert.ok(!view.includes('secretConfig'));
});
test('an unanswered round remains blocked after save/reopen',async t=>{
 const db=new NodeSqliteDatabase(':memory:');t.after(()=>db.close());await migrateRuntimeDatabase(db);const store=new SqlStore(db),owner=await store.ensureUser(crypto.randomUUID(),'Draft QA');
 const seed=questionSeed('boolean');seed.question='A statement with no answer selected.';if(seed.mode==='drop')seed.secretConfig.answer=false;const quiz=await store.createQuiz(owner.id,{...getDemoQuiz(),rounds:[seed]});
 assert.equal((await store.getQuiz(quiz.id,owner.id)).rounds[0].answerProvided,false);
 const request=new Request(`https://qa.example/api/v1/quizzes/${quiz.id}/publish`,{method:'POST',headers:{Origin:'https://qa.example','Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({expectedRevision:quiz.revision})});
 assert.equal((await handleApi(request,{store,user:owner})).status,422);assert.equal((await store.getQuiz(quiz.id,owner.id)).status,'draft');
});
