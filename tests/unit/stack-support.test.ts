import test from 'node:test';
import assert from 'node:assert/strict';
import {stableStack,stackStability,stackFailureIndex} from '../../packages/game-modes/src/stack';
const at=(...positions:number[])=>positions.map(x=>({x,value:1}));
test('stack support rejects floating blocks and unstable combined overhangs',()=>{
 assert.equal(stableStack(at(20,80)),false);
 assert.equal(stableStack(at(50,50,50,50)),true);
 assert.equal(stableStack(at(50,55,60)),true);
 assert.equal(stableStack(at(50,60,70)),false);
 assert.equal(stableStack(at(12,12)),true);
 assert.equal(stableStack(at(0)),false);
 assert.equal(stableStack(at(NaN)),false);
 assert.equal(stackStability(at(50,50,50)),1);
 assert.ok(stackStability(at(50,60))<.2);
 assert.ok(stackStability(at(50,55))<stackStability(at(50,52)));
 assert.equal(stackFailureIndex(at(20,80)),1);
 assert.equal(stackFailureIndex(at(50,55,60,75)),1);
 assert.equal(stackFailureIndex(at(50,50,50)),-1);
});

import {getDefaultRound,sanitizeAndValidateSubmission} from '../../packages/game-modes/src/index';
import {scoreArcade} from '../../packages/game-modes/src/arcade';
test('server rejects forged totals, unsupported blocks and unapproved denominations',()=>{
 const round=getDefaultRound('stack');if(round.mode!=='stack')throw Error('fixture');round.publicConfig.stackPhysics='support-v1';
 assert.throws(()=>sanitizeAndValidateSubmission(round,{value:2,blocks:at(20,80)}));
 assert.throws(()=>sanitizeAndValidateSubmission(round,{value:99,blocks:at(50,50)}));
 assert.throws(()=>sanitizeAndValidateSubmission(round,{value:3,blocks:[{x:50,value:3}]}));
 assert.equal(sanitizeAndValidateSubmission(round,{value:2,blocks:at(50,50)}).value,2);
 round.secretConfig.answer=2;round.speedScoring='time-v1';
 assert.equal(scoreArcade(round,{value:2,blocks:at(50,50)}).points,1000);
 assert.ok(scoreArcade(round,{value:2,blocks:at(50,60)}).points<1000);
});
