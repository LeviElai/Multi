import {DomainError,type ArcadeRound,type Submission} from '../../contracts/src/index';
/** Call only with sanitized input and authoritative time in live rooms. */
export function crackGuess(round:ArcadeRound,value:number,previous:Submission|undefined,now:number,deadline:number){
 if(previous?.payload.locked)throw new DomainError('ANSWER_LOCKED','This code is already solved.',409);
 if(previous&&now-Date.parse(previous.acceptedAt)<750)throw new DomainError('GUESS_TOO_SOON','Try again in a moment.',429);
 if(previous?.payload.value===value)throw new DomainError('DUPLICATE_GUESS','Try a different code.',422);
 const attempt=(previous?.payload.crackAttempts??0)+1;
 const solved=value===round.secretConfig.answer;
 const remaining=Math.max(0,Math.min(1,(deadline-now)/(round.timerSeconds*1000)));
 const score=(mistakes:number)=>Math.max(1,Math.round(1000*.8**mistakes*(.85+.15*remaining)));
 const direction=solved?'solved' as const:value<Number(round.secretConfig.answer)?'higher' as const:'lower' as const;
 return {payload:{value,locked:solved,crackAttempts:attempt,crackPoints:solved?score(attempt-1):0,crackHint:direction},ack:{attempt,solved,direction,potentialPoints:score(solved?attempt-1:attempt)}};
}
