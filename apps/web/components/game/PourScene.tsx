'use client';
import {useEffect,useRef} from 'react';
import {createBody,stepBodies,MAX_BODIES,type Body} from '../../lib/pour-physics';
const colors=['#ef9b5e','#80c5b6','#b6a5d7','#e5c36a','#7dadd0'];
export default function PourScene({count,seed}:{count:number;seed:string}){
 const canvas=useRef<HTMLCanvasElement>(null);const desired=useRef(count);const wake=useRef<()=>void>(()=>{});
 useEffect(()=>{desired.current=count;wake.current()},[count]);
 useEffect(()=>{const el=canvas.current;if(!el)return;const ctx=el.getContext('2d');if(!ctx)return;const bodies:Body[]=[];let rendered=0,raf=0,last=0,activeUntil=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const project=(x:number,y:number,z:number)=>({x:180+x*.92+z*.4,y:325-y-z*.25});
  const polygon=(points:number[][],fill:string,stroke='#8eafb4')=>{ctx.beginPath();points.forEach((p,i)=>{const v=project(p[0],p[1],p[2]);if(i)ctx.lineTo(v.x,v.y);else ctx.moveTo(v.x,v.y)});ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()};
  function draw(){ctx!.clearRect(0,0,360,370);ctx!.fillStyle='#142d3b';ctx!.fillRect(0,0,360,370);
   polygon([[-110,0,-65],[110,0,-65],[110,250,-65],[-110,250,-65]],'#1a3848','#426774');
   polygon([[-110,0,-65],[110,0,-65],[110,0,65],[-110,0,65]],'#2d4a56','#67868d');
   polygon([[-110,0,-65],[-110,0,65],[-110,250,65],[-110,250,-65]],'#224250','#547782');
   for(const b of [...bodies].sort((a,b)=>a.z-b.z||a.y-b.y)){
    const p=project(b.x,b.y,b.z),r=b.r;ctx!.save();ctx!.translate(p.x,p.y);ctx!.rotate(b.angle*.3);const color=colors[b.color];
    if(b.shape===0){ctx!.fillStyle=color;ctx!.fillRect(-r,-r,r*1.6,r*1.6);ctx!.beginPath();ctx!.moveTo(-r,-r);ctx!.lineTo(-r+5,-r-5);ctx!.lineTo(r*.6+5,-r-5);ctx!.lineTo(r*.6,-r);ctx!.closePath();ctx!.fillStyle='#f5ead4';ctx!.fill();ctx!.beginPath();ctx!.moveTo(r*.6,-r);ctx!.lineTo(r*.6+5,-r-5);ctx!.lineTo(r*.6+5,r*.6-5);ctx!.lineTo(r*.6,r*.6);ctx!.closePath();ctx!.fillStyle='#487181';ctx!.fill();}
    else if(b.shape===1){const g=ctx!.createRadialGradient(-3,-4,1,0,0,r);g.addColorStop(0,'#fff0d2');g.addColorStop(.3,color);g.addColorStop(1,'#325367');ctx!.fillStyle=g;ctx!.beginPath();ctx!.arc(0,0,r,0,Math.PI*2);ctx!.fill();}
    else {ctx!.beginPath();ctx!.moveTo(0,-r*1.25);ctx!.lineTo(r,r);ctx!.lineTo(-r,r);ctx!.closePath();ctx!.fillStyle=color;ctx!.fill();ctx!.beginPath();ctx!.moveTo(0,-r*1.25);ctx!.lineTo(0,r*.5);ctx!.lineTo(r,r);ctx!.closePath();ctx!.fillStyle='#f6d4a1';ctx!.fill();}
    ctx!.restore();
   }
   polygon([[-110,0,65],[110,0,65],[110,250,65],[-110,250,65]],'#9ed5d509','#8bb5bd');
   polygon([[110,0,-65],[110,0,65],[110,250,65],[110,250,-65]],'#b6eff00c','#6e9eaa');
   ctx!.strokeStyle='#c4e6db';ctx!.lineWidth=3;ctx!.beginPath();for(const [i,v] of [[-110,250,65],[110,250,65],[110,250,-65],[-110,250,-65],[-110,250,65]].entries()){const p=project(...v as [number,number,number]);if(i)ctx!.lineTo(p.x,p.y);else ctx!.moveTo(p.x,p.y)}ctx!.stroke();
  }
  function frame(time:number){raf=0;if(document.hidden){last=0;return;}const dt=last?Math.min((time-last)/1000,1/30):1/60;last=time;
   const target=Math.min(MAX_BODIES,desired.current);if(target<rendered){bodies.length=0;rendered=0;}
   let spawned=0;while(rendered<target&&spawned<4){const b=createBody(seed,rendered++);if(reduced){const i=rendered-1;b.x=-80+(i%10)*17;b.z=-45+(Math.floor(i/10)%5)*18;b.y=8+Math.floor(i/50)*18;b.vy=0;}bodies.push(b);spawned++;activeUntil=time+4500;}
   if(!reduced)stepBodies(bodies,dt);draw();if(rendered<target||(!reduced&&time<activeUntil))raf=requestAnimationFrame(frame);
  }
  const start=()=>{if(!raf){last=0;raf=requestAnimationFrame(frame)}};wake.current=start;
  const resize=()=>{const dpr=Math.min(devicePixelRatio||1,1.5);el.width=360*dpr;el.height=370*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw()};resize();start();document.addEventListener('visibilitychange',start);return()=>{cancelAnimationFrame(raf);wake.current=()=>{};document.removeEventListener('visibilitychange',start)};
 },[seed]);
 return <canvas ref={canvas} className="pour-scene" role="img" aria-label="A transparent container with falling geometric objects"/>;
}
