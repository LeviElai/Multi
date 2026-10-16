/** Visual-only 3D sphere-bound collision solver. No gameplay state is derived from bodies. */
export type Body={x:number;y:number;z:number;vx:number;vy:number;vz:number;r:number;angle:number;spin:number;shape:number;color:number};
export const MAX_BODIES=96;
export function seededValue(seed:string,index:number){let h=2166136261;for(const c of seed+':'+index){h=Math.imul(h^c.charCodeAt(0),16777619)}return (h>>>0)/4294967296;}
export function createBody(seed:string,index:number):Body{const r=11;return {x:(seededValue(seed,index*7)-.5)*90,y:260+index%3*18,z:(seededValue(seed,index*7+1)-.5)*65,vx:(seededValue(seed,index*7+2)-.5)*65,vy:-10,vz:(seededValue(seed,index*7+3)-.5)*30,r,angle:seededValue(seed,index*7+4)*Math.PI,spin:(seededValue(seed,index*7+5)-.5)*5,shape:Math.floor(seededValue(seed,index*7+6)*3),color:index%5};}
export function stepBodies(bodies:Body[],dt:number){
 const step=Math.min(dt,1/30);let energy=0;
 for(const b of bodies){b.vy-=450*step;b.x+=b.vx*step;b.y+=b.vy*step;b.z+=b.vz*step;b.angle+=b.spin*step;b.spin*=.995;
  if(b.y<b.r){b.y=b.r;b.vy=Math.abs(b.vy)*.24;b.vx*=.92;b.vz*=.92;b.spin*=.8;}
  for(const axis of ['x','z'] as const){const limit=(axis==='x'?110:65)-b.r;if(Math.abs(b[axis])>limit){b[axis]=Math.sign(b[axis])*limit;if(axis==='x')b.vx*=-.4;else b.vz*=-.4;}}
 }
 for(let pass=0;pass<3;pass++)for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  const a=bodies[i],b=bodies[j];let dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;let d=Math.hypot(dx,dy,dz);const rr=a.r+b.r;if(d>=rr)continue;if(d<.001){dx=.01;d=.01;}const nx=dx/d,ny=dy/d,nz=dz/d,overlap=(rr-d)*.51;
  a.x-=nx*overlap;a.y-=ny*overlap;a.z-=nz*overlap;b.x+=nx*overlap;b.y+=ny*overlap;b.z+=nz*overlap;
  const v=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny+(b.vz-a.vz)*nz;if(v<0){const impulse=-v*.62;a.vx-=nx*impulse;a.vy-=ny*impulse;a.vz-=nz*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse;b.vz+=nz*impulse;}
  a.vx*=.98;a.vz*=.98;b.vx*=.98;b.vz*=.98;a.spin*=.97;b.spin*=.97;
 }
 for(const b of bodies){b.y=Math.max(b.r,b.y);b.x=Math.max(-110+b.r,Math.min(110-b.r,b.x));b.z=Math.max(-65+b.r,Math.min(65-b.r,b.z));energy+=Math.abs(b.vx)+Math.abs(b.vy)+Math.abs(b.vz);}
 return energy;
}
