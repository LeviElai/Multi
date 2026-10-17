import test from 'node:test';
import assert from 'node:assert/strict';
import {MODES,RoundSchema,type Round} from '../../packages/contracts/src/index';
import {getArcadeQuiz,getDefaultRound} from '../../packages/game-modes/src/fixtures';
import {publicQuestionProjection,sanitizeAndValidateSubmission,validateAuthorConfig,validateQuiz} from '../../packages/game-modes/src/index';
import {scoreArcade,isArcade,validateArcade} from '../../packages/game-modes/src/arcade';
import {recommend,roundFromAnswer,answerFromRound,questionSeed,type QuestionAnswer} from '../../packages/game-modes/src/question';
import {recognizeNumber,type PenStroke} from '../../packages/game-modes/src/handwriting';
import {GenerationInput,decodeGeneration} from '../../apps/game-service/src/ai';
const q=(answer:string,text='How many?',kind:QuestionAnswer['kind']='integer'):QuestionAnswer=>({type:'single',kind,text,answer,unit:'',alternatives:[],distractors:[],exact:kind!=='approximate'});
test('exactly eleven official games; fallback and legacy are readable but not selectable',()=>{
 assert.equal(MODES.length,11);assert.equal(new Set(MODES).size,11);assert.ok(!(MODES as readonly string[]).includes('rare_answers'));assert.ok(!(MODES as readonly string[]).includes('answer'));
 const quiz=getArcadeQuiz();assert.equal(quiz.rounds.length,11);assert.deepEqual(validateQuiz(quiz),[]);
 for(const r of quiz.rounds){assert.ok(RoundSchema.safeParse(r).success);assert.deepEqual(validateAuthorConfig(r),[]);const publicRound=publicQuestionProjection(r);assert.ok(!JSON.stringify(publicRound).includes('secretConfig'));assert.ok(!JSON.stringify(publicRound).includes('correctOptionIds'));}
});
test('question recommendations distinguish counts, years, estimates, measurements and exactness',()=>{
 assert.equal(recommend(q('6','How many sides does a hexagon have?')).games[0],'amountle');
 assert.equal(recommend(q('1945','In what year did the war end?')).games[0],'crack');
 assert.equal(recommend(q('1234','What is the four-digit code?')).games[0],'crack');
 assert.equal(recommend(q('14000000','Approximately how many residents?','approximate')).games[0],'fermi');
 for(const n of ['0','-10','3.14','999999999999']){const rec=recommend(q(n,'A numerical answer'));assert.ok(rec.games.length);if(n.includes('.')||n.startsWith('-'))assert.deepEqual(rec.games,['fermi']);}
 assert.equal(recommend({...q('true'),type:'boolean',kind:'boolean'}).games[0],'drop');
 assert.equal(recommend(q('ORBIT','A looping path','word')).games[0],'word_puzzle');
 assert.equal(recommend(q('12','Resize this object','size')).games[0],'size_it_up');
});
test('missing distractors never become invented facts; multi-answer structures never become single-choice games',()=>{
 const question=q('Paris','Capital of France?','choice');assert.deepEqual(recommend(question).games,[]);assert.ok(recommend(question).missing);
 question.distractors=['Rome','Berlin'];assert.deepEqual(new Set(recommend(question).games),new Set(['fish','claw','sling']));assert.equal(recommend(question,['fish']).games[0],'claw');
 assert.deepEqual(recommend({...question,type:'multiple',kind:'multiple'}).games,['fish']);
 assert.deepEqual(recommend({...question,type:'multiple',kind:'list'}).games,[]);
 assert.equal(recommend(q('')).confidence,'low');assert.deepEqual(recommend(q('Some answer','Ambiguous','text')).games,[]);
});
test('switching compatible games preserves the question, answer, exactness and identity',()=>{
 const question=q('206','How many bones in an adult human?'),seed=questionSeed('single');
 for(const mode of recommend(question).games){const r=roundFromAnswer(question,mode,seed);assert.equal(r.id,seed.id);assert.equal(r.question,question.text);assert.equal(r.scoringPolicy,'exact');assert.equal(Number(answerFromRound(r).answer),206);assert.deepEqual(validateAuthorConfig(r),[]);}
 const choices={...q('Paris','Capital?','choice'),distractors:['Rome','Berlin']};
 for(const mode of recommend(choices).games){const r=roundFromAnswer(choices,mode,seed);assert.ok(isArcade(r));assert.equal(r.publicConfig.options.find(o=>r.secretConfig.correctOptionIds.includes(o.id))?.label,'Paris');assert.deepEqual(validateArcade(r),[]);}
});
test('arcade submissions cannot forge correctness, use unknown options, revise the payload shape or inject graphics',()=>{
 for(const mode of ['fish','claw','sling'] as const){const r=getDefaultRound(mode);assert.ok(isArcade(r));const good=sanitizeAndValidateSubmission(r,{choiceId:'b',locked:true});assert.equal(scoreArcade(r,good).points,667);assert.equal(scoreArcade(r,{choiceId:'a'}).points,0);assert.throws(()=>sanitizeAndValidateSubmission(r,{choiceId:'b',correct:true}));assert.throws(()=>sanitizeAndValidateSubmission(r,{choiceId:'unknown'}));assert.throws(()=>sanitizeAndValidateSubmission(r,{value:6}));}
 const drop=getDefaultRound('drop');assert.ok(isArcade(drop));assert.equal(scoreArcade(drop,{choiceId:'true'}).points,500);assert.equal(scoreArcade(drop,{choiceId:'false'}).points,0);assert.throws(()=>sanitizeAndValidateSubmission(drop,{choiceId:'TRUE'}));
 for(const mode of ['draw','stack','crack']as const){const r=getDefaultRound(mode);assert.ok(isArcade(r));assert.equal(scoreArcade(r,{value:6}).points,1000);assert.equal(scoreArcade(r,{value:7}).points,0);assert.throws(()=>sanitizeAndValidateSubmission(r,{value:6.1}));assert.throws(()=>sanitizeAndValidateSubmission(r,{value:-1}));assert.throws(()=>sanitizeAndValidateSubmission(r,{value:6,image:'data:secret'}));}
});
test('multiple selections and required lists retain their meaning with exact matching',()=>{
 const seed=questionSeed('multiple'),qa={...q('Cat|Whale','Which are mammals?','multiple'),type:'multiple' as const,distractors:['Lizard']};
 const r=roundFromAnswer(qa,'answer',seed);assert.ok(isArcade(r));assert.equal(scoreArcade(r,{choices:r.secretConfig.correctOptionIds}).points,1000);assert.equal(scoreArcade(r,{choices:r.secretConfig.correctOptionIds.slice(0,1)}).points,0);assert.throws(()=>sanitizeAndValidateSubmission(r,{choices:['o0','o0']}));
 const list=roundFromAnswer({...qa,kind:'list'},'answer',seed);assert.ok(isArcade(list));assert.equal(scoreArcade(list,{choices:['whale','CAT']}).points,1000);assert.equal(scoreArcade(list,{choices:['Cat']}).points,0);
 list.publicConfig.requiredCount=1;assert.equal(scoreArcade(list,{choices:['Whale']}).points,1000);assert.equal(scoreArcade(list,{choices:['Lizard']}).points,0);assert.equal(scoreArcade(list,{choices:['Cat','Whale']}).points,0);
});

