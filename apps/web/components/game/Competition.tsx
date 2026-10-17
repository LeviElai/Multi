'use client';
import { useRef, useLayoutEffect } from 'react';
import type { Snapshot, Leader } from '../../../../packages/contracts/src/index';
import { roundPlacements, rankMovement } from '../../lib/competition';
import {PlayerIdentity} from './PlayerIdentity';
import ContinuousResults from './ContinuousResults';
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
export function Standings({ leaders, ownId, compact = false }: {
    leaders: Leader[];
    ownId?: string;
    compact?: boolean;
}) {
    const root = useRef<HTMLElement>(null);
    const previous = useRef(new Map<string, number>());
    useLayoutEffect(() => { const nodes = root.current?.querySelectorAll<HTMLElement>('[data-player]'); nodes?.forEach(node => { const id = node.dataset.player!, y = node.getBoundingClientRect().top, old = previous.current.get(id) ?? (y + rankMovement(leaders,id)*node.getBoundingClientRect().height); if (old !== undefined && old !== y && !matchMedia('(prefers-reduced-motion: reduce)').matches)
        node.animate([{ transform: `translateY(${old - y}px)` }, { transform: 'translateY(0)' }], { duration: 300, easing: 'ease-out' }); previous.current.set(id, y); }); }, [leaders.map(p => p.participantId + ':' + p.points).join('|')]);
    useLayoutEffect(()=>{const list=root.current?.querySelector('ol'),own=root.current?.querySelector<HTMLElement>('.is-you');if(list&&own){const top=own.offsetTop-list.offsetTop;if(top<list.scrollTop||top+own.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=Math.max(0,top-list.clientHeight/2+own.offsetHeight/2);}},[ownId,leaders.map(p=>p.participantId+':'+p.rank).join('|')]);
    return <section ref={root} className={'standings-board ' + (compact ? 'standings-compact' : '')} aria-label="Overall standings"><header><h2>{'THE STANDINGS'}</h2><span>Total points</span></header><ol>{leaders.map((p, index) => { const movement = rankMovement(leaders, p.participantId); return <li style={{"--row": Math.min(index, 12)} as CSSProperties} data-player={p.participantId} key={p.participantId} className={p.participantId === ownId ? 'is-you' : ''}><b className="standing-rank">{p.rank}</b><span className="standing-name"><PlayerIdentity id={p.participantId} name={p.nickname} avatar={p.avatar} mood={p.participantId===ownId?(movement>0?"up":p.roundPoints>0?"happy":"near"):"still"}/>{p.participantId === ownId && p.nickname !== 'You' && <small>You</small>}</span><span className={"standing-move " + (movement < 0 ? "move-down" : "")} aria-label={movement > 0 ? `Up ${movement} places` : movement < 0 ? `Down ${-movement} places` : 'No rank change'}>{movement > 0 ? '↑' + movement : movement < 0 ? '↓' + (-movement) : '—'}</span><span className="standing-score" key={p.points}><strong>{p.points.toLocaleString('en')}</strong>{(!compact || p.roundPoints > 0) && <small>+{p.roundPoints} this round</small>}</span></li>; })}</ol>{!leaders.length && <p>No players yet.</p>}{!compact && leaders.length > 0 && <p className="standings-caption">{leaders.length === 1 && leaders[0].nickname === 'You' ? 'Your total so far.' : <>{leaders.filter(p => p.rank === 1).map(p => p.nickname).join(' & ')} {leaders.filter(p => p.rank === 1).length > 1 ? 'share the lead' : leaders[0].nickname === 'You' ? 'lead overall' : 'leads overall'}. Equal scores share a place.</>}</p>}</section>;
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
