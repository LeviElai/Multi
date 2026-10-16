'use client';
import { useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react';
import type { Snapshot, Leader } from '../../../../packages/contracts/src/index';
import { roundPlacements, rankMovement, resultPhase, RESULT_TIMINGS } from '../../lib/competition';
import { playCue } from '../../lib/audio';
import Reveal from '../Reveal';
import type { CSSProperties } from 'react';

export function PlayerScore({ snapshot: s }: { snapshot: Snapshot }) {
    const own = s.leaderboard.find(p => p.participantId === s.participantId);
    if (!own) return null;
    const scored = ['ROUND_REVEAL', 'INTERMISSION', 'SESSION_COMPLETED'].includes(s.state);
    const movement = scored ? rankMovement(s.leaderboard, own.participantId) : 0;
    return <section className="player-scorebar" aria-label="Your score">
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
    useLayoutEffect(() => { const nodes = root.current?.querySelectorAll<HTMLElement>('[data-player]'); nodes?.forEach(node => { const id = node.dataset.player!, y = node.getBoundingClientRect().top, old = previous.current.get(id); if (old !== undefined && old !== y && !matchMedia('(prefers-reduced-motion: reduce)').matches)
        node.animate([{ transform: `translateY(${old - y}px)` }, { transform: 'translateY(0)' }], { duration: 450, easing: 'ease-out' }); previous.current.set(id, y); }); }, [leaders.map(p => p.participantId + ':' + p.points).join('|')]);
    return <section ref={root} className={'standings-board ' + (compact ? 'standings-compact' : '')} aria-label="Overall standings"><header><h2>{compact ? "Placements" : "The placements"}</h2><span>Total points</span></header><ol>{leaders.map((p, index) => { const movement = rankMovement(leaders, p.participantId); return <li style={{"--row": Math.min(index, 12)} as CSSProperties} data-player={p.participantId} key={p.participantId} className={p.participantId === ownId ? 'is-you' : ''}><b className="standing-rank">{p.rank}</b><span className="standing-name">{p.nickname}{p.participantId === ownId && <small>You</small>}</span><span className={"standing-move " + (movement < 0 ? "move-down" : "")} aria-label={movement > 0 ? `Up ${movement} places` : movement < 0 ? `Down ${-movement} places` : 'No rank change'}>{movement > 0 ? '↑' + movement : movement < 0 ? '↓' + (-movement) : '—'}</span><span className="standing-score" key={p.points}><strong>{p.points.toLocaleString('en')}</strong>{p.roundPoints > 0 && <small>+{p.roundPoints} this round</small>}</span></li>; })}</ol>{!leaders.length && <p>No players yet.</p>}{!compact && leaders.length > 0 && <p className="standings-caption">{leaders.filter(p => p.rank === 1).map(p => p.nickname).join(' & ')} {leaders.filter(p => p.rank === 1).length > 1 ? 'share the lead' : 'leads overall'}. Equal scores share a place.</p>}</section>;
}
export function RoundPodium({ snapshot: s }: {
    snapshot: Snapshot;
}) {
    const rows = roundPlacements(s.leaderboard, s.roundAwards);
    const best = rows[0]?.roundPoints ?? 0;
    const winners = rows.filter(p => p.roundPoints === best);
    const ranks = [...new Set(rows.map(p => p.roundRank))].filter(rank => rank <= 3);
    const awards = new Map(s.roundAwards?.map(a => [a.participantId, a]));
    return <section className="round-podium" aria-label="Round podium"><span className="eyebrow">ROUND {s.roundIndex + 1} RESULTS</span><h2>{s.reveal?.skipped ? 'Round skipped' : !best ? 'No points awarded' : winners.length > 1 ? 'Tied round winners' : 'Round winner'}</h2>{best > 0 && <p className="winner-names">{winners.map(p => p.nickname).join(' · ')}</p>}<div className="round-podium-places">{ranks.map(rank => <div key={rank} className={'round-place place-' + rank}><div className="podium-medal" aria-hidden="true">{rank}</div>{rows.filter(p => p.roundRank === rank).map(p => <div className="podium-person" key={p.participantId}><strong>{p.nickname}</strong><b>+{p.roundPoints.toLocaleString('en')}</b>{awards.get(p.participantId)?.detail.solved === true && <small>Solved in {String(awards.get(p.participantId)?.detail.attemptsUsed)} guesses</small>}</div>)}<span>{rows.filter(p => p.roundRank === rank).length > 1 ? 'Tied ' : ''}#{rank}</span></div>)}</div><p className="result-rule">Equal points share a place. No speed tie-break.</p></section>;
}
export function RoundResults({ snapshot: s, onStage, busy = false }: {
    snapshot: Snapshot;
    onStage?: (stage: 'reveal' | 'podium' | 'standings' | 'auto') => void;
    busy?: boolean;
}) {
    const [started] = useState(() => Date.now());
    const [now, setNow] = useState(Date.now());
    const [manual, setManual] = useState<'reveal' | 'podium' | 'standings' | null>(null);
    const offset = useMemo(() => Date.parse(s.serverTime) - Date.now(), [s.serverTime]);
    const start = s.revealStartedAt ? Date.parse(s.revealStartedAt) - offset : started;
    const phase = manual ?? s.resultStage ?? 'standings';
    useEffect(() => { setManual(null); }, [s.resultStage, s.revealStartedAt]);
    useEffect(() => {
        if (manual || s.resultStage)
            return;
        const elapsed = Date.now() - start;
        const next = elapsed < RESULT_TIMINGS.reveal ? RESULT_TIMINGS.reveal : RESULT_TIMINGS.reveal + RESULT_TIMINGS.podium;
        if (elapsed >= next)
            return;
        const timer = setTimeout(() => setNow(Date.now()), Math.max(0, next - elapsed) + 10);
        return () => clearTimeout(timer);
    }, [start, now, manual, s.resultStage]);
    useEffect(() => { if (phase === 'podium' && s.leaderboard.some(p => p.roundPoints > 0))
        playCue('win'); }, [phase]);
    const rows = roundPlacements(s.leaderboard, s.roundAwards);
    const best = rows[0]?.roundPoints ?? 0;
    const winners = rows.filter(p => p.roundPoints === best);
    return <div className="round-results"><nav className="result-tabs" aria-label="Round results stages">{(['reveal', 'podium', 'standings'] as const).map((v, i) => <button key={v} aria-pressed={phase === v} disabled={busy} onClick={() => { if (onStage)
        onStage(v);
    else
        setManual(v); }}><span>0{i + 1}</span>{v === 'reveal' ? 'Answer' : v === 'podium' ? 'Round winners' : 'Placements'}</button>)}</nav>{onStage && <div className="results-host-note"><span>{s.resultStage ? "Holding this screen for everyone." : "Placements stay here until you start the next round."}</span>{s.resultStage && <button className="text-link" disabled={busy} onClick={() => onStage('standings')}>Show placements</button>}</div>}
 <PlayerScore snapshot={s}/><div className="result-winner-line" role="status">{best ? <>Round {winners.length > 1 ? 'winners' : 'winner'}: <strong>{winners.map(p => p.nickname).join(' · ')}</strong><b>+{best}</b></> : s.reveal?.skipped ? 'Round skipped · no points awarded' : 'No points awarded this round'}</div>
 {phase === 'reveal' ? <Reveal snapshot={s}/> : phase === 'podium' ? <RoundPodium snapshot={s}/> : <Standings leaders={s.leaderboard} ownId={s.participantId}/>}
 {s.role !== 'host' && phase === 'standings' && <p className="result-wait">Waiting for the host to start the next round.</p>}</div>;
}
