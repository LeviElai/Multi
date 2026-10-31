'use client';
import {useEffect,useRef,useState,type CSSProperties,type PointerEvent} from 'react';
import {useCommit,type Props,type Config} from './arcade-interaction';
import {stableStack,stackStability,stackFailureIndex} from '../../../../packages/game-modes/src/stack';
import SubmissionReaction from './SubmissionReaction';
import {playCue} from '../../lib/audio';
export default function Stack(p:Props&{c:Config}){
 type Block={value:number;x:number};const [pile,setPile]=useState({blocks:p.initial?.blocks??[] as Block[],base:p.initial?.blocks?0:p.initial?.value??0}),{blocks,base}=pile,[denomination,setDenomination]=useState(p.c.blockValues.find(v=>v>=10&&v===p.c.blockValues[1])??1),[x,setX]=useState(50),xRef=useRef(50),heldRef=useRef(false),placingRef=useRef(false),[held,setHeld]=useState(false),[falling,setFalling]=useState(false),[miss,setMiss]=useState(false),[collapse,setCollapse]=useState(false),[feedback,setFeedback]=useState(''),stage=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),{effect,commit}=useCommit(p);
 const [visibleBlocks,setVisibleBlocks]=useState(3);
 useEffect(()=>{const element=stage.current;if(!element)return;const observer=new ResizeObserver(()=>setVisibleBlocks(Math.max(1,Math.min(6,Math.floor((element.clientHeight-110)/28)))));observer.observe(element);return()=>observer.disconnect();},[]);
 const total=base+blocks.reduce((a,b)=>a+b.value,0),blocked=p.disabled||p.busy||!!effect||falling;
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 function move(e:PointerEvent){const b=stage.current!.getBoundingClientRect();xRef.current=Math.max(12,Math.min(88,(e.clientX-b.left)/b.width*100));setX(xRef.current);}
 function place(){
  if(blocked||placingRef.current||blocks.length>=128||total+denomination>p.c.max)return;
  placingRef.current=true;
  const next=[...blocks,{value:denomination,x:xRef.current}],failure=stackFailureIndex(next),stable=failure===-1;
  setHeld(false);setMiss(!stable);setCollapse(failure>=0&&failure<blocks.length);setFalling(true);playCue('pour','stack');
  timer.current=setTimeout(()=>{
   if(stable){setPile(previous=>({...previous,blocks:next}));setFeedback(stackStability(next)<.45?'Wobbly!':'Solid placement');playCue('adjust','stack');}
   else{if(failure<blocks.length)setPile(previous=>({...previous,blocks:previous.blocks.slice(0,failure)}));setFeedback(failure<blocks.length?'Tower tipped!':'Block fell');playCue('error','stack');}
   placingRef.current=false;setFalling(false);setMiss(false);setCollapse(false);
  },stable?450:700);
 }

 if(effect)return <SubmissionReaction mode="stack" value={total.toLocaleString()+" "+p.c.unit} animate/>;
 return <><p className="arcade-instruction">Drag the block. Release to drop.</p><div ref={stage} className={'stack-yard '+(falling?'block-falling':'')+(miss?' block-unsupported':'')+(collapse?' tower-collapse':'')} data-support={stableStack([...blocks,{value:denomination,x}])?'solid':'fall'} style={{'--placement':x+'%','--tower-height':(Math.min(visibleBlocks,blocks.length)*28+(blocks.length>visibleBlocks||base>0?12:0))+'px'} as CSSProperties}><div className="stack-crane" aria-hidden="true"/><div className="stack-tower" aria-label="Your stack">{(base>0||blocks.length>visibleBlocks)&&<span className="stack-block packed-block">{(base+blocks.slice(0,-visibleBlocks).reduce((sum,b)=>sum+b.value,0)).toLocaleString()} below</span>}{blocks.slice(-visibleBlocks).map((b,i)=><span key={i} className="stack-block" style={{transform:`translateX(${b.x-50}cqw)`}}>{b.value.toLocaleString()}</span>)}</div><button className={'ready-block '+(held?'is-held':'')} disabled={blocked} aria-label="Drag and release block" onPointerDown={e=>{if(blocked)return;e.currentTarget.setPointerCapture(e.pointerId);heldRef.current=true;setHeld(true);move(e);}} onPointerMove={e=>{if(heldRef.current)move(e);}} onPointerUp={e=>{if(heldRef.current){move(e);heldRef.current=false;setHeld(false);e.currentTarget.releasePointerCapture(e.pointerId);place();}}} onPointerCancel={()=>{heldRef.current=false;setHeld(false);}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();xRef.current=Math.max(12,Math.min(88,xRef.current+(e.key==='ArrowLeft'?-3:3)));setX(xRef.current);}if(e.key===' '||e.key==='Enter'){e.preventDefault();place();}}}><span>{denomination.toLocaleString()}</span></button><output className="stack-total" aria-live="polite">{total.toLocaleString()} <small>{p.c.unit}</small></output><span className="stack-loading-mark" aria-hidden="true">↓</span></div><fieldset className="stack-denominations"><legend>Each block = {denomination.toLocaleString()} {p.c.unit}</legend>{p.c.blockValues.map(v=><button key={v} className="btn btn-outline" aria-pressed={denomination===v} disabled={blocked} onClick={()=>setDenomination(v)}>{v.toLocaleString()}</button>)}</fieldset><div className="arcade-action-row"><button className="btn btn-primary" disabled={blocked||total+denomination>p.c.max} onClick={place}>Drop +{denomination.toLocaleString()}</button><button className="btn btn-outline" disabled={blocked||!blocks.length} onClick={()=>setPile(previous=>({...previous,blocks:previous.blocks.slice(0,-1)}))}>Undo</button><button className="btn btn-primary" disabled={blocked} onClick={()=>void commit({value:total,...(p.c.stackPhysics==='support-v1'?{blocks}:{})},'stacked')}>Seal · {total.toLocaleString()}</button></div><small className="control-hint" role="status">{feedback}</small></>;
}
