import type {Leader,Award} from '../../../packages/contracts/src/index';
export const RESULT_TIMINGS={reveal:3000,podium:3000} as const;
export function resultPhase(elapsed:number,timings:{reveal:number;podium:number}=RESULT_TIMINGS):'reveal'|'podium'|'standings'{return elapsed<timings.reveal?'reveal':elapsed<timings.reveal+timings.podium?'podium':'standings';}
/** Competition ranks. Ties share rank; stable IDs only determine display order. */
export function roundPlacements(leaders:Leader[],awards?:Award[]){
 const points=new Map(awards?.map(a=>[a.participantId,a.points]));
 const rows=leaders.map(p=>({...p,roundPoints:points.get(p.participantId)??p.roundPoints,roundRank:0})).sort((a,b)=>b.roundPoints-a.roundPoints||a.participantId.localeCompare(b.participantId));
 rows.forEach((p,i)=>{p.roundRank=i&&p.roundPoints===rows[i-1].roundPoints?rows[i-1].roundRank:i+1});return rows;
}
export function rankMovement(leaders:Leader[],id:string){const row=leaders.find(p=>p.participantId===id);if(!row)return 0;const before=row.points-row.roundPoints;const previousRank=1+leaders.filter(p=>p.points-p.roundPoints>before).length;return previousRank-row.rank;}
