/** Equal-sized rigid blocks. A settled tower needs its centre of mass inside
 * every contact interval. Positions/width are measured in board percentages. */
export type StackBlock={value:number;x:number};
export const STACK_WIDTH=24;
export function stableStack(blocks:readonly StackBlock[]):boolean{
 if(blocks.some(b=>!Number.isFinite(b.x)||b.x<STACK_WIDTH/2||b.x>100-STACK_WIDTH/2||!Number.isSafeInteger(b.value)||b.value<=0))return false;
 for(let i=1;i<blocks.length;i++){
  const lower=blocks[i-1],upper=blocks[i];
  const left=Math.max(lower.x,upper.x)-STACK_WIDTH/2;
  const right=Math.min(lower.x,upper.x)+STACK_WIDTH/2;
  const centre=blocks.slice(i).reduce((sum,b)=>sum+b.x,0)/(blocks.length-i);
  if(right-left<2||centre<left+1||centre>right-1)return false;
 }
 return true;
}
