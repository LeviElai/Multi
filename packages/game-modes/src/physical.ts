/** Circular bodies in a common width-based world; no chance can change the chosen side. */
export const PLINKO_PEGS=Array.from({length:7},(_,row)=>[0,1].flatMap(side=>Array.from({length:row%2?4:5},(_,col)=>({x:side*50+7+col*9+(row%2?4.5:0),y:22+row*9})))).flat();
export type PlinkoPoint={x:number;y:number;impact?:number};
export function plinkoPath(start:number,aspect=1):PlinkoPoint[]{
 const height=100/Math.max(.45,Math.min(2,aspect)),left=start<50,radius=1.9,pegRadius=1,lo=left?4:54,hi=left?46:96,floor=.855*height;
 let x=Math.max(lo,Math.min(hi,start)),y=.08*height,vx=left?9:-9,vy=0,settled=0;const path:PlinkoPoint[]=[{x,y:y/height*100}];
 for(let i=0;i<2400;i++){
  const dt=1/240;vy+=190*dt;vx*=.999;x+=vx*dt;y+=vy*dt;let impact:number|undefined;
  for(let j=0;j<PLINKO_PEGS.length;j++){const peg=PLINKO_PEGS[j];if((peg.x<50)!==left)continue;const py=peg.y/100*height,dx=x-peg.x,dy=y-py,d=Math.hypot(dx,dy),r=radius+pegRadius;if(d<r&&d>.00001){const nx=dx/d,ny=dy/d,vn=vx*nx+vy*ny;x=peg.x+nx*r;y=py+ny*r;if(vn<0){vx-=1.46*vn*nx;vy-=1.46*vn*ny;if(Math.abs(nx)<.08)vx+=(j%2?1:-1)*9;vx*=.97;impact=j;}}}
  if(x<lo){x=lo;vx=Math.abs(vx)*.6;}if(x>hi){x=hi;vx=-Math.abs(vx)*.6;}
  if(y>floor){y=floor;vy=-Math.abs(vy)*.2;vx*=.86;settled++;}else if(y<floor-.2)settled=0;
  path.push({x,y:y/height*100,...(impact!==undefined?{impact}:{})});if(settled>30)break;
 }
 return path;
}
