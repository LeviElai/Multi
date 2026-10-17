'use client';
import {useEffect} from 'react';
import {playCue,unlockAudio,silenceAudio} from '../lib/audio';
export default function SoundDesign(){
 useEffect(()=>{
  const unlock=()=>unlockAudio();
  const click=(e:MouseEvent)=>{
   const button=(e.target as Element)?.closest('button,a');
   if(button&&!button.hasAttribute('disabled')&&!button.closest('.word-keyboard,.fill-game,.step-controls')) playCue('click');
  };
  const mute=()=>silenceAudio();
  const hide=()=>{document.documentElement.dataset.hidden=String(document.hidden);if(document.hidden)silenceAudio();};
  hide();
  if(navigator.hardwareConcurrency<=4||(navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData)document.documentElement.dataset.effects="low";
  window.addEventListener('pointerdown',unlock,{capture:true});
  window.addEventListener('keydown',unlock,{capture:true});
  document.addEventListener('click',click);
  document.addEventListener('visibilitychange',hide);
  window.addEventListener('multigame-sound-change',mute);
  return()=>{window.removeEventListener('pointerdown',unlock,true);window.removeEventListener('keydown',unlock,true);
   document.removeEventListener('click',click);document.removeEventListener('visibilitychange',hide);
   window.removeEventListener('multigame-sound-change',mute);silenceAudio();};
 },[]);return null;
}
