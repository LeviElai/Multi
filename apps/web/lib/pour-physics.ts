/** Screen-space candy collisions. Visual state never determines accepted quantity or score. */
export type Body={x:number;y:number;z:number;vx:number;vy:number;vz:number;r:number;angle:number;spin:number;shape:number;color:number};
export const MAX_BODIES=128;
export function seededValue(seed:string,index:number){let h=2166136261;for(const c of seed+':'+index)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967296;}
export function createBody(seed:string,index:number):Body{return{x:(seededValue(seed,index*7)-.5)*75,y:268+index%4*26,z:0,vx:(seededValue(seed,index*7+2)-.5)*90,vy:-15,vz:0,r:10,angle:0,spin:0,shape:index%3,color:index%5};}
export function settleBodies(bodies:Body[],passes=1024){
 for(let pass=0;pass<passes;pass++){
  let overlap=false;
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
   const a=bodies[i],b=bodies[j];let dx=b.x-a.x,dy=b.y-a.y;
   const diameter=a.r+b.r,distanceSquared=dx*dx+dy*dy;if(distanceSquared>=(diameter-.001)**2)continue;overlap=true;let d=Math.sqrt(distanceSquared);
   if(d<.001){dx=.001;dy=.001;d=Math.hypot(dx,dy);}
   const nx=dx/d,ny=dy/d,shift=(diameter-d+.001)*.5;
   a.x-=nx*shift;a.y-=ny*shift;b.x+=nx*shift;b.y+=ny*shift;
   const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
   if(closing<0){const impulse=-closing*.52;a.vx-=nx*impulse;a.vy-=ny*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse;}
   a.vx*=.993;b.vx*=.993;
  }
  for(const b of bodies){b.y=Math.max(b.r,b.y);b.x=Math.max(-110+b.r,Math.min(110-b.r,b.x));b.z=0;b.vz=0;}
  if(!overlap)break;
 }
}
export function stepBodies(bodies:Body[],dt:number){
 const duration=Math.min(Math.max(dt,0),1/20),steps=Math.max(1,Math.ceil(duration/(1/120)));
 for(let i=0;i<steps;i++){
  const t=duration/steps;
  for(const b of bodies){b.vy-=450*t;b.x+=b.vx*t;b.y+=b.vy*t;if(b.y<b.r){b.y=b.r;b.vy=Math.abs(b.vy)*.08;b.vx*=.85;}
   if(Math.abs(b.x)>110-b.r){b.x=Math.sign(b.x)*(110-b.r);b.vx*=-.25;}}
  settleBodies(bodies,24);
 }
 return bodies.reduce((sum,b)=>sum+Math.abs(b.vx)+Math.abs(b.vy),0);
}
