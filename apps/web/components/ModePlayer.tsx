'use client';
import { newId } from '../../../packages/contracts/src/id';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Minus, Plus, Lock, Send, RotateCcw, Delete, Check, LoaderCircle } from 'lucide-react';
import type { Snapshot, Ack, Round, Submission, PublicRound } from '../../../packages/contracts/src/index';
import { MODE_META } from '../../../packages/contracts/src/index';
import { post, ApiError } from '../lib/api';
import { Shape } from './ModeArt';
import { playCue } from '../lib/audio';
import { parseFermiNumber } from '../../../packages/game-modes/src/fermi';
import { RareAnswerControl } from './world/RareExperience';

import Amount from './game/AmountPlayer';
import Scratchpad from './game/Scratchpad';
import SubmissionReaction from './game/SubmissionReaction';
import { ScaleStage } from './game/ScaleStage';
export { ScaleStage } from './game/ScaleStage';
const graphemes=new Intl.Segmenter('en',{granularity:'grapheme'});

type Props = {
    disabled?: boolean;
    snapshot: Snapshot;
    onUpdate: () => void;
    onLocalSubmit?: (payload: Submission['payload'] | {
        guess: string;
    }) => Promise<Ack>;
};
export default function ModePlayer({ snapshot: s, onUpdate, onLocalSubmit, disabled: offline = false }: Props) {
    const r = s.round!;
    const [expired, setExpired] = useState(false);
    useEffect(() => { setExpired(false); if (s.state !== 'ROUND_ACTIVE' || !s.deadlineAt)
        return; const delay = Date.parse(s.deadlineAt) - Date.parse(s.serverTime); const timer = setTimeout(() => setExpired(true), Math.max(0, delay)); return () => clearTimeout(timer); }, [s.deadlineAt, s.state]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [acceptedPayload,setAcceptedPayload]=useState(s.ownSubmission?.payload);
    const [fresh,setFresh]=useState(false);
    const [locked, setLocked] = useState(!!s.ownSubmission?.payload.locked);
    const rev = useRef(s.ownSubmission?.revision ?? 0);
    const pending = useRef<{
        key: string;
        payload: Submission['payload'];
        revision: number;
    } | null>(null);
    useEffect(() => { rev.current = Math.max(rev.current, s.ownSubmission?.revision ?? 0); if (s.ownSubmission?.payload.locked)
        setLocked(true); }, [s.ownSubmission]);
    const inFlight = useRef(false);
    const send = useCallback(async (payload: Submission['payload']) => {
        if (offline || expired || s.state !== 'ROUND_ACTIVE' || inFlight.current)
            throw new Error('Controls are temporarily paused.');
        inFlight.current = true;
        setError('');
        setBusy(true);
        const deliver = async (item: NonNullable<typeof pending.current>) => {
            const ack = onLocalSubmit ? await onLocalSubmit(item.payload) : await post<Ack>(`/sessions/${s.id}/submissions`, { roundId: r.id, clientMutationId: item.key, revision: item.revision, payload: item.payload });
            pending.current = null;
            if (item.payload.locked){setLocked(true);setFresh(true);playCue("submit",r.mode,item.key);}
            setAcceptedPayload(item.payload);
            onUpdate();
            return ack;
        };
        try {
            if (pending.current) {
                const previous = pending.current;
                const ack = await deliver(previous);
                if (previous.payload.locked || JSON.stringify(previous.payload) === JSON.stringify(payload))
                    return ack;
            }
            pending.current = { key: newId(), payload, revision: ++rev.current };
            const ack = await deliver(pending.current);

            return ack;
        }
        catch (e) {
            if (e instanceof ApiError && e.status >= 400 && e.status < 500 && ![408, 429].includes(e.status))
                pending.current = null;
            playCue('error');
            setError(e instanceof Error ? e.message : 'Could not sync. Retry sends the same answer safely.');
            throw e;
        }
        finally {
            inFlight.current = false;
            setBusy(false);
        }
    }, [r.id, s.id, s.state, offline, expired, onLocalSubmit, onUpdate]);
    const disabled = offline || expired || s.state !== 'ROUND_ACTIVE' || locked;
    return <div aria-busy={busy} className={'mode-player player-' + r.mode + (locked ? ' mode-locked' : '')} style={{ '--mode-color': MODE_META[r.mode].color } as React.CSSProperties}><div className="mode-inputs">{r.mode === 'fermi' ? <Fermi round={r} disabled={disabled} busy={busy} value={s.ownSubmission?.payload.value} send={send}/> : r.mode === 'rare_answers' ? <Rare round={r} disabled={disabled} busy={busy} value={s.ownSubmission?.payload.text} send={send}/> : r.mode === 'word_puzzle' ? <Word disabled={disabled} snapshot={s} onUpdate={onUpdate} onLocalSubmit={onLocalSubmit} onError={setError}/> : r.mode === 'size_it_up' ? <Size round={r} disabled={disabled} busy={busy} initial={s.ownSubmission?.payload.ratio} send={send}/> : <Amount round={r} paused={s.state==="PAUSED"} disabled={disabled} busy={busy} initial={s.ownSubmission?.payload.count} send={send}/>}</div>{error && <div className="notice error" role="alert">{error}</div>}{locked && <SubmissionReaction animate={fresh} member={s.members.find(m=>m.id===s.participantId)} mode={r.mode} value={r.mode==="fermi"?String(acceptedPayload?.value??acceptedPayload?.text??s.ownSubmission?.payload.value??""):r.mode==="size_it_up"?(acceptedPayload?.ratio??s.ownSubmission?.payload.ratio??1).toFixed(2)+"×":r.mode==="rare_answers"?(acceptedPayload?.text??s.ownSubmission?.payload.text):String(acceptedPayload?.count??s.ownSubmission?.payload.count??0)} finished={s.finishedCount} players={s.members.filter(m=>m.status==="active").length}/>}<details className="game-rules"><summary>Rules & points</summary><p>{r.mode === "word_puzzle" ? "Correct on the first try earns 1,000 points. Each extra guess costs 150 points. Tile labels show right place, wrong place or not used." : r.mode === "rare_answers" ? "Only accepted answers score. Fewer matching players means more points, up to 1,000. Matching answers receive equal points." : r.mode === "amountle" ? "Your last accepted pour is scored, up to 1,000 points. Closer to the answer earns more. There is no undo." : "The closer you are to the answer, the more you earn: up to 1,000 points."} No speed bonus.</p></details><div className="sync-hint" role="status">{busy ? <><LoaderCircle size={13} className="spin"/> Sending to the host…</> : s.ownSubmission ? null : expired ? 'Time is up. No answer was received.' : r.mode !== 'word_puzzle' ? 'Your answer stays private until the reveal.' : ''}</div></div>;
}
type ControlProps = {
    round: PublicRound;
    disabled: boolean;
    busy: boolean;
    send: (p: Submission['payload']) => Promise<Ack>;
};
function Fermi({ round, disabled, busy, value, send }: ControlProps & {
    value?: number;
}) { const c = round.publicConfig as Extract<Round, {
    mode: 'fermi';
}>['publicConfig']; const [text, setText] = useState(value?.toString() ?? ''); let preview = '',validNumber=false; try {
    if (text.trim())
        {const parsed=parseFermiNumber(text);validNumber=parsed>=c.min&&parsed<=c.max;preview=validNumber?parsed.toLocaleString('en')+' '+c.unit:`Choose a number from ${c.min.toLocaleString('en')} to ${c.max.toLocaleString('en')}`;}
}
catch {
    preview = 'Enter a number';
} ; return <form onSubmit={e => { e.preventDefault(); void send({ text, locked: true }).catch(() => { }); }}><div className="number-entry"><label htmlFor="fermi-value">YOUR BEST ESTIMATE</label><input autoComplete="off" id="fermi-value" inputMode="decimal" placeholder="0" value={text} onChange={e => setText(e.target.value)} disabled={disabled} required aria-describedby="fermi-hint"/><span>{c.unit}</span></div><p className="estimate-preview" aria-live="polite">{preview || ""}</p><p className="control-hint" id="fermi-hint">K, M and B are accepted. Range {c.min.toLocaleString('en')} to {c.max.toLocaleString('en')} {c.unit}.</p><Scratchpad/><button className="btn btn-dark btn-full" disabled={disabled || busy || !text.trim() || !validNumber}><Lock size={17}/>{busy?'Sending…':'Lock estimate'}</button></form>; }
function Rare({ disabled, busy, value, send }: ControlProps & {
    value?: string;
}) {
    const [text, setText] = useState(value ?? '');
    return <RareAnswerControl value={text} onChange={setText} disabled={disabled} busy={busy} onSubmit={() => void send({ text, locked: true }).catch(() => { })}/>;
}
function Word({ snapshot: s, onUpdate, onLocalSubmit, onError, disabled }: {
    disabled: boolean;
    snapshot: Snapshot;
    onUpdate: () => void;
    onLocalSubmit?: Props['onLocalSubmit'];
    onError: (v: string) => void;
}) {
    const r = s.round!;
    const c = r.publicConfig as Extract<Round, {
        mode: 'word_puzzle';
    }>['publicConfig'];
    const [guess, setGuess] = useState('');
    const [freshWord,setFreshWord]=useState(false);
    const [busy, setBusy] = useState(false);
    const attempts = s.ownAttempts;
    const solved = attempts.some(a => a.solved);
    const pendingGuess = useRef<{
        guess: string;
        key: string;
    } | null>(null);
    const sending = useRef(false);
    const finished = disabled || solved || attempts.length >= c.maxAttempts || s.state !== 'ROUND_ACTIVE';
    const chars = Array.from(graphemes.segment(guess), x => x.segment);
    const guessRows=attempts.map(a=>Array.from(graphemes.segment(a.guess),x=>x.segment));
    const keys: Record<string, string> = {};
    for (const a of attempts)
        Array.from(graphemes.segment(a.guess), x => x.segment).forEach((l, i) => { const f = a.feedback[i]; if (keys[l] !== 'exact' && (f === 'exact' || keys[l] !== 'present'))
            keys[l] = f; });
    async function submit() {
        if (finished || sending.current || chars.length !== c.length)
            return;
        sending.current = true;
        setBusy(true);
        onError('');
        const item = pendingGuess.current ?? { guess, key: newId() };
        pendingGuess.current = item;
        try {
            const result = onLocalSubmit ? await onLocalSubmit({guess:item.guess}) : await post<Ack>(`/sessions/${s.id}/word-guesses`, {roundId:r.id,clientMutationId:item.key,guess:item.guess});
            pendingGuess.current = null;
            setGuess('');
            setFreshWord(true);
            playCue(result.solved ? 'win' : 'reveal','word_puzzle',item.key);
            onUpdate();
        }
        catch (e) {
            if (e instanceof ApiError && e.status >= 400 && e.status < 500 && ![408, 429].includes(e.status))
                pendingGuess.current = null;
            playCue('error');
            onError(e instanceof Error ? e.message : 'Guess not accepted. Retry safely.');
        }
        finally {
            sending.current = false;
            setBusy(false);
        }
    }
    useEffect(() => { if (pendingGuess.current && attempts.some(a => a.clientMutationId === pendingGuess.current?.key)) {
        pendingGuess.current = null;
        setGuess('');
        onError('');
    } }, [attempts, onError]);
    function key(k: string) { if (finished || busy || (pendingGuess.current && k !== 'Enter'))
        return; if (k === 'Enter') {
        void submit();
        return;
    } if (k === 'Backspace') {
        playCue('letter');
        setGuess(chars.slice(0, -1).join(''));
        return;
    } if (/^[a-zA-Z]$/.test(k) && chars.length < c.length)
        { playCue('letter'); setGuess(v => v + k.toUpperCase()); } }
    useEffect(() => { const fn = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.matches('input,textarea,select'))
        return; if (/^[a-zA-Z]$/.test(e.key) || ['Enter', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        key(e.key);
    } }; window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn); });
    if(solved || attempts.length>=c.maxAttempts)return <SubmissionReaction animate={freshWord} member={s.members.find(m=>m.id===s.participantId)} mode="word_puzzle" solved={solved} value={attempts.at(-1)?.guess} attempts={attempts.length} finished={s.finishedCount} players={s.members.filter(m=>m.status==="active").length}/>;
    return <div className="word-game"><div className="word-grid" role="group" aria-label="Word guesses" style={{ '--letters': c.length } as React.CSSProperties}>{Array.from({ length: c.maxAttempts }, (_, i) => <div className={"word-row "+(freshWord&&i===attempts.length-1?"just-resolved":"")} key={i}>{Array.from({ length: c.length }, (_, j) => { const a = attempts[i]; const letters = a ? guessRows[i] : i === attempts.length ? chars : []; return <span key={j} className={'word-tile ' + (a ? a.feedback[j] : letters[j] ? 'filled' : '')} style={{ '--i': j } as React.CSSProperties} aria-label={letters[j] ? `${letters[j]}, ${a ? a.feedback[j] : 'not submitted'}` : 'empty'}>{letters[j] ?? ''}</span>; })}</div>)}</div><div className="word-legend"><span><i className="exact"/>Right place</span><span><i className="present"/>Wrong place</span><span><i className="absent"/>Not used</span></div>{solved ? <p className="answer-confirmation"><Check size={18}/> Solved in {attempts.length} {attempts.length === 1 ? 'guess' : 'guesses'}.</p> : <><label className="sr-only" htmlFor="word-input">Type a {c.length}-letter guess</label><input id="word-input" autoFocus className="word-accessible-input" value={guess} onChange={e => setGuess(e.target.value.toUpperCase().replace(/[^\p{L}\p{M}]/gu, '').slice(0, c.length * 2))} placeholder="Or type your word here" disabled={finished || busy || !!pendingGuess.current} onKeyDown={e => { if (e.key === 'Enter') {
        e.preventDefault();
        void submit();
    } }} autoComplete="off" autoCapitalize="characters"/><p className="word-attempt-count" role="status">Guess {Math.min(attempts.length+1,c.maxAttempts)} of {c.maxAttempts} · repeated letters count separately</p><div className="word-keyboard">{['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, i) => <div key={row}>{i === 2 && <button className="wide-key" onClick={() => key('Enter')} disabled={finished || busy} aria-label="Submit guess"><Send size={14}/></button>}{row.split('').map(k => <button className={keys[k] ?? ''} key={k} onClick={() => key(k)} disabled={finished || busy} aria-label={`${k}${keys[k] ? ', ' + keys[k] : ''}`}>{k}</button>)}{i === 2 && <button className="wide-key" onClick={() => key('Backspace')} disabled={finished || busy} aria-label="Delete letter"><Delete size={17}/></button>}</div>)}</div><button className="btn btn-dark btn-full" onClick={() => void submit()} disabled={finished || busy || chars.length !== c.length}>Check word <ArrowEnter /></button></>}</div>;
}
function ArrowEnter() { return <span aria-hidden="true">↵</span>; }
function Size({ round, disabled, busy, initial, send }: ControlProps & {
    initial?: number;
}) { const c = round.publicConfig as Extract<Round, {
    mode: 'size_it_up';
}>['publicConfig']; const startRatio=(c.minRatio+c.maxRatio)/2; const [ratio, setRatio] = useState(initial ?? startRatio); return <div>{/calibration|resize.*\bto\s+\d/i.test(round.question)&&<p className="calibration-note">Calibration exercise · the prompt gives the target measurement.</p>}<ScaleStage round={round} ratio={ratio} onRatio={disabled ? undefined : setRatio}/><div className="scale-values"><span>{c.referenceLabel}<strong>{c.referenceSize} {c.unit}</strong></span><span>{c.targetLabel}<strong>Your estimate</strong></span></div><label className="slider-label" htmlFor="size-ratio">Slide to resize <span>Smaller — Larger</span></label><input id="size-ratio" className="size-slider" type="range" min={c.minRatio} max={c.maxRatio} step="0.01" aria-valuetext={`${ratio.toFixed(2)} times the reference`} value={ratio} onChange={e => setRatio(Number(e.target.value))} disabled={disabled}/><div className="step-controls"><button className="icon-btn" aria-label="Decrease size by 0.01 times the reference" disabled={disabled} onClick={() => setRatio(v => Math.max(c.minRatio, v - .01))}><Minus size={19}/></button><button className="icon-btn" aria-label="Increase size by 0.01 times the reference" disabled={disabled} onClick={() => setRatio(v => Math.min(c.maxRatio, v + .01))}><Plus size={19}/></button><button className="text-link" disabled={disabled} onClick={() => setRatio(startRatio)}><RotateCcw size={14}/> Reset</button></div><button className="btn btn-dark btn-full" disabled={disabled || busy} onClick={() => void send({ ratio, locked: true }).catch(() => { })}><Lock size={17}/>{busy?'Sending…':'Lock size'}</button></div>; }
