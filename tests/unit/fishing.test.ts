import test from 'node:test';
import assert from 'node:assert/strict';
import {fishCast,fishPosition,FISH_PERIOD} from '../../packages/game-modes/src/fish';
import {getDefaultRound} from '../../packages/game-modes/src/fixtures';
import {sanitizeAndValidateSubmission} from '../../packages/game-modes/src/index';
import type {Submission} from '../../packages/contracts/src/index';
test('fishing uses server time, bounded points, repeatable catches and penalties',()=>{
 const r=getDefaultRound('fish');if(r.mode!=='fish')throw Error();r.timerSeconds=40;
 const start=100000,deadline=start+40000;let previous:Submission|undefined;
 const cast=(id:string,at:number)=>{const result=fishCast(r,id,previous,at,deadline);previous={id:'test',roundId:r.id,participantId:'test',clientMutationId:'test',revision:1,payload:result.payload,acceptedAt:new Date(at).toISOString()};return result;}
 // Correct option b is offset by 600 ms and reaches the middle at 1200 ms.
 assert.equal(fishPosition(start+1200,start,1).position,50);
 assert.equal(cast('b',start+1200).ack.fishPoints,100);
 assert.throws(()=>cast('b',start+1201),/line is returning/);
 assert.throws(()=>cast('b',start+1900),/swim back/);
 assert.equal(cast('a',start+2000).ack.fishPoints,50);
 assert.equal(cast('b',start+3000).ack.fishPoints,50); // next cycle, outside zone
 for(let cycle=1;cycle<=10;cycle++){
  const at=start+1200+cycle*FISH_PERIOD;
  if(cycle===1)continue; // previous miss already consumed this pass
  cast('b',at);
 }
 assert.equal(previous!.payload.fishCatches,10);assert.equal(previous!.payload.fishPoints,950);
 assert.throws(()=>cast('b',deadline),/Time is up/);
 assert.throws(()=>sanitizeAndValidateSubmission(r,{choiceId:'b',fishPoints:1000}),/unsupported fields/);
 assert.throws(()=>fishCast(r,'missing',undefined,start+1200,deadline),/Choose a fish/);
});
