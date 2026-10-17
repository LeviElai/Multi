'use client';
import { useRef, useLayoutEffect } from 'react';
import type { Snapshot, Leader } from '../../../../packages/contracts/src/index';
import { roundPlacements, rankMovement } from '../../lib/competition';
import {PlayerIdentity} from './PlayerIdentity';
import ContinuousResults from './ContinuousResults';
import {ScoreTotal} from './ResultTime';
import type { CSSProperties } from 'react';

export function PlayerScore({ snapshot: s }: { snapshot: Snapshot }) {
    const own = s.leaderboard.find(p => p.participantId === s.participantId);
    if (!own) return null;
    const scored = ['ROUND_REVEAL', 'INTERMISSION', 'SESSION_COMPLETED'].includes(s.state);
    const movement = scored ? rankMovement(s.leaderboard, own.participantId) : 0;
    return <section className="player-scorebar" aria-label="Your score"><span className="scorebar-identity"><PlayerIdentity id={own.participantId} name={own.nickname} avatar={own.avatar}/></span>
        <div><small>Your place</small><strong>#{own.rank}</strong></div>
        <div><small>Total points</small><strong>{own.points.toLocaleString('en')}</strong></div>
        {scored && <><div><small>This round</small><strong>+{own.roundPoints.toLocaleString('en')}</strong></div>
        <div><small>Movement</small><strong className={movement > 0 ? 'score-up' : movement < 0 ? 'score-down' : ''}>{movement > 0 ? `↑ ${movement}` : movement < 0 ? `↓ ${-movement}` : '—'}</strong></div></>}
    </section>;
}
export function Standings({leaders,previousLeaders,ownId,compact=false,sequence='settled',countStart,offset=0,paused=false}: {
 leaders:Leader[];previousLeaders?:Leader[];ownId?:string;compact?:boolean;sequence?:string;countStart?:number;offset?:number;paused?:boolean;
}) {
 const root=useRef<HTMLElement>(null),positions=useRef(new Map<string,number>());
 const before=previousLeaders??leaders.map(p=>({...p,points:p.points-p.roundPoints})).sort((a,b)=>b.points-a.points||a.participantId.localeCompare(b.participantId));
 const final=sequence==='settled',counting=sequence==='counting',gains=sequence!=='previous';
 const rows=final?leaders:before;
 const best=Math.max(0,...leaders.map(p=>p.roundPoints));
 useLayoutEffect(()=>{
  const nodes=Array.from(root.current?.querySelectorAll<HTMLElement>('[data-player]')??[]);
  // Read every position before writing transforms: no per-row layout thrashing.
  const current=nodes.map(node=>({node,id:node.dataset.player!,y:node.getBoundingClientRect().top}));
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(const {node,id,y} of current){const previous=positions.current.get(id);if(previous!==undefined&&previous!==y)node.animate([{transform:`translateY(${previous-y}px)`},{transform:'translateY(0)'}],{duration:450,easing:'ease-out'});}
  positions.current=new Map(current.map(p=>[p.id,p.y]));
 },[rows.map(p=>p.participantId).join('|')]);
 useLayoutEffect(()=>{const list=root.current?.querySelector('ol'),own=root.current?.querySelector<HTMLElement>('.is-you');if(list&&own){const top=own.offsetTop-list.offsetTop;if(top<list.scrollTop||top+own.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=Math.max(0,top-list.clientHeight/2+own.offsetHeight/2);}},[ownId,final]);
 return <section ref={root} className={'standings-board '+(compact?'standings-compact':'')} aria-label="Standings"><header><h2>Standings</h2><span>Total</span></header><ol>{rows.map((p,index)=>{
 const next=leaders.find(n=>n.participantId===p.participantId)!,old=before.find(n=>n.participantId===p.participantId)!,movement=rankMovement(leaders,p.participantId),isBest=!compact&&best>0&&next.roundPoints===best;
 const rank=final?next.rank:1+before.filter(n=>n.points>p.points).length;
 return <li data-player={p.participantId} key={p.participantId} className={(p.participantId===ownId?'is-you ':'')+(isBest?'round-best':'')}>
 <b className="standing-rank">{rank}</b><span className="standing-name"><PlayerIdentity id={p.participantId} name={p.nickname} avatar={next.avatar}/><span className="standing-badges">{p.participantId===ownId&&<small>You</small>}{isBest&&<small>Round best</small>}</span></span>
 <span className="standing-move" aria-label={final&&movement?`${Math.abs(movement)} places ${movement>0?'up':'down'}`:'No rank change'}>{final&&movement?(movement>0?'\u2191':'\u2193')+Math.abs(movement):''}</span>
 <span className="standing-score"><ScoreTotal from={old.points} to={counting||final?next.points:old.points} progress={counting?0:1} startAt={countStart} offset={offset} paused={paused}/>{!compact&&gains&&<small>+{next.roundPoints.toLocaleString('en')}</small>}</span></li>;
 })}</ol>{!rows.length&&<p>No players yet.</p>}</section>;
}
export function RoundPodium({ snapshot: s }: {
    snapshot: Snapshot;
}) {
    const rows = roundPlacements(s.leaderboard, s.roundAwards);
    const best = rows[0]?.roundPoints ?? 0;
    const winners = rows.filter(p => p.roundPoints === best);
    const ranks = [...new Set(rows.map(p => p.roundRank))].filter(rank => rank <= 3);
    const awards = new Map(s.roundAwards?.map(a => [a.participantId, a]));
    return <section className="round-podium" aria-label="Round podium"><span className="eyebrow">ROUND {s.roundIndex + 1} RESULTS</span><h2>{s.reveal?.skipped ? 'Round skipped' : !best ? 'No points awarded' : winners.length > 1 ? 'Tied round winners' : 'Round winner'}</h2>{best > 0 && <p className="winner-names">{winners.map(p => p.nickname).join(' · ')}</p>}<div className="round-podium-places">{ranks.map(rank => <div key={rank} className={'round-place place-' + rank}><div className="podium-medal" aria-hidden="true">{rank}</div>{rows.filter(p => p.roundRank === rank).map(p => <div className="podium-person" key={p.participantId}><PlayerIdentity id={p.participantId} name={p.nickname} avatar={p.avatar}/><b>+{p.roundPoints.toLocaleString('en')}</b>{awards.get(p.participantId)?.detail.solved === true && <small>Solved in {String(awards.get(p.participantId)?.detail.attemptsUsed)} guesses</small>}</div>)}<span>{rows.filter(p => p.roundRank === rank).length > 1 ? 'Tied ' : ''}#{rank}</span></div>)}</div><p className="result-rule">Equal points share a place. No speed tie-break.</p></section>;
}
export function RoundResults({snapshot:s}:{snapshot:Snapshot;onStage?:(stage:'reveal'|'podium'|'standings'|'auto')=>void;busy?:boolean}) {return <ContinuousResults snapshot={s}/>;}
