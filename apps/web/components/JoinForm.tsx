'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, LoaderCircle } from 'lucide-react';
import { post } from '../lib/api';
import {playCue} from '../lib/audio';
import { normalizePin } from '../lib/presentation';
export default function JoinForm({ initialPin = '', compact = false }: {
    initialPin?: string;
    compact?: boolean;
}) {
    const [pin, setPin] = useState(normalizePin(initialPin));
    const [stage, setStage] = useState<'pin' | 'name'>(/^\d{6}$/.test(initialPin) ? 'name' : 'pin');
    const [nickname, setNickname] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const nameRef = useRef<HTMLInputElement>(null);
    const pinRef = useRef<HTMLInputElement>(null);
    const inFlight = useRef(false);
    useEffect(() => { if (stage === 'name')
        nameRef.current?.focus(); }, [stage]);
    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (stage === 'pin') {
            if (pin.length !== 6) {
                setError('Enter the six-digit code shown by your host.');
                pinRef.current?.focus();
                return;
            }
            setStage('name');
            return;
        }
        if (inFlight.current || !nickname.trim())
            return;
        inFlight.current = true;
        setBusy(true);
        try {
            const result = await post<{
                sessionId: string;
            }>('/sessions/join', { pin, nickname: nickname.trim() });
            playCue('join');
            location.assign('/play/' + result.sessionId);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not join. Check the code with your host and try again.');
            setBusy(false);
            inFlight.current = false;
        }
    }
    return <form className={`harbor-join ${compact ? 'compact-join' : ''}`} onSubmit={submit} aria-label="Join a game">
    <div className="join-form-heading"><span className="eyebrow">{stage === 'pin' ? 'HAVE A ROOM CODE?' : `ROOM ${pin}`}</span></div>
    {stage === 'pin' ? <><label htmlFor={compact ? 'home-pin' : 'join-pin'}>Join a game</label><div className="join-input-row"><input ref={pinRef} id={compact ? 'home-pin' : 'join-pin'} aria-label="Game PIN" type="text" inputMode="numeric" autoComplete="off" value={pin} placeholder="000 000" maxLength={20} onChange={e => { setPin(normalizePin(e.target.value)); setError(''); }} aria-describedby="join-hint"/><button className="btn btn-primary" type="submit" aria-label="Continue to nickname">Join <ArrowRight size={18}/></button></div></> : <><label htmlFor={compact ? 'home-nickname' : 'join-nickname'}>Your nickname</label><div className="join-input-row"><input ref={nameRef} id={compact ? 'home-nickname' : 'join-nickname'} aria-label="Your nickname" value={nickname} maxLength={24} autoComplete="nickname" placeholder="Your nickname" onChange={e => setNickname(e.target.value)} required disabled={busy}/><button className="btn btn-primary" disabled={busy || !nickname.trim()}>{busy ? <LoaderCircle className="spin" size={18}/> : <ArrowRight size={18}/>}<span>{busy ? 'Joining…' : 'Join game'}</span></button></div><button type="button" className="join-back" disabled={busy} onClick={() => { setStage('pin'); setError(''); requestAnimationFrame(() => pinRef.current?.focus()); }}><ArrowLeft size={14}/> Change code</button></>}
    {error && <p className="join-error" role="alert">{error}</p>}
    <p id="join-hint" className="join-hint">No player account needed.</p>
  </form>;
}
