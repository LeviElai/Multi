'use client';
import {useEffect} from 'react';
/** Keep the game frame inside browser chrome and the on-screen keyboard. */
export function GameViewport({active}:{active:boolean}) {
 useEffect(()=>{
  if(!active)return;
  const previousOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
  const viewport=window.visualViewport;
  const update=()=>{document.documentElement.style.setProperty('--game-height',`${viewport?.height??window.innerHeight}px`);document.documentElement.style.setProperty('--game-top',`${viewport?.offsetTop??0}px`);};
  update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
  return()=>{document.body.style.overflow=previousOverflow;viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);document.documentElement.style.removeProperty('--game-height');document.documentElement.style.removeProperty('--game-top');};
 },[active]);
 return null;
}
