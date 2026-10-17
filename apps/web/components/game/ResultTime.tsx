'use client';
import {useEffect,useState,useRef} from 'react';
import type {Snapshot} from '../../../../packages/contracts/src/index';
import {REVEAL_MS,revealStep,STANDINGS_MS} from '../../../../packages/contracts/src/timing';
export function useResultStep(s:Snapshot){
 const compute=()=>{const left=s.state==='PAUSED'?s.pausedRemainingMs??0:Math.max(0,Date.parse(s.deadlineAt??s.serverTime)-Date.now()-(Date.parse(s.serverTime)-captured.current));
  if(s.phase!=='placements')return s.automatic===false?'points':revealStep(left);
  const elapsed=STANDINGS_MS-left;return elapsed<900?'previous':elapsed<1200?'gains':elapsed<2600?'counting':'settled';};
 const captured=useRef(Date.now());
 const [step,setStep]=useState(compute);
 useEffect(()=>{captured.current=Date.now();setStep(compute());if(s.state==='PAUSED')return;const timer=setInterval(()=>setStep(compute()),100);return()=>clearInterval(timer);},[s.phase,s.deadlineAt,s.pausedRemainingMs,s.state,s.serverTime]);
 return step;
}
/** Visual interpolation only. The endpoints are authoritative scores. */
export function ScoreTotal({from,to,progress=1,startAt,offset=0,paused=false}:{from:number;to:number;progress?:number;startAt?:number;offset?:number;paused?:boolean}){
 const target=useRef<HTMLElement>(null);
 useEffect(()=>{const el=target.current;if(!el)return;
  if(progress!==0||matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=to.toLocaleString('en');return;}
  let frame=0;const start=performance.now(),duration=1200;
  const tick=(now:number)=>{const p=Math.max(0,Math.min(1,startAt===undefined?(now-start)/duration:(Date.now()+offset-startAt)/duration));el.textContent=Math.round(from+(to-from)*(1-(1-p)**3)).toLocaleString('en');if(p<1&&!paused)frame=requestAnimationFrame(tick);};
  tick(performance.now());return()=>cancelAnimationFrame(frame);
 },[from,to,progress,startAt,offset,paused]);
 return <strong ref={target} aria-label={to.toLocaleString('en')+' total points'}>{(progress===0?from:to).toLocaleString('en')}</strong>;
}
