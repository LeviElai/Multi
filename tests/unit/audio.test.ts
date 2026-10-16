import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playCue,unlockAudio,silenceAudio} from '../../apps/web/lib/audio';
test('sound waits for interaction, obeys mute and stops scheduled voices',()=>{
 let contexts=0,starts=0,stops=0,setting:string|null=null;
 const old={window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage,AudioContext:globalThis.AudioContext};
 class FakeContext{
  state='running';currentTime=0;destination={};
  constructor(){contexts++;}
  createOscillator(){return {type:'',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(){starts++;},stop(){stops++;},onended:null};}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 }
 try{
  Object.assign(globalThis,{window:{},document:{hidden:false},localStorage:{getItem:()=>setting},AudioContext:FakeContext});
  playCue('submit');assert.equal(contexts,0,'no audio before an interaction');
  unlockAudio();playCue('submit');assert.equal(contexts,1);assert.equal(starts,3);
  setting='off';playCue('final');assert.equal(starts,3,'mute prevents final fanfare');
  setting='on';playCue('reveal');assert.equal(contexts,1,'one reusable context');assert.equal(starts,7);
  const before=stops;silenceAudio();assert.equal(stops,before+7,'mute stops scheduled notes as well');
 }finally{Object.assign(globalThis,old);}
});
