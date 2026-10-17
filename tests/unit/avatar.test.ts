import {avatarFor,AvatarSchema,LOOK_OPTIONS} from '../../packages/contracts/src/avatar';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PixelCharacter} from '../../apps/web/components/game/PlayerIdentity';

test('identity produces stable, varied, bounded appearances independent of sorting',()=>{
 const ids=Array.from({length:1000},(_,i)=>'participant-'+i),looks=ids.map(id=>avatarFor(id));
 assert.equal(new Set(looks.map(x=>JSON.stringify(x))).size,1000);
 for(const [i,a]of looks.entries()){assert.equal(AvatarSchema.safeParse(a).success,true);assert.deepEqual(a,avatarFor(ids[i]));}
 assert.deepEqual([...ids].reverse().map(id=>avatarFor(id)).reverse(),looks);
 assert.equal(AvatarSchema.safeParse({...looks[0],hat:12}).success,false);
 assert.equal(AvatarSchema.safeParse({...looks[0],skin:-1}).success,false);
 assert.equal(AvatarSchema.safeParse({...looks[0],ownerId:'someone-else'}).success,false);
 for(const key of Object.keys(LOOK_OPTIONS) as (keyof typeof LOOK_OPTIONS)[])assert.equal(new Set(looks.map(a=>a[key])).size,LOOK_OPTIONS[key]);
});
test('all hair, face and accessory layers use the integer pixel grid; the winner crown is opt-in',()=>{
 for(let hair=0;hair<10;hair++)for(let face=0;face<8;face++)for(let hat=0;hat<9;hat++){
  const avatar={...avatarFor('layer-check'),hair,face,hat};
  const svg=renderToStaticMarkup(createElement(PixelCharacter,{id:'same-player',avatar}));
  assert.match(svg,/viewBox="0 0 32 40"/);assert.match(svg,/shape-rendering="crispEdges"/);
  assert.doesNotMatch(svg,/NaN|undefined|M5 1h3v3/);
  for(const r of svg.matchAll(/<rect[^>]*x="(\d+)"[^>]*y="(\d+)"[^>]*width="(\d+)"[^>]*height="(\d+)"/g))assert.ok(Number(r[1])+Number(r[3])<=32&&Number(r[2])+Number(r[4])<=40);
 }
 assert.match(renderToStaticMarkup(createElement(PixelCharacter,{id:'same-player',crown:true})),/M5 1h3v3/);
});
