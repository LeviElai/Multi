'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import PourScene from './PourScene';
import {playCue} from '../../lib/audio';
/** One pointer is one stream. Click is reserved for keyboard/assistive activation. */
export function PourControl({count,onAdd,disabled,target,seed,flow=1}:{count:number;onAdd:(amount?:number)=>void;disabled:boolean;target:number;seed:string;flow?:number}){
 const add=useRef(onAdd);add.current=onAdd;const disabledRef=useRef(disabled);disabledRef.current=disabled;const pointer=useRef<number|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const [pouring,setPouring]=useState(false);
 const stop=useCallback(()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;pointer.current=null;setPouring(false)},[]);
 const drop=(amount=1)=>{if(!disabledRef.current){add.current(amount);playCue('pour')}};
 useEffect(()=>{if(disabled)stop()},[disabled,stop]);
 useEffect(()=>{const visibility=()=>{if(document.hidden)stop()};window.addEventListener('blur',stop);document.addEventListener('visibilitychange',visibility);return()=>{if(timer.current)clearTimeout(timer.current);window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',visibility)}},[stop]);
 return <div className={'fill-game '+(pouring?'is-pouring':'')}><div className="fill-target"><span>Target</span><strong>{target.toLocaleString('en')}</strong><span>objects</span></div><PourScene count={count} seed={seed}/><button className="pour-trigger" disabled={disabled} aria-label="Pour one object; hold to pour" onPointerDown={e=>{if(disabled||pointer.current!==null||e.button!==0)return;e.preventDefault();pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);setPouring(true);drop();const stream=()=>{if(pointer.current===null||disabledRef.current)return;drop(flow);timer.current=setTimeout(stream,100)};timer.current=setTimeout(stream,300)}} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onClick={e=>{if(e.detail===0)drop()}}><span aria-hidden="true">↓</span>{disabled?'Pour locked':'Pour'}</button><p>Tap for one. Hold to pour. No undo.</p><small>{disabled?'The round has ended.':'Stops automatically when time runs out.'}</small></div>
}
