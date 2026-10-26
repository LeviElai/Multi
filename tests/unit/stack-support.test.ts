import test from 'node:test';
import assert from 'node:assert/strict';
import {stableStack} from '../../packages/game-modes/src/stack';
const at=(...positions:number[])=>positions.map(x=>({x,value:1}));
test('stack support rejects floating blocks and unstable combined overhangs',()=>{
 assert.equal(stableStack(at(20,80)),false);
 assert.equal(stableStack(at(50,50,50,50)),true);
 assert.equal(stableStack(at(50,55,60)),true);
 assert.equal(stableStack(at(50,60,70)),false);
 assert.equal(stableStack(at(12,12)),true);
 assert.equal(stableStack(at(0)),false);
 assert.equal(stableStack(at(NaN)),false);
});

import {getDefaultRound,sanitizeAndValidateSubmission} from '../../packages/game-modes/src/index';
test('server rejects forged totals, unsupported blocks and unapproved denominations',()=>{
 const round=getDefaultRound('stack');if(round.mode!=='stack')throw Error('fixture');round.publicConfig.stackPhysics='support-v1';
 assert.throws(()=>sanitizeAndValidateSubmission(round,{value:2,blocks:at(20,80)}));
 assert.throws(()=>sanitizeAndValidateSubmission(round,{value:99,blocks:at(50,50)}));
 assert.throws(()=>sanitizeAndValidateSubmission(round,{value:3,blocks:[{x:50,value:3}]}));
 assert.equal(sanitizeAndValidateSubmission(round,{value:2,blocks:at(50,50)}).value,2);
});