test('AI can produce every official interaction without live scoring calls or invented artwork',()=>{
 const input=GenerationInput.parse({topic:'puzzles',count:11,modes:[...MODES]});
 const questions=MODES.map(mode=>({mode,question:mode==='crack'?'In what year did World War II end?':mode==='drop'?'An octopus has three hearts.':'A self-contained quiz question.',explanation:'Creator review required.',answerData:JSON.stringify(mode==='amountle'?{groups:7,perGroup:8,unit:'sweets'}:mode==='word_puzzle'||mode==='size_it_up'?{}:mode==='drop'?{answer:true}:['fish','claw','sling'].includes(mode)?{answer:'Paris',options:['Rome','Paris','Berlin']}:mode==='crack'?{answer:1945}:mode==='draw'?{answer:206}:{answer:46,unit:'items'})}));
 const quiz=decodeGeneration({title:'All interactions',questions},input);assert.equal(quiz.rounds.length,11);assert.deepEqual(new Set(quiz.rounds.map(r=>r.mode)),new Set(MODES));assert.ok(quiz.rounds.every(r=>r.provenance==='needs_review'));
 const request=GenerationInput.parse({topic:'Capital of France?',count:1,modes:['fish'],distractorFor:{question:'What is the capital of France?',answer:'Paris'}});
 assert.throws(()=>decodeGeneration({title:'Bad',questions:[{mode:'fish',question:'Different',explanation:'',answerData:JSON.stringify({answer:'Rome',options:['Paris','Rome']})}]},request),/changed the correct answer/);
});
test('new unanswered drafts remain incomplete; exact numeric entry does not quietly become approximation',()=>{
 const seed=questionSeed('single');assert.ok(validateAuthorConfig({...seed,question:'A question'}).some(i=>i.field==='secretConfig.answer'));
 const r=roundFromAnswer(q('-3','What is 2 minus 5?'),'fermi',seed);assert.equal(r.scoringPolicy,'exact');assert.deepEqual(validateAuthorConfig(r),[]);
});
test('stack unit scaling is reachable without revealing the target; invalid code sizes are rejected',()=>{
 const r=roundFromAnswer(q('100000','How many items?'),'stack',questionSeed('single'));assert.ok(isArcade(r));assert.equal(r.publicConfig.step,1);assert.ok(r.publicConfig.blockValues.includes(1000));assert.ok(!('answer' in publicQuestionProjection(r).publicConfig));assert.equal(sanitizeAndValidateSubmission(r,{value:100000}).value,100000);assert.equal(sanitizeAndValidateSubmission(r,{value:100001}).value,100001);
 const code=getDefaultRound('crack');assert.ok(isArcade(code));code.secretConfig.answer=12345;code.publicConfig.codeLength=4;assert.ok(validateArcade(code).length);
});
test('local handwriting recognizes separated handwritten 206 and fails safely on empty input',()=>{
 const paths=[[[0,2],[1,0],[4,0],[6,2],[5,4],[0,10],[6,10]],[[3,0],[1,2],[0,5],[1,9],[3,10],[5,9],[6,5],[5,1],[3,0]],[[5,0],[2,1],[0,5],[0,8],[2,10],[5,9],[6,7],[5,5],[2,5],[0,7]]];
 const strokes:PenStroke[]=paths.map((p,i)=>p.map(([x,y])=>({x:30+i*90+x*8,y:20+y*12})));
 assert.equal(recognizeNumber(strokes).value,'206');assert.deepEqual(recognizeNumber([]),{value:'',confidence:0});
 // Translation and moderate independent scale do not change a confirmed recognition.
 assert.equal(recognizeNumber(strokes.map(s=>s.map(p=>({x:p.x*1.3+10,y:p.y*.8+40})))).value,'206');
});
