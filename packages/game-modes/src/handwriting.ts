/** Tiny local template recognizer. No network, model download, or retained image. */
export type PenPoint={x:number;y:number};
export type PenStroke=PenPoint[];
const examples:Record<string,number[][][]>={
 '0':[[[3,0],[1,2],[0,5],[1,9],[3,10],[5,9],[6,5],[5,1],[3,0]]],
 '1':[[[1,2],[3,0],[3,10]],[[3,0],[3,10]],[[0,3],[3,0],[3,10],[1,10],[5,10]]],
 '2':[[[0,2],[1,0],[4,0],[6,2],[5,4],[0,10],[6,10]],[[0,1],[3,0],[6,2],[5,4],[1,8],[0,10],[6,10]]],
 '3':[[[0,1],[3,0],[6,2],[3,5],[6,7],[5,9],[2,10],[0,9]],[[0,0],[6,0],[3,4],[6,6],[5,9],[2,10],[0,9]]],
 '4':[[[5,10],[5,0],[0,7],[6,7]],[[1,0],[0,6],[6,6]],[[5,0],[5,10]]],
 '5':[[[6,0],[0,0],[0,5],[3,4],[6,6],[5,9],[2,10],[0,9]]],
 '6':[[[5,0],[2,1],[0,5],[0,8],[2,10],[5,9],[6,7],[5,5],[2,5],[0,7]]],
 '7':[[[0,0],[6,0],[2,10]],[[0,0],[6,0],[3,5],[1,10]],[[0,0],[6,0],[2,10]],[[1,5],[5,5]]],
 '8':[[[3,0],[0,2],[1,4],[5,6],[6,8],[4,10],[1,10],[0,8],[1,6],[5,4],[6,2],[3,0]]],
 '9':[[[6,4],[3,5],[0,4],[0,1],[3,0],[6,2],[6,5],[4,9],[2,10]]],
};
// The two strokes of an open 4 are one sample, as are crossed 7s.
const sampleGroups:Record<string,number[][][][]>={};
for(const [digit,paths]of Object.entries(examples))sampleGroups[digit]=digit==='4'?[[paths[0]],[paths[1],paths[2]]]:digit==='7'?[[paths[0]],[paths[1]],[paths[2],paths[3]]]:paths.map(p=>[p]);
function bounds(strokes:PenStroke[]){const p=strokes.flat();return {x:Math.min(...p.map(p=>p.x)),y:Math.min(...p.map(p=>p.y)),w:Math.max(...p.map(p=>p.x))-Math.min(...p.map(p=>p.x)),h:Math.max(...p.map(p=>p.y))-Math.min(...p.map(p=>p.y))};}
function raster(strokes:PenStroke[]):number[]{
 const b=bounds(strokes),out=new Array(24*32).fill(0);
 for(const stroke of strokes)for(let i=1;i<stroke.length;i++){
  const a=stroke[i-1],z=stroke[i],steps=Math.max(1,Math.ceil(Math.hypot(z.x-a.x,z.y-a.y)*2));
  for(let t=0;t<=steps;t++){const x=Math.round(2+19*((a.x+(z.x-a.x)*t/steps-b.x)/Math.max(1,b.w))),y=Math.round(2+27*((a.y+(z.y-a.y)*t/steps-b.y)/Math.max(1,b.h)));out[y*24+x]=1;}
 }
 return out;
}
function distance(a:number[],b:number[]){const ai=a.flatMap((v,i)=>v?[i]:[]),bi=b.flatMap((v,i)=>v?[i]:[]);const one=(x:number[],y:number[])=>x.reduce((sum,i)=>sum+Math.min(...y.map(j=>Math.hypot(i%24-j%24,Math.floor(i/24)-Math.floor(j/24)))),0)/Math.max(1,x.length);return (one(ai,bi)+one(bi,ai))/2;}
const templates=Object.entries(sampleGroups).flatMap(([digit,samples])=>samples.map(paths=>({digit,image:raster(paths.map(p=>p.map(([x,y])=>({x,y}))))})));
export function recognizeNumber(strokes:PenStroke[]):{value:string;confidence:number}{
 const useful=strokes.filter(p=>p.length>1);if(!useful.length)return {value:'',confidence:0};
 const ordered=useful.map(s=>({s,b:bounds([s])})).sort((a,b)=>a.b.x-b.b.x);
 const groups:PenStroke[][]=[];let right=-Infinity;
 for(const {s,b}of ordered){if(groups.length&&b.x<=right+Math.max(2,b.h*.08))groups.at(-1)!.push(s);else groups.push([s]);right=Math.max(right,b.x+b.w);}
 if(groups.length>8)return {value:'',confidence:0};
 let confidence=1;const digits=groups.map(group=>{
  const b=bounds(group);if(b.h<8){confidence=0;return '';}
  if(b.w/b.h<.16)return '1';
  const image=raster(group),ranks=templates.map(t=>({digit:t.digit,d:distance(image,t.image)})).sort((a,b)=>a.d-b.d);
  const best=ranks[0];confidence=Math.min(confidence,Math.max(0,1-best.d/4));return best.d>3.3?'':best.digit;
 });
 return {value:digits.some(d=>!d)?'':digits.join(''),confidence};
}
