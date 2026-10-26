import test from 'node:test';
import assert from 'node:assert/strict';
import {stackScale,recommend,roundFromAnswer,questionSeed,type QuestionAnswer} from '../../packages/game-modes/src/question';
import {validateAuthorConfig,sanitizeAndValidateSubmission} from '../../packages/game-modes/src/index';
import {isArcade,scoreArcade} from '../../packages/game-modes/src/arcade';
for(const n of [5,12,40,400,4000,100000])test('Stack is practical and exact for '+n,()=>{
 const scale=stackScale(n);assert.ok(scale.practical);assert.ok(scale.placements<=32);
 const q:QuestionAnswer={type:'single',kind:'integer',text:'How many objects?',answer:String(n),alternatives:[],distractors:[],unit:'objects',exact:true};
 assert.ok(recommend(q).games.includes('stack'));const round=roundFromAnswer(q,'stack',questionSeed('single'));assert.ok(isArcade(round));assert.deepEqual(validateAuthorConfig(round),[]);
 let left=n,total=0;const blocks:{value:number;x:number}[]=[];for(const v of [...round.publicConfig.blockValues].reverse()){while(left>=v){left-=v;total+=v;blocks.push({value:v,x:50});}}assert.equal(total,n);assert.equal(scoreArcade(round,sanitizeAndValidateSubmission(round,{value:total,blocks,locked:true})).points,1000);
 if(n===4000)assert.ok(round.publicConfig.blockValues.includes(100));if(n===100000)assert.ok(round.publicConfig.blockValues.includes(1000));
});
test('impractical Stack tails prefer another game; unsupported words never expose Answer',()=>{
 assert.equal(stackScale(100099).practical,false);
 const q:QuestionAnswer={type:'single',kind:'integer',text:'How many?',answer:'100099',alternatives:[],distractors:[],unit:'',exact:true};assert.ok(!recommend(q).games.includes('stack'));assert.equal(recommend(q).games[0],'fermi');assert.deepEqual(recommend({...q,kind:'word',answer:'two words'}).games,[]);
});

test('older published Stack rounds get usable blocks without rewriting saved answers or scoring',async()=>{
 const {getDefaultRound,publicQuestionProjection}=await import('../../packages/game-modes/src/index');const r=getDefaultRound('stack');assert.ok(isArcade(r));r.secretConfig.answer=4000;r.publicConfig.max=100000;r.publicConfig.step=1;r.publicConfig.blockValues=[1,5,10,25];const before=JSON.stringify(r);
 const shown=publicQuestionProjection(r);assert.ok('blockValues' in shown.publicConfig);assert.ok(shown.publicConfig.blockValues.includes(100));assert.ok(shown.publicConfig.blockValues.includes(1000));assert.equal(JSON.stringify(r),before);assert.equal(scoreArcade(r,sanitizeAndValidateSubmission(r,{value:4000})).points,1000);assert.ok(!JSON.stringify(shown).includes('secretConfig'));
});
