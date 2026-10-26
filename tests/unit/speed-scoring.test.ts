import test from 'node:test';
import assert from 'node:assert/strict';
import {activeResponseMs,speedPoints} from '../../packages/game-modes/src/speed';
test('speed rewards correctness first, with a secondary bonus for estimation',()=>{
 assert.equal(speedPoints(1000,0,20000),1000);
 assert.equal(speedPoints(1000,10000,20000),750);
 assert.equal(speedPoints(1000,20000,20000),500);
 assert.equal(speedPoints(0,0,20000),0);
 assert.equal(speedPoints(1000,20000,20000,true),800);
 assert.equal(speedPoints(500,0,20000,true),500);
 assert.equal(speedPoints(1000,Infinity,20000),0);
});
test('server pause segments exclude only time before the accepted answer',()=>{
 const clock={roundId:'r',startedAt:1000,pauses:[{start:5000,end:15000},{start:20000,end:25000}]};
 assert.equal(activeResponseMs(clock,new Date(3000).toISOString()),2000);
 assert.equal(activeResponseMs(clock,new Date(18000).toISOString()),7000);
 assert.equal(activeResponseMs(clock,new Date(30000).toISOString()),14000);
});
