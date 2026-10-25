import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateClock,recordClock,snapshotClock} from '../../apps/web/lib/server-clock';
import {fishPosition} from '../../packages/game-modes/src/fish';

test('Fishing animation predicts receipt under a measured symmetric round trip',()=>{
 for(const lag of [0,75,300,700]){
  const start=1700000000000,serverSample=start+500,clientSkew=42000;
  const receivedAt=serverSample+lag+clientSkew;
  const clock=estimateClock(new Date(serverSample).toISOString(),receivedAt,lag*2);
  const tapTime=start+1800-lag+clientSkew;
  const visual=fishPosition(tapTime+clock.offsetMs+clock.deliveryMs,start,0);
  const authoritative=fishPosition(tapTime-clientSkew+lag,start,0);
  assert.equal(visual.position,50);
  assert.equal(visual.catchable,authoritative.catchable);
 }
});
test('Clock sample survives lazy mounting without treating an old snapshot as current',()=>{
 const snapshot={serverTime:new Date(1700000000000).toISOString()};
 recordClock(snapshot,1700000000300,600);
 assert.deepEqual(snapshotClock(snapshot),{offsetMs:0,deliveryMs:300});
 assert.deepEqual(JSON.parse(JSON.stringify(snapshot)),snapshot);
});
test('Cold-start outliers cannot lead the animation by many seconds',()=>{
 assert.equal(estimateClock(new Date().toISOString(),Date.now(),30000).deliveryMs,750);
});
