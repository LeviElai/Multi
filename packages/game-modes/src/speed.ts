import type {RoundClockRecord} from '../../contracts/src/index';
/** Receipt times and pause segments originate exclusively on the server. */
export function activeResponseMs(clock:RoundClockRecord,acceptedAt:string):number{
 const end=Date.parse(acceptedAt);
 if(!Number.isFinite(end)||end<clock.startedAt)return Infinity;
 const paused=clock.pauses.reduce((sum,p)=>sum+Math.max(0,Math.min(end,p.end??end)-Math.max(clock.startedAt,p.start)),0);
 return Math.max(0,end-clock.startedAt-paused);
}
export function speedPoints(base:number,elapsedMs:number,durationMs:number,accuracyDominant=false):number{
 if(!Number.isFinite(base)||base<=0||!Number.isFinite(elapsedMs)||durationMs<=0)return 0;
 const fraction=Math.max(0,Math.min(1,elapsedMs/durationMs));
 return Math.round(Math.min(1000,base)*(1-(accuracyDominant?.2:.5)*fraction));
}
