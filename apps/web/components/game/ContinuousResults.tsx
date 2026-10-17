'use client';
import {useEffect,useRef} from 'react';
import type {Snapshot} from '../../../../packages/contracts/src/index';
import {MODE_META} from '../../../../packages/contracts/src/index';
import {Standings} from './Competition';
import {PixelSprite} from '../world/Sprites';
import RoundVisualization from './RoundVisualization';
import {RoundClock} from '../RoundClock';
import {playCue} from '../../lib/audio';
import {roundPlacements,rankMovement} from '../../lib/competition';
export default function ContinuousResults({snapshot:s}:{snapshot:Snapshot}){
 const r=s.round!,own=s.leaderboard.find(p=>p.participantId===s.participantId);
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{root.current?.scrollIntoView({block:'start',behavior:'instant'});},[r.id]);
 const phase=s.phase==='placements'?'placements':'reveal';
 const paused=s.state==='PAUSED';
 const answer=s.reveal?.answer;
 const submitted=s.ownSubmission?.payload;
 const ownAnswer=r.mode==='word_puzzle'?s.ownAttempts.at(-1)?.guess:r.mode==='rare_answers'?submitted?.text:r.mode==='size_it_up'?submitted?.ratio:r.mode==='amountle'?submitted?.count:submitted?.value;
 const format=(v:unknown)=>typeof v==='number'?v.toLocaleString('en',{maximumFractionDigits:3}):String(v??'No answer');
 const ownAward=s.roundAwards?.find(a=>a.participantId===s.participantId);
 const group=s.reveal?.groups?.find(g=>g.answer===ownAward?.detail.canonical);
 const rareOutcome=s.participantId?(ownAward?.reason==='accepted_rare'?(group?.count===1?'Unique answer':String(group?.count??0)+' players matched'):'Not accepted'):(String(s.reveal?.groups?.length??0)+' accepted answers');
 const correct=r.mode==='size_it_up'?s.reveal?.trueRatio:answer;
 const difference=typeof ownAnswer==='number'&&typeof correct==='number'?ownAnswer-correct:null;
 const placements=roundPlacements(s.leaderboard,s.roundAwards);
 const best=placements[0]?.roundPoints??0;
 const winners=placements.filter(player=>player.roundPoints===best);
 useEffect(()=>{playCue(phase==='reveal'?'reveal':own&&rankMovement(s.leaderboard,own.participantId)>0?'win':'standings',r.mode,s.id+':'+s.round?.id+':'+phase);},[s.phaseId,phase]);
 return <section ref={root} className={'continuous-results phase-'+phase} aria-label="Round results">
 <header className="phase-heading"><div><PixelSprite kind={r.mode}/><span>{MODE_META[r.mode].name} · Round {s.roundIndex+1}/{s.roundCount}</span></div><div className="phase-countdown"><span>{s.automatic===false?'Waiting for host':paused?'Paused by host':phase==='placements'?'Next round in':s.roundIndex===s.roundCount-1?'Final podium in':'Placements in'}</span>{s.automatic!==false&&<RoundClock deadline={s.deadlineAt} pausedMs={s.pausedRemainingMs} paused={paused} offset={Date.parse(s.serverTime)-Date.now()} duration={phase==='reveal'?3:10}/>}</div></header>
 <div className="result-winner-line" role="status">{s.reveal?.skipped?'Round skipped · no points awarded':best>0?<><span>{winners.length>1?'Round winners':'Round winner'}: <strong>{winners.map(player=>player.nickname).join(' · ')}</strong></span><b>+{best.toLocaleString('en')} points</b></>:'No points awarded this round'}</div>
 <article className="answer-ticket"><h2>{r.question}</h2><div className="answer-ticket-values"><div><small>{s.participantId?'Your answer':'Round outcome'}</small><strong>{s.participantId?format(ownAnswer)+(r.mode==='size_it_up'?'×':''):'Round scored'}</strong></div>{own&&<div className="ticket-points" key={own.points}><small>Round points</small><strong>+{own.roundPoints.toLocaleString('en')}</strong><span>Total {own.points.toLocaleString('en')} · Place #{own.rank}</span></div>}</div>
 <p className="ticket-reason">{s.reveal?.skipped?'Round skipped · no points awarded.':difference===0?'Perfect match.':difference!==null?format(Math.abs(difference))+(difference>0?' too high.':' too low.'):r.mode==='word_puzzle'?s.ownAttempts.some(a=>a.solved)?`Solved in ${s.ownAttempts.length} ${s.ownAttempts.length===1?'guess':'guesses'}.`:'The word is revealed.':r.mode==='rare_answers'?rareOutcome+'.':s.reveal?.explanation}</p>
 </article>
 <RoundVisualization snapshot={s}/>
 <div className="continuous-standings"><Standings leaders={s.leaderboard} ownId={s.participantId}/></div>
 {s.reveal?.explanation&&<details className="result-notes"><summary>About this answer</summary><p>{s.reveal.explanation}</p>{s.reveal.sourceUrl&&<a href={s.reveal.sourceUrl} target="_blank" rel="noopener noreferrer">Answer source</a>}</details>}
 </section>;
}
