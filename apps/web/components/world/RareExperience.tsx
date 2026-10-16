'use client';
import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Lock, ArrowDown, SkipForward } from 'lucide-react';
import { PixelSprite } from './Sprites';
import { WorldScene } from './WorldScene';
import { rarityZone } from '../../lib/presentation';
import { playCue } from '../../lib/audio';
type Group = {
    answer: string;
    count: number;
    points: number;
};
export function RareAnswerControl({ value, onChange, onSubmit, disabled = false, busy = false }: {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    disabled?: boolean;
    busy?: boolean;
}) {
    const id = useId();
    return <form className="rare-answer-control" onSubmit={e => { e.preventDefault(); if (!disabled && !busy && value.trim())
        onSubmit(); }}>
  <div className="rare-companion"><PixelSprite kind="diver"/><span>THE QUIET REEF<br /><strong>Think beyond the obvious.</strong></span><PixelSprite kind="fish"/></div>
  <label htmlFor={id}>Your uncommon answer</label><input id={id} value={value} onChange={e => onChange(e.target.value)} maxLength={100} autoComplete="off" placeholder="What will nobody else think of?" disabled={disabled} required/>
  <p>A valid answer scores more when fewer players choose it.<br />Keep yours a secret until the reveal.</p>
  <button className="btn btn-primary btn-full" disabled={disabled || busy || !value.trim()}><Lock size={17}/>{busy ? 'Sending…' : disabled ? 'Answer locked' : 'Lock answer'}</button>
 </form>;
}
const zones = [{ id: 'surface', name: 'THE SHALLOWS', detail: '4+ players', icon: 'fish' }, { id: 'reef', name: 'THE HIDDEN REEF', detail: '2–3 players', icon: 'shell' }, { id: 'deep', name: 'THE DEEP DISCOVERY', detail: 'Just one player', icon: 'jelly' }] as const;
export function RareDepthReveal({ groups, ownAnswer }: {
    groups: Group[];
    ownAnswer?: string;
}) {
    const [skip, setSkip] = useState(false);
    useEffect(() => { playCue('reveal'); }, []);
    return <div className={`rare-depth-reveal ${skip ? 'reveal-skipped' : ''}`}>
  <div className="depth-heading"><div><span className="eyebrow">THE RARER THE ANSWER, THE DEEPER THE DIVE</span><p>Every discovery. Every point.</p></div><button className="btn btn-small" onClick={() => setSkip(true)} disabled={skip}><SkipForward size={15}/>{skip ? 'Results shown' : 'Skip animation'}</button></div>
  <div className="depth-expedition"><WorldScene ocean/><div className="depth-descent" aria-hidden="true"><PixelSprite kind="diver"/></div>
   {zones.map((zone, i) => <section className={`depth-zone zone-${zone.id}`} key={zone.id} aria-label={zone.name} style={{ '--zone': i } as CSSProperties}><div className="depth-zone-heading"><span>0{i + 1}</span><div><h3>{zone.name}</h3><p>{zone.detail}</p></div><PixelSprite kind={zone.icon}/></div><div className="depth-discoveries">{groups.filter(g => rarityZone(g.count) === zone.id).sort((a, b) => b.count - a.count || a.answer.localeCompare(b.answer)).map((g, j) => <article className={`depth-answer ${g.count === 1 ? 'unique' : ''}`} key={g.answer} style={{ '--delay': `${i * .65 + Math.min(j, 8) * .12}s` } as CSSProperties}><PixelSprite kind={g.count === 1 ? 'jelly' : 'fish'}/><div><strong>{g.answer}</strong><span>{g.count} {g.count === 1 ? 'player · one of a kind' : 'players'}{ownAnswer?.trim().toLowerCase() === g.answer.toLowerCase() ? ' · YOUR ANSWER' : ''}</span></div><b>+{g.points.toLocaleString()}<small>points</small></b></article>)}{!groups.some(g => rarityZone(g.count) === zone.id) && <p className="undiscovered">No answers at this depth.</p>}</div>{i < 2 && <ArrowDown className="depth-arrow" size={18}/>}</section>)}
  </div><p className="depth-note">Depth illustrates answer frequency. Points shown are the actual round results.</p>
 </div>;
}
