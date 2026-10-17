/** Magnitude buckets do not expose the target count. Large blocks plus units
 * keep exact answers representable; reject rounds needing too many placements. */
export function stackScale(n:number){
 const unit=10**Math.max(0,Math.ceil(Math.log10(Math.max(1,n)/100)));
 const values=[...new Set([1,unit,unit*5,unit*10])].sort((a,b)=>a-b);
 let remaining=n,placements=0;
 for(const value of [...values].reverse()){placements+=Math.floor(remaining/value);remaining%=value;}
 return {unit,values,placements,practical:Number.isSafeInteger(n)&&n>=0&&n<=99999999&&placements<=32};
}
