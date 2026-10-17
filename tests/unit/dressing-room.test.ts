import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {wrapOption,optionWindow} from '../../apps/web/components/game/LoopSelector';
import {PixelCharacter,CharacterItem,CharacterEditor} from '../../apps/web/components/game/PlayerIdentity';
import {avatarFor,LOOK_OPTIONS} from '../../packages/contracts/src/avatar';
test('all belts wrap both ways and keep a unique selected central slot through rapid cycles',()=>{
 for(const count of Object.values(LOOK_OPTIONS))for(let value=0;value<count;value++){
  const items=optionWindow(value,count);assert.equal(items[Math.floor(items.length/2)],value);assert.equal(new Set(items).size,items.length);
  assert.equal(wrapOption(value+count,count),value);assert.equal(wrapOption(value-count,count),value);
  assert.equal(wrapOption(wrapOption(value+1,count)-1,count),value);
 }
 assert.equal(wrapOption(-1,10),9);assert.equal(wrapOption(10,10),0);assert.equal(wrapOption(10003,10),3);
});
test('isolated previews render canonical layers without a dressed body or shadow backing',()=>{
 const avatar=avatarFor('canonical-test');
 const body=renderToStaticMarkup(createElement(PixelCharacter,{id:'x',avatar:{...avatar,hair:9,hat:0}}));
 assert.doesNotMatch(body,/M6 8h12v3h3v12|M6 37h20|0c192a44/);
 for(const detail of ['hair','shirt','pants','hat','accessory','face'] as const){
  const value=detail==='hat'||detail==='accessory'?1:0;
  const isolated=renderToStaticMarkup(createElement(CharacterItem,{detail,value,avatar}));
  assert.match(isolated,/character-item/);assert.doesNotMatch(isolated,/character-body|character-item mood|M6 37h20/);
  if(detail!=='face')assert.doesNotMatch(isolated,/character-face/);
 }
 assert.match(renderToStaticMarkup(createElement(CharacterItem,{detail:'hat',value:0,avatar})),/item-none/);
 assert.match(renderToStaticMarkup(createElement(CharacterItem,{detail:'hair',value:9,avatar})),/item-none/);
});

test('closed editor does not mount any character or option previews',()=>{
 const html=renderToStaticMarkup(createElement(CharacterEditor,{member:{id:'local',nickname:'Luna',joinedAt:'',status:'active',avatar:avatarFor('local')},sessionId:'local',onSaved:()=>{}}));
 assert.doesNotMatch(html,/<svg|belt-items/);assert.match(html,/Edit look/);
});
