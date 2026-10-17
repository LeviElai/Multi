'use client';
import {useEffect,useRef} from 'react';
import {createBody,stepBodies,MAX_BODIES,settleBodies,type Body} from '../../lib/pour-physics';
const palette=[['#ffd487','#c27c51','#fff0bf'],['#91d8cb','#419d9b','#caffdf'],['#bca7e5','#7862ac','#efdaff'],['#f3a3a9','#b96987','#ffd6bd'],['#92bde7','#537bb6','#c6e5ff']];
export default function PourScene({count,seed,finalFraction=1,paused=false}:{paused?:boolean;count:number;seed:string;finalFraction?:number}){
 const pausedRef=useRef(paused);pausedRef.current=paused;
 const canvas=useRef<HTMLCanvasElement>(null),desired=useRef(count),fraction=useRef(finalFraction),wake=useRef(()=>{});
 desired.current=count;fraction.current=finalFraction;
 useEffect(()=>wake.current(),[count,finalFraction,paused]);
 useEffect(()=>{
  const el=canvas.current,ctx=el?.getContext('2d');if(!el||!ctx)return;
  el.width=360;el.height=370;ctx.imageSmoothingEnabled=false;
  const bodies:Body[]=[];let rendered=0,raf=0,last=0,until=0;
  const low=navigator.hardwareConcurrency<=4||matchMedia('(max-width:600px)').matches;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const box=(x:number,y:number,w:number,h:number,c:string)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const draw=()=>{
   ctx.clearRect(0,0,360,370);box(0,0,360,370,'#253044');
   for(let y=0;y<340;y+=16)for(let x=0;x<360;x+=32)box(x+(y%32?16:0),y,30,14,'#2d374a');
   box(22,335,316,12,'#e5b77c');box(22,347,316,5,'#926852');
   box(64,329,232,6,'#15263a');
   // Stepped glass silhouette with dark interior and two-pixel highlights.
   box(54,67,252,251,'#14283a');box(62,61,236,266,'#1b3847');
   box(64,72,232,247,'#203e4a');box(73,81,214,231,'#244652');
   for(const b of [...bodies].sort((a,b)=>a.z-b.z||a.y-b.y)){
    const x=Math.round(180+b.x),y=Math.round(310-b.y);
    const r=Math.max(2,Math.round((b.r-2)*(b===bodies[bodies.length-1]?Math.cbrt(fraction.current):1)));
    const [base,shade,shine]=palette[b.color%palette.length];
    ctx.save();ctx.translate(x,y);ctx.rotate(b.angle);
    const facet=(points:number[][],color:string)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fill();};
    facet([[0,-r],[-r,-r*.25],[-r*.65,r*.8],[r*.55,r],[r,r*.05],[r*.55,-r*.65]],base);
    facet([[0,-r],[-r,-r*.25],[0,0]],shine);
    facet([[0,0],[-r,-r*.25],[-r*.65,r*.8],[0,r*.35]],base);
    facet([[0,0],[r*.55,-r*.65],[r,r*.05],[r*.55,r],[0,r*.35]],shade);
    facet([[0,-r],[r*.55,-r*.65],[0,0]],base);
    facet([[0,r*.35],[-r*.65,r*.8],[r*.55,r]],shine);
    ctx.restore();
   }
   box(54,67,5,251,'#6b9d9d');box(301,67,5,251,'#628b91');
   box(59,73,3,237,'#a5c3b6');box(67,85,3,195,'#ffffff20');
   box(65,320,230,7,'#7ba5a2');box(74,327,212,4,'#b2c6ac');
   ctx.strokeStyle='#a6c7be';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(180,64,123,14,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#a2d7cf0d';ctx.fillRect(64,78,232,237);
   box(58,61,244,5,'#a6c7be');box(58,67,244,3,'#638f92');
   box(159,8,42,10,'#ddb47c');box(166,18,28,14,'#a17e65');
   box(169,32,22,5,'#f4d497');
  };
  const frame=(time:number)=>{
   raf=0;if(pausedRef.current){draw();return;}if(document.hidden){last=0;return;}
   if(low&&last&&time-last<32){raf=requestAnimationFrame(frame);return;}
   const dt=last?Math.min((time-last)/1000,1/30):1/60;last=time;
   const target=Math.min(MAX_BODIES,desired.current);
   if(target<rendered){bodies.length=0;rendered=0;}
   let spawned=0;while(rendered<target&&spawned++<4){
    const b=createBody(seed,rendered++);
    if(reduced){const i=rendered-1;b.x=-100+i%11*20;b.z=0;b.y=10+Math.floor(i/11)*20;b.vy=0;}
    bodies.push(b);until=time+4000;
   }
   if(!reduced)stepBodies(bodies,dt);if(!reduced&&time>=until)settleBodies(bodies);draw();
   if(rendered<target||(!reduced&&time<until))raf=requestAnimationFrame(frame);
  };
  const start=()=>{if(!raf){last=0;raf=requestAnimationFrame(frame);}};
  wake.current=start;start();document.addEventListener('visibilitychange',start);
  return()=>{cancelAnimationFrame(raf);wake.current=()=>{};document.removeEventListener('visibilitychange',start);};
 },[seed]);
 return <canvas ref={canvas} className="pour-scene" role="img" aria-label="Pixel sweets falling into a glass jar. The picture shows accepted pours."/>;
}
