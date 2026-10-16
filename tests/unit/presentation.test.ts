import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePin,rarityZone,remainingSeconds} from '../../apps/web/lib/presentation';

test('homepage PIN accepts pasted spacing and separators without losing leading zeroes',()=>{
 assert.equal(normalizePin('012 345'),'012345');assert.equal(normalizePin('012-345'),'012345');
 assert.equal(normalizePin('123456789'),'123456');assert.equal(normalizePin('abc'),'');
});
test('rare discovery depth follows frequency, never award size or answer order',()=>{
 assert.equal(rarityZone(1),'deep');assert.equal(rarityZone(2),'reef');assert.equal(rarityZone(3),'reef');assert.equal(rarityZone(4),'surface');assert.equal(rarityZone(100),'surface');
});
test('clock uses server offset and rounds upward so an active last second stays visible',()=>{
 const now=Date.parse('2026-10-16T12:00:00Z');
 assert.equal(remainingSeconds('2026-10-16T12:00:10Z',null,2000,now),8);
 assert.equal(remainingSeconds('2026-10-16T12:00:00.001Z',null,0,now),1);
 assert.equal(remainingSeconds('2026-10-16T11:59:59Z',null,0,now),0);
});
test('paused and missing clocks use persisted remaining time rather than elapsed wall time',()=>{
 assert.equal(remainingSeconds(null,12501,0,Number.MAX_SAFE_INTEGER),13);
 assert.equal(remainingSeconds(undefined,undefined,0),0);
 assert.equal(remainingSeconds(null,-1,0),0);
});
