'use client';
import {useEffect,useRef,useState} from 'react';
import type {Snapshot} from '../../../../packages/contracts/src/index';
export const COMMIT_MS:Record<string,number>={claw:3200,drop:2600,sling:1200,fish:750,draw:650,stack:700,crack:850};
const EVENT='multigame:physical-commit';
export function holdRoundAnimation(roundId:string,mode:string){window.dispatchEvent(new CustomEvent(EVENT,{detail:{roundId,until:Date.now()+(COMMIT_MS[mode]??500)}}));}
/** Presentation may finish a committed action while the authoritative room advances. */
export function useRoundPresentation(snapshot:Snapshot|null){
 const hold=useRef<{roundId:string;until:number}|null>(null),last=useRef<Snapshot|null>(null),[,redraw]=useState(0);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const start=(e:Event)=>{hold.current=(e as CustomEvent).detail;clearTimeout(timer);timer=setTimeout(()=>{hold.current=null;redraw(v=>v+1);},Math.max(0,hold.current!.until-Date.now()));};window.addEventListener(EVENT,start);return()=>{clearTimeout(timer);window.removeEventListener(EVENT,start);};},[]);
 if(snapshot?.state==='ROUND_ACTIVE')last.current=snapshot;
 const h=hold.current,previous=last.current;
 if(h&&previous&&snapshot&&snapshot.role==='player'&&h.roundId===previous.round?.id&&Date.now()<h.until&&snapshot.state!=='ROUND_ACTIVE'&&snapshot.state!=='SESSION_ABORTED')return {...previous,ownSubmission:snapshot.round?.id===h.roundId?snapshot.ownSubmission:previous.ownSubmission,deadlineAt:null};
 return snapshot;
}
/** Imperative animation keeps pointer motion off React's render loop. */
export function useTimeline(active:boolean,duration:number,paint:(progress:number)=>void,restored=false){
 const render=useRef(paint);render.current=paint;
 useEffect(()=>{if(!active)return;if(restored){render.current(1);return;}let frame=0;const start=performance.now();const tick=(now:number)=>{const p=Math.max(0,Math.min(1,(now-start)/duration));render.current(p);if(p<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[active,duration,restored]);
}
