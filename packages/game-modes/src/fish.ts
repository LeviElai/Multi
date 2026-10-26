import {DomainError,type ArcadeRound,type Submission} from '../../contracts/src/index';
export const FISH_PERIOD=3600;
/** Shared deterministic animation. No client clock or claimed score is accepted. */
export function fishPosition(now:number,start:number,index:number){
 const elapsed=Math.max(0,now-start)+index*FISH_PERIOD/6;
 const cycle=Math.floor(elapsed/FISH_PERIOD),phase=(elapsed%FISH_PERIOD)/FISH_PERIOD;
 return {cycle,position:phase*100,catchable:phase>=.35&&phase<=.65};
}
export function fishCast(round:ArcadeRound,choiceId:string,previous:Submission|undefined,now:number,deadline:number,elapsedMs?:number){
 if(now>=deadline)throw new DomainError('ROUND_CLOSED','Time is up.',409);
 if(round.publicConfig.fishScoring==='single-catch-v2'&&previous)throw new DomainError('ANSWER_LOCKED','Your catch is already saved.',409);
 if(previous&&now-Date.parse(previous.acceptedAt)<650)throw new DomainError('CAST_TOO_SOON','Your line is returning. Cast again in a moment.',429);
 const index=round.publicConfig.options.findIndex(o=>o.id===choiceId);
 if(index<0)throw new DomainError('INVALID_ANSWER','Choose a fish from this pond.',422);
 const start=deadline-round.timerSeconds*1000;
 const {cycle,position}=fishPosition(now,start,index);
 const cycles=[...(previous?.payload.fishCycles??Array(round.publicConfig.options.length).fill(-1))];
 if(cycles[index]===cycle)throw new DomainError('FISH_ALREADY_CAST','Wait for this fish to swim back.',422);
 cycles[index]=cycle;
 // 150 ms after the visible zone absorbs ordinary delivery latency, never a client timestamp.
 const inZone=position>=35&&position<=65+150/FISH_PERIOD*100;
 const correct=round.secretConfig.correctOptionIds.includes(choiceId);
 const caught=inZone&&correct;
 if(round.publicConfig.fishScoring==='single-catch-v2'){
  const elapsed=Math.max(0,Math.min(round.timerSeconds*1000,elapsedMs??now-start));
  const fishPoints=caught?Math.round(round.maxPoints*(1-.5*elapsed/(round.timerSeconds*1000))):0;
  const fishFeedback=caught?'Caught! +'+fishPoints:!inZone?'Missed · 0 points':'Wrong fish · 0 points';
  return {payload:{choiceId,locked:true,fishCatches:Number(caught),fishPoints,fishCycles:cycles,fishFeedback},ack:{fishCatches:Number(caught),fishPoints,fishFeedback}};
 }
 const fishCatches=(previous?.payload.fishCatches??0)+Number(caught);
 const fishPoints=Math.max(0,Math.min(1000,(previous?.payload.fishPoints??0)+(caught?100:inZone&&!correct?-50:0)));
 const fishFeedback=caught?'Caught! +100':!inZone?'Missed the zone': 'Wrong fish · −50';
 return {payload:{choiceId,locked:false,fishCatches,fishPoints,fishCycles:cycles,fishFeedback},ack:{fishCatches,fishPoints,fishFeedback}};
}
