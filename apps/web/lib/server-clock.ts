/** Local transport measurements, never sent as an authoritative action time. */
export type ClockSample = {offsetMs:number;deliveryMs:number};
const samples = new WeakMap<object,ClockSample>();
export function estimateClock(serverTime:string,receivedAt:number,roundTripMs:number):ClockSample {
 const deliveryMs=Math.min(750,Math.max(0,roundTripMs)/2);
 return {offsetMs:Date.parse(serverTime)-receivedAt+deliveryMs,deliveryMs};
}
export function recordClock(value:unknown,receivedAt:number,roundTripMs:number){
 if(value&&typeof value==='object'&&'serverTime' in value&&typeof value.serverTime==='string'&&Number.isFinite(Date.parse(value.serverTime)))
  samples.set(value,estimateClock(value.serverTime,receivedAt,roundTripMs));
}
export function snapshotClock(value:{serverTime:string}):ClockSample {
 return samples.get(value)??{offsetMs:Date.parse(value.serverTime)-Date.now(),deliveryMs:0};
}
