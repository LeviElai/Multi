'use client';
import { memo, useEffect, useState } from 'react';
import { remainingSeconds } from '../lib/presentation';
export const RoundClock = memo(function RoundClock({ deadline, pausedMs, offset, paused = false, duration, variant = 'timer' }: {
    deadline?: string | null;
    pausedMs?: number | null;
    offset: number;
    paused?: boolean;
    duration: number;
    variant?: 'timer' | 'track' | 'countdown';
}) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => { setNow(Date.now()); if (paused)
        return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [deadline, paused]);
    const remaining = remainingSeconds(deadline, pausedMs, offset, now);
    if (variant === 'track')
        return <div className="timer-track"><span style={{ transform: `scaleX(${Math.min(1, remaining / duration)})` }}/></div>;
    if (variant === 'countdown')
        return <strong className="countdown-number">{Math.max(1, remaining)}</strong>;
    return <div className={`round-timer ${remaining < 10 ? 'urgent' : ''}`} role="timer" aria-label={paused ? 'Paused' : `${remaining} seconds remaining`}>{paused ? 'Ⅱ' : remaining}<small>{paused ? 'paused' : 'sec'}</small></div>;
});
