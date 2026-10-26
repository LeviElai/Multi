import test from 'node:test';
import assert from 'node:assert/strict';
import {recommend,roundFromAnswer,questionSeed,type QuestionAnswer} from '../../packages/game-modes/src/question';
import {validateAuthorConfig,publicQuestionProjection,sanitizeAndValidateSubmission} from '../../packages/game-modes/src/index';
import {isArcade,scoreArcade} from '../../packages/game-modes/src/arcade';
import {RoundSchema} from '../../packages/contracts/src/index';
import {plinkoPath} from '../../packages/game-modes/src/physical';
const q=(answer:string,text='How many objects?',patch:Partial<QuestionAnswer>={}):QuestionAnswer=>({answer,text,type:'single',kind:'integer',exact:true,distractors:[],alternatives:[],unit:'',...patch});
test('polish policy covers the specified numerical boundaries and semantic exceptions',()=>{
 for(const n of [0,5,80,120])assert.equal(recommend(q(String(n))).games[0],'amountle');
 assert.equal(recommend(q('80'),['amountle']).games[0],'stack');
 for(const n of [206,999])assert.equal(recommend(q(String(n))).games[0],'draw');
 assert.equal(recommend(q('1945','In what year did World War II end?')).games[0],'crack');
 const large=recommend(q('4000','How many people attended?'));assert.equal(large.games[0],'fermi');assert.ok(!large.games.includes('crack'));assert.ok(large.games.includes('stack'));
 assert.equal(recommend(q('999','How many kilometres away?',{unit:'km'})).games[0],'fermi');
 assert.equal(recommend(q('14000000','Approximately how far?',{kind:'approximate',exact:false})).games[0],'fermi');
 assert.equal(recommend(q('ORBIT','A looping path',{kind:'word'})).games[0],'word_puzzle');
 assert.deepEqual(recommend(q('Paris','Capital of France?',{kind:'text'})).games,[]);
 for(const example of [q('5'),q('80'),q('206'),q('999'),q('1945','What year was it?'),q('4000'),q('14000000','Distance',{kind:'approximate',exact:false}),q('ORBIT','A looping path',{kind:'word'}),q('Paris','Capital?',{kind:'choice',distractors:['Rome','Berlin']})])for(const mode of recommend(example).games)assert.deepEqual(validateAuthorConfig(roundFromAnswer(example,mode,questionSeed('single'))),[],mode);
});
test('boolean Sling has exactly two playable targets and scores the actual boolean',()=>{
 for(const answer of ['true','false']){const input=q(answer,'An octopus has three hearts.',{type:'boolean',kind:'boolean'});assert.equal(recommend(input,['drop']).games[0],'sling');const round=roundFromAnswer(input,'sling',questionSeed('boolean'));assert.ok(isArcade(round));assert.deepEqual(validateAuthorConfig(round),[]);assert.deepEqual(new Set(round.publicConfig.options.map(o=>o.label)),new Set(['TRUE','FALSE']));assert.equal(round.publicConfig.options.length,2);assert.equal(scoreArcade(round,sanitizeAndValidateSubmission(round,{choiceId:answer})).points,1000);assert.equal(scoreArcade(round,{choiceId:answer==='true'?'false':'true'}).points,0);assert.ok(!JSON.stringify(publicQuestionProjection(round)).includes('correctOptionIds'));}
});
test('balanced Fish rewards knowledge, penalizes wrong catches, and preserves old exact-set rounds',()=>{
 const round=roundFromAnswer(q('Cat|Whale','Which are mammals?',{type:'multiple',kind:'multiple',distractors:['Lizard','Trout']}),'fish',questionSeed('multiple'));assert.ok(isArcade(round));delete round.publicConfig.fishScoring;const correct=round.secretConfig.correctOptionIds,bad=round.publicConfig.options.filter(o=>!correct.includes(o.id)).map(o=>o.id);
 assert.equal(scoreArcade(round,{choices:correct}).points,1000);assert.equal(scoreArcade(round,{choices:[correct[0]]}).points,500);assert.equal(scoreArcade(round,{choices:[...correct,bad[0]]}).points,500);assert.equal(scoreArcade(round,{choices:round.publicConfig.options.map(o=>o.id)}).points,0);assert.equal(scoreArcade(round,{choices:bad}).points,0);
 const parsed=RoundSchema.parse(round);assert.ok(isArcade(parsed));assert.equal(parsed.publicConfig.selectionScoring,'balanced-v1');delete round.publicConfig.selectionScoring;assert.equal(scoreArcade(round,{choices:[correct[0]]}).points,0);assert.equal(scoreArcade(round,{choices:correct}).points,1000);
});
test('Plinko circle collision traces remain continuous and intentional across board aspect ratios',()=>{
 for(const aspect of [.6,.85,1,1.5])for(const x of [8,25,45,55,75,92]){const path=plinkoPath(x,aspect);assert.ok(path.some(p=>p.impact!==undefined),'visible peg impacts');assert.ok(Math.abs(path.at(-1)!.y-85.5)<.01,'ball settles');assert.ok(path.every(p=>(x<50?p.x<50:p.x>50)&&Number.isFinite(p.y)));assert.ok(path.slice(1).every((p,i)=>Math.hypot(p.x-path[i].x,p.y-path[i].y)<2),'no teleports');assert.deepEqual(plinkoPath(x,aspect),path);}
});

test('handwritten loop-and-stem 9 is distinguished from 1, including multi-stroke 96',async()=>{
 const {recognizeNumber}=await import('../../packages/game-modes/src/handwriting');
 const strokes=[[[0,0],[40,0]],[[40,0],[40,80]],[[40,40],[0,40]],[[0,40],[0,0]],[[125,0],[100,40]],[[100,40],[100,80]],[[100,80],[140,80]],[[140,80],[140,40]],[[140,40],[100,40]]].map(s=>s.map(([x,y])=>({x:x+30,y:y+20})));
 assert.equal(recognizeNumber(strokes).value,'96');assert.equal(recognizeNumber(strokes.map(s=>s.map(p=>({x:p.x*.9+10,y:p.y*1.4})))).value,'96');
});
