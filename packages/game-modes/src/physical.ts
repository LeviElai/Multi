/** Deterministic gravity/peg collisions; a center wall preserves the chosen answer. */
export const PLINKO_PEGS=Array.from({length:7},(_,row)=>[0,1].flatMap(side=>Array.from({length:row%2?4:5},(_,col)=>({x:side*50+7+col*9+(row%2?4.5:0),y:22+row*9})))).flat();
export function plinkoPath(start:number){
 const left=start<50,lo=left?4:54,hi=left?46:96,center=left?25:75;
 let x=Math.max(lo,Math.min(hi,start)),y=8,vx=x<center?5:-5,vy=0;const path=[{x,y}];
 for(let i=0;i<312;i++){
  const dt=1/120;vy+=55*dt;vx+=(center-x)*.4*dt;x+=vx*dt;y+=vy*dt;
  for(const peg of PLINKO_PEGS){if((peg.x<50)!==left)continue;const dx=x-peg.x,dy=y-peg.y,d=Math.hypot(dx,dy),radius=2.6;if(d<radius&&d>.001){const nx=dx/d,ny=dy/d,dot=vx*nx+vy*ny;if(dot<0){vx-=1.45*dot*nx;vy-=1.45*dot*ny;vx+=Math.abs(nx)<.1?(i%2?5:-5):0;}x=peg.x+nx*radius;y=peg.y+ny*radius;}}
  if(x<lo){x=lo;vx=Math.abs(vx)*.7;}if(x>hi){x=hi;vx=-Math.abs(vx)*.7;}
  if(y>86){y=86;vy=0;vx*=.85;}path.push({x,y});
 }
 // Continue the same simulation until it reaches the bin; duration stays bounded.
 for(let i=0;i<600&&y<86;i++){const dt=1/120;vy+=55*dt;x+=vx*dt;y+=vy*dt;for(const peg of PLINKO_PEGS){const dx=x-peg.x,dy=y-peg.y,d=Math.hypot(dx,dy);if(d<2.6&&d>.001){const nx=dx/d,ny=dy/d,dot=vx*nx+vy*ny;if(dot<0){vx-=1.3*dot*nx;vy-=1.3*dot*ny;}x=peg.x+nx*2.6;y=peg.y+ny*2.6;}}x=Math.max(lo,Math.min(hi,x));y=Math.min(86,y);path.push({x,y});}
 return path;
}
