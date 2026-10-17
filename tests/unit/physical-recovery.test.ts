import test from 'node:test';
import assert from 'node:assert/strict';
import {plinkoPath} from '../../packages/game-modes/src/physical';
import {getDefaultRound,sanitizeAndValidateSubmission} from '../../packages/game-modes/src/index';
import {recommend,type QuestionAnswer} from '../../packages/game-modes/src/question';
for(const x of [8,15,25,35,45,49,50,55,65,75,85,92])test('Plinko stays intentional and reaches its bin from '+x,()=>{
 const path=plinkoPath(x);assert.ok(path.length>300&&path.length<=2401);assert.ok(Math.abs(path.at(-1)!.y-85.5)<.001);assert.ok(path.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&(x<50?p.x<50:p.x>50)));
 assert.ok(path.some((p,i)=>i>0&&p.y<path[i-1].y)||path.some((p,i)=>i>1&&(p.x-path[i-1].x)*(path[i-1].x-path[i-2].x)<0),'pegs redirect the falling ball');assert.ok(path.slice(1).every((p,i)=>Math.hypot(p.x-path[i].x,p.y-path[i].y)<1.5),'continuous small simulation steps');
});
test('handwriting accepts bounded points only for Draw and preserves the confirmed value',()=>{
 const r=getDefaultRound('draw'),ink=[[{x:10,y:10},{x:20,y:200}]];assert.deepEqual(sanitizeAndValidateSubmission(r,{value:6,ink,locked:true}),{value:6,ink,locked:true});
 for(const bad of [[[{x:0,y:-1},{x:1,y:2}]],[[{x:0,y:0,secret:'injected'},{x:1,y:2}]],Array.from({length:33},()=>ink[0])])assert.throws(()=>sanitizeAndValidateSubmission(r,{value:6,ink:bad}));
 assert.throws(()=>sanitizeAndValidateSubmission(getDefaultRound('stack'),{value:6,ink}));
});
test('a duration in years is a quantity, not a historical year code',()=>{
 const q:QuestionAnswer={type:'single',kind:'integer',text:'How many years are in ten decades?',answer:'100',unit:'years',exact:true,alternatives:[],distractors:[]};assert.equal(recommend(q).games[0],'amountle');q.text='In what year did World War II end?';q.answer='1945';assert.equal(recommend(q).games[0],'crack');
});

test('unsupported choice counts stay saved as setup data without becoming a playable game',async()=>{
 const {DraftQuizInputSchema}=await import('../../packages/contracts/src/index');const {questionSeed,roundFromAnswer,answerFromRound}=await import('../../packages/game-modes/src/question');
 const q:QuestionAnswer={type:'multiple',kind:'multiple',text:'Which are included?',answer:'A|B|C|D|E|F|G',distractors:['H'],alternatives:[],unit:'',exact:true};assert.deepEqual(recommend(q).games,[]);const r=roundFromAnswer(q,'answer',questionSeed('multiple'));assert.equal(r.mode,'answer');assert.ok(DraftQuizInputSchema.safeParse({title:'',rounds:[r]}).success);assert.deepEqual(new Set(answerFromRound(r).answer.split('|')),new Set(q.answer.split('|')));
});
