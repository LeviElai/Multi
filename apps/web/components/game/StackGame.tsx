'use client';
import {useEffect,useRef,useState,type CSSProperties,type PointerEvent} from 'react';
import {useCommit,type Props,type Config} from './arcade-interaction';
import {stableStack} from '../../../../packages/game-modes/src/stack';
import SubmissionReaction from './SubmissionReaction';
import {playCue} from '../../lib/audio';
export default function Stack(p:Props&{c:Config}){
 type Block={value:number;x:number};const [pile,setPile]=useState({blocks:p.initial?.blocks??[] as Block[],base:p.initial?.blocks?0:p.initial?.value??0}),{blocks,base}=pile,[denomination,setDenomination]=useState(p.c.blockValues.find(v=>v>=10&&v===p.c.blockValues[1])??1),[x,setX]=useState(50),[held,setHeld]=useState(false),[falling,setFalling]=useState(false),[miss,setMiss]=useState(false),[feedback,setFeedback]=useState(''),stage=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),{effect,commit}=useCommit(p);
 const [visibleBlocks,setVisibleBlocks]=useState(3);
 useEffect(()=>{const element=stage.current;if(!element)return;const observer=new ResizeObserver(()=>setVisibleBlocks(Math.max(1,Math.min(6,Math.floor((element.clientHeight-110)/28)))));observer.observe(element);return()=>observer.disconnect();},[]);
 const total=base+blocks.reduce((a,b)=>a+b.value,0),blocked=p.disabled||p.busy||!!effect||falling;
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 function move(e:PointerEvent){const b=stage.current!.getBoundingClientRect();setX(Math.max(12,Math.min(88,(e.clientX-b.left)/b.width*100)));}
 function place(){
  if(blocked||blocks.length>=128||total+denomination>p.c.max)return;
  const next=[...blocks,{value:denomination,x}],stable=stableStack(next);
  setHeld(false);setMiss(!stable);setFalling(true);playCue('pour','stack');
  timer.current=setTimeout(()=>{
   if(stable){setPile(previous=>({...previous,blocks:next}));setFeedback('Solid placement');playCue('adjust','stack');}
   else{setFeedback('Too much overhang — block fell');playCue('error','stack');}
   setFalling(false);setMiss(false);
  },stable?450:700);
 }

 if(effect)return <SubmissionReaction mode="stack" value={total.toLocaleString()+" "+p.c.unit} animate/>;
 return <><p className="arcade-instruction">Drop blocks to build your answer.</p><div ref={stage} className={'stack-yard '+(falling?'block-falling':'')+(miss?' block-unsupported':'')} style={{'--placement':x+'%','--tower-height':(Math.min(visibleBlocks,blocks.length)*28+(blocks.length>visibleBlocks||base>0?12:0))+'px'} as CSSProperties}><div className="stack-crane" aria-hidden="true"/><div className="stack-tower" aria-label="Your stack">{(base>0||blocks.length>visibleBlocks)&&<span className="stack-block packed-block">{(base+blocks.slice(0,-visibleBlocks).reduce((sum,b)=>sum+b.value,0)).toLocaleString()} below</span>}{blocks.slice(-visibleBlocks).map((b,i)=><span key={i} className="stack-block" style={{transform:`translateX(${b.x-50}cqw)`}}>{b.value.toLocaleString()}</span>)}</div><button className={'ready-block '+(held?'is-held':'')} disabled={blocked} aria-label="Drag and release block" onPointerDown={e=>{if(blocked)return;e.currentTarget.setPointerCapture(e.pointerId);setHeld(true);move(e);}} onPointerMove={e=>{if(held)move(e);}} onPointerUp={e=>{if(held){e.currentTarget.releasePointerCapture(e.pointerId);place();}}} onPointerCancel={()=>setHeld(false)} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();setX(v=>Math.max(12,v-3));}if(e.key==='ArrowRight'){e.preventDefault();setX(v=>Math.min(88,v+3));}if(e.key===' '||e.key==='Enter'){e.preventDefault();place();}}}><span>{denomination.toLocaleString()}</span></button><output className="stack-total" aria-live="polite">{total.toLocaleString()} <small>{p.c.unit}</small></output><span className="stack-loading-mark" aria-hidden="true">↓</span></div><fieldset className="stack-denominations"><legend>Each block = {denomination.toLocaleString()} {p.c.unit}</legend>{p.c.blockValues.map(v=><button key={v} className="btn btn-outline" aria-pressed={denomination===v} disabled={blocked} onClick={()=>setDenomination(v)}>{v.toLocaleString()}</button>)}</fieldset><div className="arcade-action-row"><button className="btn btn-primary" disabled={blocked||total+denomination>p.c.max} onClick={place}>Place +{denomination.toLocaleString()}</button><button className="btn btn-outline" disabled={blocked||!blocks.length} onClick={()=>setPile(previous=>({...previous,blocks:previous.blocks.slice(0,-1)}))}>Undo placement</button><button className="btn btn-primary" disabled={blocked} onClick={()=>void commit({value:total,...(p.c.stackPhysics==='support-v1'?{blocks}:{})},'stacked')}>Seal stack · {total.toLocaleString()}</button></div><small className="control-hint" role="status">{feedback}</small></>;
}
