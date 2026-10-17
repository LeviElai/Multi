'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {ArcadeRound} from '../../../../packages/contracts/src/index';
import {useTimeline} from './physical-motion';
import {playCue} from '../../lib/audio';
type Phase='IDLE'|'AIMING'|'DROPPING'|'GRABBING'|'LIFTING'|'RETURNING'|'RELEASING'|'COMPLETE';
type Geometry={start:number;target:number;head:number;chuteX:number;chuteY:number;paint:CSSProperties};
/** The capsule and gripping arms use the same board coordinates throughout the cycle. */
export default function ClawMachine({c,disabled,effect,restored,onCommit}:{c:ArcadeRound['publicConfig'];disabled:boolean;effect:string;restored:boolean;onCommit:(id:string)=>void}){
 const board=useRef<HTMLDivElement>(null),carriage=useRef<HTMLDivElement>(null),cable=useRef<HTMLDivElement>(null),prize=useRef<HTMLDivElement>(null),direction=useRef(0),position=useRef(50/c.options.length),selected=useRef(0),dropRef=useRef(()=>{}),geom=useRef<Geometry>({start:50,target:50,head:170,chuteX:90,chuteY:300,paint:{}});
 const [aim,setAim]=useState(0),[phase,setPhase]=useState<Phase>('IDLE'),last=useRef<Phase>('IDLE');const blocked=disabled||!!effect;
 function moveDirection(d:number){direction.current=d;if(!blocked&&d){last.current='AIMING';setPhase('AIMING');}}
 useEffect(()=>{if(blocked){direction.current=0;return;}let frame=0,previous=performance.now();const stop=()=>{direction.current=0;};
  const tick=(now:number)=>{const dt=Math.min(.04,(now-previous)/1000);previous=now;if(direction.current){position.current=Math.max(7,Math.min(93,position.current+direction.current*33*dt));const i=Math.min(c.options.length-1,Math.floor(position.current/100*c.options.length));selected.current=i;setAim(v=>v===i?v:i);if(carriage.current)carriage.current.style.left=position.current+'%';if(cable.current)cable.current.style.left=position.current+'%';}frame=requestAnimationFrame(tick);};
  const key=(e:KeyboardEvent)=>{const target=e.target as Element;if(target?.matches('input,textarea,select')||target!==document.body&&!board.current?.closest('.arcade-claw')?.contains(target))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();moveDirection(e.key==='ArrowLeft'?-1:1);}if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();stop();dropRef.current();}};
  const up=(e:KeyboardEvent)=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight')stop();};window.addEventListener('keydown',key);window.addEventListener('keyup',up);window.addEventListener('blur',stop);frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);stop();window.removeEventListener('keydown',key);window.removeEventListener('keyup',up);window.removeEventListener('blur',stop);};
 },[blocked,c.options.length]);
 useTimeline(!!effect,3200,t=>{const g=geom.current,phase:Phase=t<.25?'DROPPING':t<.38?'GRABBING':t<.63?'LIFTING':t<.83?'RETURNING':t<.98?'RELEASING':'COMPLETE';
  if(phase!==last.current){last.current=phase;setPhase(phase);if(phase==='GRABBING'||phase==='RELEASING')playCue('adjust','claw');}
  const down=t<.25?t/.25:t<.38?1:t<.63?1-(t-.38)/.25:0;
  const x=t<.25?g.start+(g.target-g.start)*Math.min(1,t/.18):t<.63?g.target:t<.83?g.target+(g.chuteX-g.target)*(t-.63)/.2:g.chuteX,y=76+(g.head-76)*down;
  if(carriage.current){carriage.current.style.left=x+'%';carriage.current.style.top=y+'px';carriage.current.dataset.phase=phase;}
  if(cable.current){cable.current.style.left=x+'%';cable.current.style.height=Math.max(4,y-44)+'px';}
  const attached=t>=.32,source=board.current?.querySelector<HTMLElement>('[data-capsule="'+selected.current+'"]');if(source)source.style.visibility=attached?'hidden':'visible';
  if(prize.current){prize.current.style.visibility=attached?'visible':'hidden';prize.current.style.left=x+'%';const release=Math.max(0,Math.min(1,(t-.83)/.15));prize.current.style.top=(t<.83?y+27:103+(g.chuteY-103)*release*release)+'px';}
 },restored);
 function drop(){if(blocked)return;direction.current=0;const el=board.current;if(!el)return;const b=el.getBoundingClientRect(),source=el.querySelector<HTMLElement>('[data-capsule="'+selected.current+'"]'),chute=el.querySelector<HTMLElement>('.prize-chute');if(!source||!chute)return;const r=source.getBoundingClientRect(),ch=chute.getBoundingClientRect(),paint=getComputedStyle(source);geom.current={start:position.current,target:(r.left+r.width/2-b.left-el.clientLeft)/el.clientWidth*100,head:r.top-b.top-el.clientTop-27,chuteX:(ch.left+ch.width/2-b.left-el.clientLeft)/el.clientWidth*100,chuteY:ch.top-b.top-el.clientTop+8,paint:{background:paint.background,boxShadow:paint.boxShadow}};onCommit(c.options[selected.current].id);}
 dropRef.current=drop;
 return <><p className="arcade-instruction">Line up your answer. Drop the claw to collect it.</p><div ref={board} className="prize-machine" data-phase={phase}>
 <div className="machine-marquee">THE PRIZE PARLOUR</div><div className="prize-rail"/><div ref={cable} className="prize-cable" style={{left:(50/c.options.length)+'%',height:32}}/>
 <div className="prize-shelf">{c.options.map((o,i)=><div key={o.id} className={'prize-slot '+(i===aim?'is-aimed':'')}><span data-capsule={i} className={'prize-capsule capsule-'+i}/><strong>{o.label}</strong></div>)}</div>
 <div ref={prize} className="prize-in-transit" aria-hidden="true"><span className="prize-capsule" style={geom.current.paint}/><strong>{c.options.find(o=>o.id===effect)?.label}</strong></div>
 <div ref={carriage} className="prize-gripper" style={{left:(50/c.options.length)+'%',top:76}} aria-hidden="true"><svg viewBox="0 0 64 64" shapeRendering="crispEdges"><path d="M28 0h8v21h-8zM15 20h34v14H15z" fill="#f4cf89"/><path className="grip-left" d="M17 30h8v17h-8v10H8V45h9z" fill="#c8e7dd"/><path className="grip-right" d="M39 30h8v15h9v12h-9V47h-8z" fill="#c8e7dd"/><path d="M20 22h24v5H20z" fill="#fff0bd"/></svg></div>
 <div className="prize-chute"><span>COLLECT</span></div><span className="machine-lamp" aria-hidden="true"/>
 </div><div className="claw-controls">{[-1,1].map(d=><button key={d} className="btn btn-outline claw-arrow" aria-label={d<0?'Move claw left':'Move claw right'} disabled={blocked} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);moveDirection(d);}} onPointerUp={()=>moveDirection(0)} onPointerCancel={()=>moveDirection(0)} onLostPointerCapture={()=>moveDirection(0)} onBlur={()=>moveDirection(0)}>{d<0?'←':'→'}</button>)}<button className="btn btn-primary" disabled={blocked} onClick={drop}>{effect?(phase==='COMPLETE'?'Collected ✓':'Collecting…'):'Drop claw'}</button></div><small className="control-hint">Hold ← or → to move. Space or Enter to drop.</small>{effect&&<p role="status" className="claw-status">{c.options.find(o=>o.id===effect)?.label} · {phase==='COMPLETE'?'locked':'collecting'}</p>}</>;
}
