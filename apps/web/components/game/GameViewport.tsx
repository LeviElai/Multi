'use client';
import {useLayoutEffect} from 'react';
import {acquireGameViewport} from './viewport-session';
/** Keep the game frame inside browser chrome and the on-screen keyboard. */
export function GameViewport({active}:{active:boolean}) {
 useLayoutEffect(()=>{
  if(!active)return;
  const release=acquireGameViewport(document);
  const viewport=window.visualViewport;
  const update=()=>{document.documentElement.style.setProperty('--game-height',`${viewport?.height??window.innerHeight}px`);document.documentElement.style.setProperty('--game-top',`${viewport?.offsetTop??0}px`);};
  update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
  return()=>{release();viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
 },[active]);
 return null;
}
