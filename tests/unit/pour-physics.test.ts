import test from 'node:test';
import assert from 'node:assert/strict';
import {createBody,stepBodies,settleBodies} from '../../apps/web/lib/pour-physics';
for(const fps of [30,60,120])test('128 candies stack without visible overlap at '+fps+'fps',()=>{
 const bodies=Array.from({length:128},(_,i)=>createBody('stack-test',i));
 for(let i=0;i<fps*8;i++)stepBodies(bodies,1/fps);
 settleBodies(bodies);
 let worst=0;
 for(const b of bodies){assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));assert.ok(b.y>=b.r-.01);assert.ok(Math.abs(b.x)<=110-b.r+.01);assert.equal(b.z,0);}
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const a=bodies[i],b=bodies[j];worst=Math.max(worst,a.r+b.r-Math.hypot(a.x-b.x,a.y-b.y));}
 assert.ok(worst<.2,'maximum visible penetration '+worst);assert.equal(bodies.length,128);assert.ok(Math.max(...bodies.map(b=>b.y))>150,'pile builds upward');
});
