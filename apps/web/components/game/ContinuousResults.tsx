'use client';
import {useEffect,useRef,useMemo} from 'react';
import type {Snapshot} from '../../../../packages/contracts/src/index';
import {MODE_META} from '../../../../packages/contracts/src/index';
import {Standings} from './Competition';
import {PixelSprite} from '../world/Sprites';
import RoundVisualization from './RoundVisualization';
import {RoundClock} from '../RoundClock';
import {playCue} from '../../lib/audio';
import {useResultStep} from './ResultTime';
export default function ContinuousResults({snapshot:s}:{snapshot:Snapshot}){
 const r=s.round!,own=s.leaderboard.find(p=>p.participantId===s.participantId),step=useResultStep(s),standings=s.phase==='placements',compare=step!=='answer',award=s.roundAwards?.find(a=>a.participantId===s.participantId);
 const offset=useMemo(()=>Date.parse(s.serverTime)-Date.now(),[s.serverTime]);
 const priorStep=useRef(step);const freshPoints=step==='points'&&priorStep.current!=='points';useEffect(()=>{priorStep.current=step;},[step]);
 const best=Math.max(0,...s.leaderboard.map(p=>p.roundPoints));const winners=s.leaderboard.filter(p=>p.roundPoints===best);
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{root.current?.scrollIntoView({block:'start',behavior:'instant'});},[r.id]);
 useEffect(()=>{playCue(standings?'standings':step==='points'?(own&&own.roundPoints>0?'win':'click'):'reveal',r.mode,s.id+':'+r.id+':'+(standings?'standings':step));},[step,s.phaseId]);
 const format=(v:unknown)=>typeof v==='number'?v.toLocaleString('en',{maximumFractionDigits:3}):String(v??'No answer');
 const payload=s.ownSubmission?.payload;
 const submitted=typeof award?.detail.value==='number'?award.detail.value:typeof award?.detail.selected==='string'?award.detail.selected:r.mode==='word_puzzle'?s.ownAttempts.at(-1)?.guess:r.mode==='rare_answers'?payload?.text:r.mode==='size_it_up'?payload?.ratio:r.mode==='amountle'?payload?.count:payload?.value;
 const truth=r.mode==='size_it_up'?s.reveal?.trueRatio:s.reveal?.answer;
 const difference=typeof submitted==='number'&&typeof truth==='number'?submitted-truth:null;
 const group=s.reveal?.groups?.find(g=>g.answer===award?.detail.canonical);
 const reason=s.reveal?.skipped?'Round skipped':submitted===undefined?'No answer':difference!==null?(difference===0?'Exact match':format(Math.abs(difference))+(difference>0?' above':' below')):typeof award?.detail.correct==='boolean'?(award.detail.correct?'Correct':'Incorrect'):r.mode==='rare_answers'?award?.reason==='accepted_rare'?group?.count===1?'Unique answer':`Shared with ${(group?.count??1)-1} players`:'Invalid answer':r.mode==='word_puzzle'?award?.detail.solved?`Solved in ${s.ownAttempts.length} guesses`:'Not solved':difference===0?'Exact match':difference!==null?format(Math.abs(difference))+(difference>0?' above':' below'):'';
 return <section ref={root} className={'continuous-results sequence-results step-'+step+(standings?' phase-placements':' phase-reveal')} aria-label="Round results">
 <header className="phase-heading"><div><PixelSprite kind={r.mode}/><span>{standings?'Round results':step==='answer'?'Answer':step==='comparison'?(s.participantId?'You':'Answers'):'Points'}</span></div><div className="phase-countdown"><span>{s.automatic===false?'Waiting for host':s.state==='PAUSED'?'Paused':standings?'Next round in':s.roundIndex===s.roundCount-1?'Podium in':'Standings in'}</span>{s.automatic!==false&&<RoundClock deadline={s.deadlineAt} pausedMs={s.pausedRemainingMs} paused={s.state==='PAUSED'} offset={offset} duration={standings?10:5.5}/>}</div></header>
 <h2 className="result-question">{r.question}</h2>
 {(!standings)&&<RoundVisualization snapshot={s} compare={compare}/>}
 {standings&&<div className="compact-outcome"><small>{r.mode==='rare_answers'?'Outcome':'Answer'}</small><strong>{r.mode==='rare_answers'?`${s.reveal?.groups?.length??0} valid groups`:format(truth)+(r.mode==='size_it_up'?' times reference':s.reveal?.unit?' '+s.reveal.unit:'')}</strong></div>}
 {s.participantId&&compare&&<div className="comparison-strip"><span><small>You</small><strong>{format(submitted)}{submitted!==undefined&&r.mode==='size_it_up'?'\u00d7':''}</strong></span><span className="comparison-reason">{reason}</span></div>}
 {!standings&&step==='points'&&own&&<div className={"points-award "+(freshPoints?"fresh-award":"")} role="status">+{format(own.roundPoints)} <small>points</small></div>}
 {!s.participantId&&!standings&&step==='points'&&<div className="shared-round-best">{best>0?<><small>Round best</small><strong>{winners.map(p=>p.nickname).join(' / ')}</strong><b>+{format(best)} points</b></>:<strong>No points this round</strong>}</div>}
 {standings&&<div className="continuous-standings"><Standings leaders={s.leaderboard} previousLeaders={s.previousLeaderboard} ownId={s.participantId} sequence={step} countStart={s.state==='PAUSED'?Date.now()+1200-(10000-(s.pausedRemainingMs??0)):Date.parse(s.deadlineAt??s.serverTime)-8800} offset={s.state==='PAUSED'?0:offset} paused={s.state==='PAUSED'}/></div>}
 {s.reveal?.explanation&&step!=='answer'&&<details className="result-notes"><summary>About this answer</summary><p>{s.reveal.explanation}</p>{s.reveal.sourceUrl&&<a href={s.reveal.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>}</details>}
 </section>;
}
