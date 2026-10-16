import test from 'node:test';
import assert from 'node:assert/strict';
import {roundPlacements,rankMovement,resultPhase} from '../../apps/web/lib/competition';
import {createBody,stepBodies,MAX_BODIES} from '../../apps/web/lib/pour-physics';
import type {Leader} from '../../packages/contracts/src/index';
const leader=(id:string,points:number,roundPoints:number,rank:number):Leader=>({participantId:id,nickname:id,points,roundPoints,rank});
test('round placements use round points, preserve all ties and do not invent contestants',()=>{
 for(const n of [1,2,3,5,10]){const rows=Array.from({length:n},(_,i)=>leader(String(i),i*100,1000,i+1));const podium=roundPlacements(rows);assert.equal(podium.length,n);assert.ok(podium.every(p=>p.roundRank===1));}
 assert.deepEqual(roundPlacements([leader('b',4000,200,1),leader('a',1000,1000,2),leader('c',3000,200,3)]).map(p=>[p.participantId,p.roundRank]),[['a',1],['b',2],['c',2]]);
 assert.deepEqual(roundPlacements([]),[]);
});
test('standings movement derives previous rank from actual totals minus this round',()=>{const rows=[leader('a',2000,1000,1),leader('b',1800,300,2)];assert.equal(rankMovement(rows,'a'),1);assert.equal(rankMovement(rows,'b'),-1)});
test('result pacing is configurable and deterministic across a reconnect',()=>{assert.equal(resultPhase(9999),'reveal');assert.equal(resultPhase(10000),'podium');assert.equal(resultPhase(17000),'standings');assert.equal(resultPhase(100000),'standings');assert.equal(resultPhase(1500,{reveal:1000,podium:1000}),'podium')});
test('visual shape sequence is seeded, bounded, finite, and settles without changing the count',()=>{
 assert.deepEqual(createBody('round-a',5),createBody('round-a',5));assert.notDeepEqual(createBody('round-a',5),createBody('round-b',5));
 const bodies=Array.from({length:MAX_BODIES},(_,i)=>createBody('test',i));for(let t=0;t<600;t++)stepBodies(bodies,1/60);
 assert.equal(bodies.length,MAX_BODIES);assert.ok(bodies.every(b=>Number.isFinite(b.y)&&b.y>=b.r&&Math.abs(b.x)<=110-b.r&&Math.abs(b.z)<=65-b.r));assert.ok(bodies.every(b=>b.y<160));
});

test('practice totals exclude scores from deleted or regenerated quiz rounds',async()=>{
 const {practiceLeaderboard}=await import('../../apps/web/lib/competition');
 const award=(id:string,points:number)=>({roundId:id,participantId:'you',points,reason:'test',scoringRevision:1,detail:{}});
 const leaders=practiceLeaderboard([{id:'you',nickname:'You'}],['current'],{removed:[award('removed',1000)],current:[award('current',500)]},'current');
 assert.equal(leaders[0].points,500);assert.equal(leaders[0].roundPoints,500);
});
