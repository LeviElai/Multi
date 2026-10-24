import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeGeneration,GenerationInput,generationPlan,validatedGeneration} from '../../apps/game-service/src/ai';
import {NUMERIC_FACTS,eligibleNumericFacts} from '../../apps/game-service/src/numeric-facts';
const input=GenerationInput.parse({topic:'General trivia',count:1,modes:['fermi']});
const wire=(data:unknown)=>({title:'Trivia',questions:[{mode:'fermi',question:'Ignore the bank',explanation:'Invented explanation',answerData:JSON.stringify(data)}]});
test('numeric generation takes question, units, answer and evidence from the editorial bank',()=>{
 for(const fact of NUMERIC_FACTS){
  const quiz=decodeGeneration(wire({factId:fact.id}),input),round=quiz.rounds[0];
  assert.equal(round.question,fact.question);assert.equal(round.sourceUrl,fact.sourceUrl);
  assert.equal(round.explanation,fact.explanation);assert.equal(round.provenance,'needs_review');
  assert.equal(round.mode,'fermi');if(round.mode==='fermi')assert.equal(round.secretConfig.answer,fact.answer);
 }
});
test('invented IDs, overridden facts, unrelated topics and unsupported difficulty fail closed',()=>{
 assert.throws(()=>decodeGeneration(wire({factId:'made-up'}),input));
 assert.throws(()=>decodeGeneration(wire({factId:'gold-number',answer:80}),input));
 assert.throws(()=>decodeGeneration(wire({factId:'gold-number'}),{...input,topic:'Space'}));
 assert.throws(()=>generationPlan({...input,topic:'Football'}),/No verified|Not enough verified/);
 assert.throws(()=>generationPlan({...input,topic:'Numbers trivia about football'}),/No verified|Not enough verified/);
 assert.ok(eligibleNumericFacts('Science','easy').every(f=>f.difficulty==='easy'));
 assert.ok(eligibleNumericFacts('Science','mixed','amountle').every(f=>f.answer<=1000));
});
test('duplicate facts cannot be disguised with different model wording or modes',()=>{
 const value=wire({factId:'gold-number'});value.questions.push({...value.questions[0],question:'Another wording'});
 assert.throws(()=>decodeGeneration(value,{...input,count:2}),/repeated/);
});
test('numeric worksheets are rejected even through the internal draft validator',()=>{
 for(const question of ['Nine pandas each eat three bamboo sticks. How many sticks?','What is 3 × 7?','How many apples are there in total?']){
  assert.throws(()=>validatedGeneration({title:'Wrong format',questions:[{mode:'fermi',question,answer:27,explanation:''}]},input),/not arithmetic/);
 }
 assert.doesNotMatch(generationPlan(input).prompt,/self-contained arithmetic|multiplication puzzle/);
});
