'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import layout from './Live.module.css';
import { Play, Pause, Plus, SkipForward, Square, Lock, Unlock, Copy, Check, Monitor, Users, Wifi, WifiOff, ArrowRight, ArrowLeft, X, RotateCcw } from 'lucide-react';
import type { Snapshot, HostAction, Profile } from '../../../packages/contracts/src/index';
import { MODE_META } from '../../../packages/contracts/src/index';
import { api, post, ApiError } from '../lib/api';
import {PlayerIdentity,CharacterEditor} from './game/PlayerIdentity';
import { PixelSprite } from './world/Sprites';
import { Brand, SoundToggle } from './Brand';
import { ModeArt } from './ModeArt';
import ModePlayer from './ModePlayer';
import {useRoundPresentation} from './game/physical-motion';
import { RoundClock } from './RoundClock';
import { RoundResults, Standings, PlayerScore } from './game/Competition';
import { WorldScene } from './world/WorldScene';
import { GameIntro } from './world/GameWorld';
import { Atmosphere } from './world/Atmosphere';
import Reveal, { Leaderboard, Podium } from './Reveal';
export default function Live({ id, role = 'player', displayToken }: {
    id?: string;
    role?: 'host' | 'player' | 'display';
    displayToken?: string;
}) {
    const [rawSnapshot, setS] = useState<Snapshot | null>(null);
    const s=useRoundPresentation(rawSnapshot);
    const [error, setError] = useState('');
    const [connected, setConnected] = useState(true);
    const [restored, setRestored] = useState(false);
    const [busy, setBusy] = useState(false);
    const offset = useRef(0);
    const failed = useRef(false);
    const terminalSnapshot=useRef(false);
    const socketOnline=useRef(false),fetching=useRef(false);
    const [showLeaders, setShowLeaders] = useState(role !== 'player');
    const [pair, setPair] = useState('');
    const [confirm, setConfirm] = useState<HostAction['action'] | null>(null);
    const endpoint = displayToken ? `/display/${displayToken}/snapshot` : `/sessions/${id}/snapshot?role=${role}`;
    const requestId = useRef(0);
    const accepted = useRef<{
        version: number;
        seq: number;
    } | null>(null);
    useEffect(() => {
        if (!pair && !confirm)
            return;
        const previous = document.activeElement as HTMLElement | null;
        const dialog = document.querySelector<HTMLElement>('[aria-modal="true"]');
        const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]') ?? []);
        controls()[0]?.focus();
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setPair('');
                setConfirm(null);
            }
            if (e.key === 'Tab') {
                const items = controls();
                if (!items.length)
                    return;
                const index = items.indexOf(document.activeElement as HTMLElement);
                if (e.shiftKey && index <= 0) {
                    e.preventDefault();
                    items.at(-1)?.focus();
                }
                else if (!e.shiftKey && index === items.length - 1) {
                    e.preventDefault();
                    items[0].focus();
                }
            }
        };
        document.addEventListener('keydown', handler);
        return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
    }, [pair, confirm]);
    const accept = useCallback((snapshot: Snapshot) => { const old = accepted.current; if (old && (snapshot.stateVersion < old.version || (snapshot.stateVersion === old.version && snapshot.latestSeq < old.seq)))
        return; terminalSnapshot.current=['SESSION_COMPLETED','SESSION_ABORTED'].includes(snapshot.state);accepted.current = { version: snapshot.stateVersion, seq: snapshot.latestSeq }; offset.current = Date.parse(snapshot.serverTime) - Date.now(); if(!old||snapshot.stateVersion!==old.version||snapshot.latestSeq!==old.seq)setS(snapshot); if (failed.current) {
        setRestored(true);
        setTimeout(() => setRestored(false), 3500);
    } failed.current = false; setConnected(true); setError(''); }, []);
    const refresh = useCallback(async () => { if(fetching.current)return;fetching.current=true;const serial = ++requestId.current; try {
        const snapshot = await api<Snapshot>(endpoint);
        if (serial === requestId.current)
            accept(snapshot);
    }
    catch (e) {
        if (serial !== requestId.current)
            return;
        failed.current = true;
        setConnected(false);
        setError(e instanceof Error ? e.message : 'Connection interrupted.');
    } finally{fetching.current=false;} }, [endpoint, accept]);
    useEffect(() => { void refresh(); let timer: ReturnType<typeof setTimeout>; let stopped = false; async function poll() { await refresh(); if (!stopped&&!terminalSnapshot.current)
        timer = setTimeout(poll, document.hidden?15000:failed.current?3500:socketOnline.current?8000:1800); } timer = setTimeout(poll, 1800); const focus = () => void refresh(); window.addEventListener('online', focus); window.addEventListener('focus', focus); return () => { stopped = true; clearTimeout(timer); window.removeEventListener('online', focus); window.removeEventListener('focus', focus); }; }, [refresh]);
    useEffect(() => { let close: (() => void) | undefined; let canceled = false; void api<Profile['features']>('/features').then(async (p) => { if (p?.transport !== 'socket' || displayToken)
        return; const { io } = await import('socket.io-client'); if (canceled)
        return; const socket = io({ path: '/socket.io', withCredentials: true, auth: { sessionId: id, role }, transports: ['websocket', 'polling'] }); socket.on('session.snapshot', accept); socket.on('connect', () => {socketOnline.current=true;void refresh();}); socket.on('disconnect', () => {socketOnline.current=false;setConnected(false);}); close = () => { socket.disconnect(); }; }).catch(() => { }); return () => { canceled = true; close?.(); }; }, [id, role, displayToken, accept, refresh]);
    const action = async (a: HostAction['action'], args?: HostAction['args']) => { if (!s)
        return; setBusy(true); setError(''); try {
        await post(`/sessions/${s.id}/host-actions`, { action: a, expectedStateVersion: s.stateVersion, args });
        setConfirm(null);
        await refresh();
    }
    catch (e) {
        await refresh();
        setError(e instanceof Error ? e.message : 'Action failed.');
    }
    finally {
        setBusy(false);
    } };
    if (!s)
        return <div className="game-shell"><div className="game-header"><Brand /><Link className="text-link" href="/join">Join a game</Link></div><div className="loading-stage">{error ? <><WifiOff size={40}/><h1>Let's reconnect.</h1><p role="alert">{error}</p><button className="btn btn-dark" onClick={() => void refresh()}><RotateCcw size={17}/> Try again</button><Link href="/join" className="text-link">Return to joining</Link></> : <><div className="loading-blocks"><i /><i /><i /></div><h2>Finding your room…</h2></>}</div></div>;
    const meta = s.round ? MODE_META[s.round.mode] : null;
    const host = role === 'host';
    const terminal = ['SESSION_COMPLETED', 'SESSION_ABORTED'].includes(s.state);
    const canNext = s.state === 'ROUND_REVEAL';
    const resultPhase=!!s.automatic && (s.phase==='reveal'||s.phase==='placements');
    const reading=s.phase==='reading'||s.state==='ROUND_PREPARE'||s.state==='ROUND_COUNTDOWN';
    const active = !reading && !resultPhase && ['ROUND_ACTIVE', 'PAUSED'].includes(s.state);
    return <div className={(active && role==='player'?layout.playing+' ':'')+'game-shell world-' + (s.round?.mode ?? 'size_it_up') + ' ' + (role === 'display' ? 'projector-shell' : '') + (s.theme === 'midnight' ? ' midnight' : '') + (s.round?.mode === 'fish' ? ' reef-live' : '')} style={{ '--mode-color': meta?.color ?? '#e7ed59' } as React.CSSProperties}><div className="game-world-art" aria-hidden="true"/><Atmosphere/><header className="game-header"><Brand /><div className="room-label">{host ? 'HOST DESK' : role === 'display' ? 'ON THE BIG SCREEN' : 'IN THE GAME'}{s.pin && <span>PIN {s.pin}</span>}</div><div className="game-tools"><span className={'connection ' + (connected ? '' : 'offline')} role="status">{connected ? <Wifi size={14}/> : <WifiOff size={14}/>}<span>{restored ? 'Restored' : connected ? 'Connected' : 'Reconnecting'}</span></span><SoundToggle />{active && <button className="icon-btn" onClick={() => setShowLeaders(v => !v)} aria-label="Overall standings" aria-expanded={showLeaders}><Users size={19}/></button>}</div></header>{!connected && <div className="connection-banner" role="alert">Connection interrupted. Controls pause until a fresh snapshot arrives. Your last acknowledged answer is saved.</div>}{error && connected && <div className="notice error" role="alert">{error}</div>}{terminal ? <div className="page"><Podium snapshot={s}/></div> : s.state === 'LOBBY' ? <Lobby snapshot={s} host={host} busy={busy} connected={connected} onAction={action} onRefresh={refresh} onPair={async () => { try {
        const result = await post<{
            token: string;
            displayToken?: string;
            displayUrl?: string;
        }>(`/sessions/${s.id}/display-pairing`, {});
        setPair(result.displayUrl ?? `/display/${result.displayToken ?? result.token}`);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Could not pair.');
    } }}/> : <main className="live-main"><div className="round-meta"><span className="mode-pill"><span>{s.round && <PixelSprite kind={s.round.mode}/>}</span>{meta?.name}</span><span>ROUND {String(s.roundIndex + 1).padStart(2, '0')} / {String(s.roundCount).padStart(2, '0')}</span>{active && <RoundClock deadline={s.deadlineAt} pausedMs={s.pausedRemainingMs} offset={offset.current} paused={s.state === 'PAUSED'} duration={s.round!.timerSeconds}/>}</div>{active && <RoundClock deadline={s.deadlineAt} pausedMs={s.pausedRemainingMs} offset={offset.current} paused={s.state === 'PAUSED'} duration={s.round!.timerSeconds} variant="track"/>}{!resultPhase && !['ROUND_REVEAL', 'INTERMISSION'].includes(s.state) && <h1 className="round-question">{s.round?.question}</h1>}{resultPhase ? <RoundResults key={s.round!.id} snapshot={s}/> : reading ? <section className="round-intro reading-phase" aria-label="Read the question"><PixelSprite kind={s.round!.mode}/><span>{s.state==='PAUSED'?'Paused':'Starts in'}</span><RoundClock deadline={s.deadlineAt} pausedMs={s.pausedRemainingMs} paused={s.state==='PAUSED'} offset={offset.current} duration={5} variant="countdown"/></section> : active ? <div className={'active-layout ' + (host || role === 'display' ? 'audience-view' : '')}><div className="play-area">{s.state === 'PAUSED' && <div className="pause-overlay" role="status"><Pause size={38}/><h2>Paused</h2><p>The host paused the clock. Your answer is safe.</p></div>}{!host && role !== 'display' ? <div className={!connected ? 'disabled-play' : ''} aria-disabled={!connected}><ModePlayer key={s.round!.id} snapshot={s} disabled={!connected} onUpdate={refresh}/><PlayerScore snapshot={s}/></div> : <><GameIntro mode={s.round!.mode}/><div className="room-progress"><strong>{s.answerCount}<span>/{s.members.filter(m => m.status === 'active').length}</span></strong><p>{s.round?.mode === 'word_puzzle' ? `${s.solvedCount} solved · ${s.answerCount} have guessed` : 'answers received'}</p><progress className="room-answer-progress" max={s.members.filter(m => m.status === 'active').length || 1} value={s.answerCount} aria-label="Answers received"/><p className="control-hint">Answers stay private until the reveal.</p></div></>}</div>{showLeaders && <Standings leaders={s.leaderboard} ownId={s.participantId} compact/>}</div> : s.state === 'REVIEW_REQUIRED' ? host ? <><p className="notice">Review time: 30 seconds. Unreviewed answers won’t score.</p><ReviewQueue snapshot={s} refresh={refresh} setError={setError}/></> : <div className="waiting-stage"><span className="waiting-symbol">✳</span><h2>Answer review</h2><p>The host is checking unexpected answers. Scores will follow.</p></div> : s.state === 'ROUND_SCORED' ? <div className="waiting-stage"><span className="waiting-symbol">✓</span><h2>Round complete.</h2><p>{host ? 'Show round results.' : 'Waiting for the host to reveal the answer.'}</p></div> : s.state === 'ROUND_REVEAL' || s.state === 'INTERMISSION' ? <><RoundResults key={s.round!.id} snapshot={s} busy={busy} onStage={host ? (stage) => void action('RESULT_STAGE', { stage }) : undefined}/></> : <div className="waiting-stage"><div className="loading-blocks"><i /><i /><i /></div><h2>Scoring…</h2><p>Your answers are locked.</p></div>}</main>}{host && !terminal && s.state !== "LOBBY" && (s.automatic ? <div className="host-control-bar auto-host-controls"><span>{s.state==="REVIEW_REQUIRED"?"Answer review":reading?"Reading":s.phase==="reveal"?"Answer reveal":s.phase==="placements"?"Placements":"Playing"}</span><RoundClock deadline={s.deadlineAt} pausedMs={s.pausedRemainingMs} paused={s.state==="PAUSED"} offset={offset.current} duration={reading?5:s.phase==="reveal"?5.5:s.phase==="placements"?10:s.round!.timerSeconds}/><button className="btn btn-outline btn-small" disabled={busy||!connected||s.state==="REVIEW_REQUIRED"} onClick={()=>void action(s.state==="PAUSED"?"RESUME":"PAUSE")}>{s.state==="PAUSED"?<Play size={15}/>:<Pause size={15}/>} {s.state==="PAUSED"?"Resume":"Pause"}</button><button className="btn btn-primary btn-small" disabled={busy||!connected} onClick={()=>void action("ADVANCE")}>{s.state==="REVIEW_REQUIRED"?"Finish review":reading?"Start now":s.phase==="play"?"Finish round":s.phase==="reveal"?"Continue":"Next round"} <ArrowRight size={15}/></button><button className="btn btn-outline btn-small" disabled={busy||!connected||resultPhase} onClick={()=>setConfirm("SKIP")}>Skip round</button><button className="icon-btn danger" title="End game" aria-label="End game" onClick={()=>setConfirm("END")} disabled={busy||!connected}><Square size={15}/></button></div> : <div className="host-control-bar"><div><span className="eyebrow">HOST CONTROLS</span><span>{s.answerCount} answers received</span></div><div className="host-buttons">{s.state === 'ROUND_ACTIVE' && <><button className="btn btn-outline btn-small" onClick={() => void action('PAUSE')} disabled={busy || !connected}><Pause size={16}/> Pause</button><button className="btn btn-outline btn-small" onClick={() => void action('EXTEND', { seconds: 15 })} disabled={busy || !connected}><Plus size={16}/> 15 sec</button><button className="btn btn-dark btn-small" onClick={() => void action('LOCK')} disabled={busy || !connected}><Lock size={16}/> Lock round</button></>}{s.state === 'PAUSED' && <button className="btn btn-dark" onClick={() => void action('RESUME')} disabled={busy || !connected}><Play size={16}/> Resume</button>}{s.state === 'ROUND_SCORED' && <button className="btn btn-primary" onClick={() => void action('REVEAL')} disabled={busy || !connected}>Reveal answer <ArrowRight size={17}/></button>}{canNext && <button className="btn btn-primary" onClick={() => void action('NEXT')} disabled={busy || !connected}>{s.roundIndex === s.roundCount - 1 ? 'Final results' : 'Next round'} <ArrowRight size={17}/></button>}{!canNext && <button className="icon-btn" title="Skip round" aria-label="Skip round" onClick={() => setConfirm('SKIP')} disabled={busy || !connected}><SkipForward size={17}/></button>}<button className="icon-btn danger" title="End game" aria-label="End game" onClick={() => setConfirm('END')} disabled={busy || !connected}><Square size={15}/></button></div></div>)}{pair && <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="pair-title" className="modal"><button className="modal-close icon-btn" onClick={() => setPair('')} aria-label="Close display link"><X /></button><Monitor size={32}/><h2 id="pair-title">Shared display</h2><p>Open this read-only link on your display. It expires automatically and never grants host controls.</p><a className="btn btn-dark" href={pair} target="_blank" rel="noreferrer">Open display <ArrowRight size={17}/></a><button className="btn btn-outline" onClick={() => void navigator.clipboard.writeText(new URL(pair, location.origin).toString())}>Copy display link</button><button className="text-link danger" onClick={async () => { try {
        await api(`/sessions/${s.id}/display-pairing`, { method: 'DELETE' });
        setPair('');
    }
    catch (e) {
        setError(String(e));
    } }}>Revoke all display links</button></section></div>}{confirm && <div className="modal-backdrop"><section role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="modal"><h2 id="confirm-title">{confirm === 'SKIP' ? 'Skip this round?' : 'End this game?'}</h2><p>{confirm === 'SKIP' ? 'This round will award zero points. Earlier scores will stay unchanged.' : 'The room will close. Completed round scores will remain available.'}</p><div className="button-row"><button autoFocus className="btn btn-outline" onClick={() => setConfirm(null)}>Keep playing</button><button className="btn btn-dark" onClick={() => void action(confirm)} disabled={busy}>Yes, {confirm === 'SKIP' ? 'skip round' : 'end game'}</button></div></section></div>}</div>;
}
function Lobby({ snapshot: s, host, busy, connected, onAction, onPair, onRefresh }: {
    snapshot: Snapshot;
    host: boolean;
    busy: boolean;
    connected: boolean;
    onAction: (a: HostAction['action'], args?: HostAction['args']) => Promise<void>;
    onPair: () => void;
    onRefresh: () => Promise<void>;
}) { const [readingSeconds,setReadingSeconds]=useState(5);const [qr, setQr] = useState(''); const [copied, setCopied] = useState(false); const members = s.members.filter(m => m.status === 'active'); useEffect(() => { if (!s.pin)
    return; void import('qrcode').then(q => q.toDataURL(`${location.origin}/join/${s.pin}`, { width: 220, margin: 1, color: { dark: '#20211f', light: '#f5f2e9' } })).then(setQr).catch(() => setQr('')); }, [s.pin]); return <main className="lobby"><div className="lobby-heading"><span className="eyebrow">{host ? 'LOBBY' : 'LOBBY'}</span><h1>{s.title}</h1><p>{host ? 'Share the code. Start when everyone is here.' : 'Waiting for the host to start.'}</p></div>{s.pin && <div className="join-ticket"><div><span className="eyebrow">JOIN WITH THIS PIN</span><div className="big-pin" aria-label={`Game PIN ${s.pin.split('').join(' ')}`}>{s.pin.slice(0, 3)}<span /> {s.pin.slice(3)}</div><button className="text-link" onClick={() => { navigator.clipboard.writeText(`${location.origin}/join/${s.pin}`).then(() => setCopied(true)).catch(() => { }); }}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Join link copied' : 'Copy join link'}</button></div><div className="ticket-perf"/><div className="qr-wrap">{qr ? <img src={qr} alt="Scan to join this room" width="156" height="156"/> : <span>Use the PIN to join</span>}<span>SCAN TO JOIN</span></div></div>}<div className="lobby-members"><div className="section-head"><h2><Users size={20}/> {members.length} {members.length === 1 ? 'player' : 'players'} in</h2><span>{members.length} / {s.maxPlayers} spots</span></div>{members.length ? <div className="member-grid">{members.map((m, i) => <div key={m.id} className="member-tile" style={{ '--avatar-color': ['#e7ed59', '#eca7d0', '#a9bdf6', '#a8c5ac', '#ff8c56'][i % 5] } as React.CSSProperties}><PlayerIdentity id={m.id} name={m.nickname} avatar={m.avatar} mood={m.id===s.participantId?"join":"still"}/>{m.id===s.participantId&&m.avatar&&<CharacterEditor member={m} sessionId={s.id} onSaved={()=>void onRefresh()}/>}{host && <button className="icon-btn" aria-label={`Remove ${m.nickname}`} onClick={() => { if (window.confirm(`Remove ${m.nickname} from this room?`))
    void onAction('KICK', { participantId: m.id }); }}><X size={14}/></button>}</div>)}</div> : <div className="empty-lobby"><div className="empty-chairs"><i /><i /><i /></div><h3>Waiting for players</h3><p>Share the PIN above. Your players will appear here.</p></div>}</div>{host ? <><label className="reading-setting">Reading time <select value={readingSeconds} onChange={e=>setReadingSeconds(Number(e.target.value))}><option value={5}>5 seconds</option><option value={8}>8 seconds</option><option value={12}>12 seconds</option></select></label><div className="lobby-controls"><button className="btn btn-outline" onClick={() => void onAction(s.joinLocked ? 'UNLOCK_JOIN' : 'LOCK_JOIN')} disabled={busy || !connected}>{s.joinLocked ? <Lock size={17}/> : <Unlock size={17}/>} {s.joinLocked ? 'Unlock joining' : 'Lock joining'}</button><button className="btn btn-outline" onClick={onPair}><Monitor size={17}/> Shared display</button><button className="btn btn-primary" onClick={() => void onAction('START',{seconds:readingSeconds})} disabled={busy || !connected || members.length < 1}><Play size={17} fill="currentColor"/> Start game</button></div><p className="control-hint">{members.length < 2 ? 'You can start with one player.' : `${s.roundCount} rounds.`}</p></> : <div className="waiting-player"><span className="status-dot"/> You're in. Waiting for the host…</div>}</main>; }
function ReviewQueue({ snapshot: s, refresh, setError }: {
    snapshot: Snapshot;
    refresh: () => Promise<void>;
    setError: (e: string) => void;
}) { const [canonical, setCanonical] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(''); async function decide(key: string, decision: 'accept' | 'reject', text: string) { setBusy(key); try {
    await post(`/sessions/${s.id}/rare-review`, { roundId: s.round!.id, answerKey: key, decision, canonical: canonical[key] ?? text, expectedStateVersion: s.stateVersion });
    await refresh();
}
catch (e) {
    setError(e instanceof Error ? e.message : 'Could not save decision.');
}
finally {
    setBusy('');
} } return <section className="review-panel"><span className="eyebrow">HOST'S CALL</span><h2>A few answers need your eye.</h2><p>Merge aliases into the same canonical answer. Rarity is recalculated after every decision.</p>{s.review?.map(r => <div className="review-row" key={r.answerKey}><div><strong>{r.text}</strong><small>{r.count} {r.count === 1 ? 'player' : 'players'}</small></div><label className="field"><span>Canonical answer</span><input value={canonical[r.answerKey] ?? r.text} maxLength={100} onChange={e => setCanonical(v => ({ ...v, [r.answerKey]: e.target.value }))}/></label><button className="btn btn-dark btn-small" disabled={!!busy} onClick={() => void decide(r.answerKey, 'accept', r.text)}>Accept</button><button className="btn btn-outline btn-small" disabled={!!busy} onClick={() => void decide(r.answerKey, 'reject', r.text)}>Reject</button></div>)}</section>; }
