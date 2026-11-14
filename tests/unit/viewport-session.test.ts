import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireGameViewport} from '../../apps/web/components/game/viewport-session';
function documentDouble() {
 const attrs=new Map<string,string>(),vars=new Map([['--game-height','600px'],['--game-top','0px']]);
 const doc={body:{style:{overflow:'auto'},getAttribute:(k:string)=>attrs.get(k)??null,setAttribute:(k:string,v:string)=>attrs.set(k,v),removeAttribute:(k:string)=>attrs.delete(k)},documentElement:{style:{removeProperty:(k:string)=>vars.delete(k)}}};
 return {doc:doc as unknown as Document,attrs,vars};
}
test('active gameplay hides site chrome, then restores it and scroll on exit',()=>{
 const {doc,attrs,vars}=documentDouble(),release=acquireGameViewport(doc);
 assert.equal(attrs.get('data-game-active'),'true');assert.equal(doc.body.style.overflow,'hidden');
 release();assert.equal(attrs.has('data-game-active'),false);assert.equal(doc.body.style.overflow,'auto');assert.equal(vars.size,0);
 release();assert.equal(doc.body.style.overflow,'auto');
});
test('overlapping game mounts cannot restore site chrome before the last game exits',()=>{
 const {doc,attrs}=documentDouble(),first=acquireGameViewport(doc),second=acquireGameViewport(doc);
 first();assert.equal(attrs.get('data-game-active'),'true');assert.equal(doc.body.style.overflow,'hidden');
 second();assert.equal(attrs.has('data-game-active'),false);assert.equal(doc.body.style.overflow,'auto');
});
