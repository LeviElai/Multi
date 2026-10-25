'use client';
import {useEffect,useRef,useState,type CSSProperties,type PointerEvent} from 'react';
import type {Ack,ArcadeRound,PublicRound,Submission} from '../../../../packages/contracts/src/index';
import {useCommit,type Props,type Config} from './arcade-interaction';
import Stack from './StackGame';
import Draw from './DrawGame';
import {playCue} from '../../lib/audio';
import SlingGame from './SlingGame';
import ClawMachine from './ClawMachine';
import FishGame from './FishGame';
import TimedFishing from './TimedFishing';
import CrackGame from './CrackGame';
import {useTimeline} from './physical-motion';
import {plinkoPath,PLINKO_PEGS,type PlinkoPoint} from '../../../../packages/game-modes/src/physical';

export default function ArcadePlayer(p:Props){
 const c=p.round.publicConfig as Config;
 if(p.round.mode==='answer')return <p className="notice">This question needs a supported game. Ask the host to update it.</p>;
 return <section className={'arcade-game arcade-'+p.round.mode} aria-label={p.round.mode+' game'}>
 {p.round.mode==='fish'&&c.fishScoring==='catch-v1'?<TimedFishing {...p} config={c}/>:p.round.mode==='sling'?<Sling {...p} c={c}/>:p.round.mode==='claw'?<Claw {...p} c={c}/>:p.round.mode==='draw'?<Draw {...p} c={c}/>:p.round.mode==='stack'?<Stack {...p} c={c}/>:p.round.mode==='crack'?(c.crackScoring==='deduction-v1'?<CrackGame config={c} initial={p.initial} disabled={p.disabled} busy={p.busy} send={p.send}/>:<Crack {...p} c={c}/>):p.round.mode==='drop'?<Drop {...p}/>:<Choice {...p} c={c}/>}
 </section>;
}
function Sling(p:Props&{c:Config}){const {effect,commit,restored}=useCommit(p);return <SlingGame c={p.c} disabled={p.disabled||p.busy} effect={effect} restored={restored} onCommit={id=>void commit({choiceId:id},id)}/>;}
function Claw(p:Props&{c:Config}){const {effect,commit,restored}=useCommit(p);return <ClawMachine c={p.c} disabled={p.disabled||p.busy} effect={effect} restored={restored} onCommit={id=>void commit({choiceId:id},id)}/>;}
function Choice(p:Props&{c:Config}){
 const {effect,commit}=useCommit(p);
 return <FishGame config={p.c} disabled={p.disabled||p.busy} effect={effect} initial={p.initial} onCommit={commit}/>;
}
function Drop(p:Props){
 const {effect,commit,restored}=useCommit(p),ball=useRef<HTMLDivElement>(null),caption=useRef<HTMLSpanElement>(null),position=useRef(p.initial?.choiceId==='false'?75:25),fixed=useRef(!!p.initial?.locked),path=useRef<PlinkoPoint[]>([]),lastPathIndex=useRef(0),lastPeg=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(p.disabled||effect)return;let id=0;const start=performance.now();const frame=(now:number)=>{if(!fixed.current&&!document.hidden){position.current=8+(1-Math.cos((now-start)/1100))*42;if(ball.current)ball.current.style.left=position.current+'%';if(caption.current)caption.current.textContent=position.current<50?'TRUE':'FALSE';}id=requestAnimationFrame(frame);};id=requestAnimationFrame(frame);return()=>cancelAnimationFrame(id);},[p.disabled,effect]);
 useTimeline(!!effect,2600,t=>{const steps=path.current.length?path.current:[{x:effect==='true'?25:75,y:87}];const index=Math.min(steps.length-1,Math.floor(t*(steps.length-1))),pt=steps[index];for(let i=lastPathIndex.current;i<=index;i++){const peg=(steps[i] as PlinkoPoint).impact;if(peg!==undefined){if(lastPeg.current)lastPeg.current.style.filter='';lastPeg.current=ball.current?.parentElement?.querySelectorAll<HTMLElement>('.physical-peg')[peg]??null;if(lastPeg.current)lastPeg.current.style.filter='brightness(1.7)';playCue('adjust','drop');}}lastPathIndex.current=index+1;if(ball.current){ball.current.style.left=pt.x+'%';ball.current.style.top=pt.y+'%';ball.current.style.transform=`translate(-50%,-50%) rotate(${t*720}deg)`;}},restored);
 function select(x:number){if(effect)return;fixed.current=true;position.current=x;if(ball.current)ball.current.style.left=x+'%';if(caption.current)caption.current.textContent=x<50?'TRUE':'FALSE';}
 function drop(){const b=ball.current?.parentElement?.getBoundingClientRect();path.current=plinkoPath(position.current,b?b.width/b.height:1);lastPathIndex.current=0;void commit({choiceId:position.current<50?'true':'false'},position.current<50?'true':'false');}
 return <><p className="arcade-instruction">Drop on the left for True. Right for False.</p><div className="plinko-board" onPointerDown={e=>{if(p.disabled||p.busy||effect)return;const b=e.currentTarget.getBoundingClientRect();select(Math.max(8,Math.min(92,(e.clientX-b.left)/b.width*100)));}}><div className="plinko-divider"/>{PLINKO_PEGS.map((peg,i)=><i className="physical-peg" key={i} style={{left:peg.x+'%',top:peg.y+'%'}}/>)}<div ref={ball} className="plinko-ball" style={{left:p.initial?.choiceId==='false'?'75%':'25%',top:'8%'}} aria-hidden="true"/><div className="plinko-bins"><span>TRUE</span><span>FALSE</span></div></div><div className="arcade-action-row"><button className="btn btn-primary" disabled={p.disabled||p.busy||!!effect} onClick={()=>{select(25);drop();}}>Drop True</button><button className="btn btn-primary" disabled={p.disabled||p.busy||!!effect} onClick={()=>{select(75);drop();}}>Drop False</button></div>{effect&&<p className="arcade-locked" role="status">{effect==='true'?'True':'False'} · locked</p>}</>;
}
function Crack(p:Props&{c:Config}){
 const [digits,setDigits]=useState(String(p.initial?.value??0).padStart(p.c.codeLength,'0')),wheelDrag=useRef<{i:number;y:number}|null>(null),{effect,commit}=useCommit(p);const blocked=p.disabled||p.busy||!!effect;
 function turn(i:number,d:number){if(blocked)return;setDigits(raw=>raw.slice(0,i)+((Number(raw[i])+d)%10+10)%10+raw.slice(i+1));playCue('adjust','crack');}
 return <><p className="arcade-instruction">Turn the wheels. Pull the handle to lock your code.</p><div className={'vault-door '+(effect?'vault-sealed':'')}><span className="vault-rivet"/><div className="code-wheels">{Array.from({length:p.c.codeLength},(_,i)=><div className="code-wheel" key={i}><button disabled={blocked} aria-label={'Increase digit '+(i+1)} onClick={()=>turn(i,1)}>▲</button><output role="spinbutton" tabIndex={blocked?-1:0} aria-label={'Digit '+(i+1)} aria-valuenow={Number(digits[i])} aria-valuemin={0} aria-valuemax={9} onPointerDown={e=>{if(blocked)return;e.currentTarget.setPointerCapture(e.pointerId);wheelDrag.current={i,y:e.clientY};}} onPointerMove={e=>{const drag=wheelDrag.current;if(!drag||drag.i!==i||blocked)return;const steps=Math.trunc((drag.y-e.clientY)/18);if(steps){turn(i,steps);drag.y-=steps*18;}}} onPointerUp={()=>{wheelDrag.current=null;}} onPointerCancel={()=>{wheelDrag.current=null;}} onLostPointerCapture={()=>{wheelDrag.current=null;}} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();turn(i,e.key==='ArrowUp'?1:-1);}}}><span key={digits[i]}>{digits[i]}</span></output><button disabled={blocked} aria-label={'Decrease digit '+(i+1)} onClick={()=>turn(i,-1)}>▼</button></div>)}</div><button className="vault-handle" disabled={blocked} aria-label="Pull safe handle to lock code" onClick={()=>void commit({value:Number(digits)},'sealed')}><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M28 4h8v20l4 4h20v8H40l-4 4v20h-8V40l-4-4H4v-8h20l4-4z" fill="currentColor"/><circle cx="32" cy="32" r="10" fill="#a9b9b6" stroke="#405668" strokeWidth="4"/></svg></button><output className="safe-code-display" aria-label="Current code">{digits}</output></div>{effect&&<p className="arcade-locked" role="status">Combination sealed · {digits}</p>}</>;
}
