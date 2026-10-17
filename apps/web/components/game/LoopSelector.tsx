'use client';
import {useRef,type ReactNode} from 'react';
export const wrapOption=(value:number,count:number)=>((value%count)+count)%count;
export function optionWindow(value:number,count:number){const radius=count<5?1:2;return Array.from({length:radius*2+1},(_,i)=>wrapOption(value+i-radius,count));}
/** One short, replaceable animation; no queued transitions or autoplay. */
export function LoopSelector({label,value,count,name,onChange,renderItem}:{label:string;value:number;count:number;name:(value:number)=>string;onChange:(value:number)=>void;renderItem:(value:number)=>ReactNode}){
 const track=useRef<HTMLDivElement>(null),animation=useRef<Animation|null>(null),start=useRef<{x:number;y:number}|null>(null),swiped=useRef(false);
 function select(next:number,direction:number){animation.current?.cancel();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)animation.current=track.current?.animate([{transform:`translateX(${direction*14}px)`},{transform:'translateX(0)'}],{duration:140,easing:'ease-out'})??null;onChange(wrapOption(next,count));}
 const options=optionWindow(value,count);
 return <section className="outfit-selector" aria-label={label}>
 <div className="selector-label"><strong>{label}</strong><span>{name(value)}</span></div>
 <div className="selector-belt" role="group" aria-label={`${label}: ${name(value)}`} tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();select(value+(e.key==='ArrowRight'?1:-1),e.key==='ArrowRight'?1:-1);}if(e.key==='Home'||e.key==='End'){e.preventDefault();select(e.key==='Home'?0:count-1,1);}}}>
 <button type="button" className="belt-arrow" aria-label={`Previous ${label.toLowerCase()}`} onClick={()=>select(value-1,-1)}>‹</button>
 <div className="belt-window" onPointerDown={e=>{start.current={x:e.clientX,y:e.clientY};swiped.current=false;}} onPointerCancel={()=>{start.current=null;}} onPointerUp={e=>{const p=start.current;start.current=null;if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.abs(dx)>30&&Math.abs(dx)>Math.abs(dy)*1.2){swiped.current=true;select(value+(dx<0?1:-1),dx<0?1:-1);}}} onClickCapture={e=>{if(swiped.current){e.preventDefault();e.stopPropagation();swiped.current=false;}}}>
 <div ref={track} className="belt-items">{options.map((item,index)=><button type="button" className="belt-item" key={index} aria-label={`${label}: ${name(item)}`} aria-pressed={item===value} onClick={()=>select(item,index-Math.floor(options.length/2))}>{renderItem(item)}</button>)}</div>
 </div>
 <button type="button" className="belt-arrow" aria-label={`Next ${label.toLowerCase()}`} onClick={()=>select(value+1,1)}>›</button>
 </div></section>;
}
