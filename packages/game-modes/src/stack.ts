/** Equal-sized rigid blocks. A settled tower needs its centre of mass inside
 * every contact interval. Positions/width are measured in board percentages. */
export type StackBlock={value:number;x:number};
export const STACK_WIDTH=24;
/** Index of the lowest failed contact. The unsupported tower above it falls. */
export function stackFailureIndex(blocks:readonly StackBlock[]):number{
 const invalid=blocks.findIndex(b=>!Number.isFinite(b.x)||b.x<STACK_WIDTH/2||b.x>100-STACK_WIDTH/2||!Number.isSafeInteger(b.value)||b.value<=0);
 if(invalid>=0)return invalid;
 for(let i=1;i<blocks.length;i++){
  const lower=blocks[i-1],upper=blocks[i];
  const left=Math.max(lower.x,upper.x)-STACK_WIDTH/2;
  const right=Math.min(lower.x,upper.x)+STACK_WIDTH/2;
  const centre=blocks.slice(i).reduce((sum,b)=>sum+b.x,0)/(blocks.length-i);
  if(right-left<2||centre<left+1||centre>right-1)return i;
 }
 return -1;
}
export function stableStack(blocks:readonly StackBlock[]):boolean{return stackFailureIndex(blocks)===-1;}
/** Stability of each contact under the weight of all blocks above it. A
 * centred tower scores 1; a legal narrow overhang approaches 0. */
export function stackStability(blocks:readonly StackBlock[]):number{
 if(!stableStack(blocks))return 0;
 if(blocks.length<2)return 1;
 let weakest=1;
 for(let i=1;i<blocks.length;i++){
  const left=Math.max(blocks[i-1].x,blocks[i].x)-STACK_WIDTH/2;
  const right=Math.min(blocks[i-1].x,blocks[i].x)+STACK_WIDTH/2;
  const centre=blocks.slice(i).reduce((sum,b)=>sum+b.x,0)/(blocks.length-i);
  weakest=Math.min(weakest,Math.max(0,Math.min(centre-left,right-centre)-1)/(STACK_WIDTH/2-1));
 }
 return weakest;
}
