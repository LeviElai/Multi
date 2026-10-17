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
  <label htmlFor={id}>Your answer</label><input id={id} value={value} onChange={e => onChange(e.target.value)} maxLength={100} autoComplete="off" placeholder="Type one answer" autoCapitalize="none" spellCheck={false} disabled={disabled} required/>
  <p>Valid answer: 200 points + a rarity bonus. Minor typos are okay.</p>
  <button className="btn btn-primary btn-full" disabled={disabled || busy || !value.trim()}><Lock size={17}/>{busy ? 'Sending…' : disabled ? 'Answer locked' : 'Lock answer'}</button>
 </form>;
}
export function RareDepthReveal({groups,ownAnswer,participants=[],roomSize}:{groups:Group[];ownAnswer?:string;participants?:{name:string;answer:string}[];roomSize?:number}) {
 const [skip,setSkip]=useState(false);const total=groups.reduce((sum,g)=>sum+g.count,0);const small=(roomSize??total)<=5;const unique=groups.length>0&&groups.every(g=>g.count===1);
 return <section className={`rare-discoveries ${skip?'reveal-skipped':''}`} aria-label="Rare Answers results"><WorldScene ocean/><header><h3>{!groups.length?'No accepted answers':unique?'Every answer was unique':small?'Who matched?':'Answer groups'}</h3><button className="text-link" onClick={()=>setSkip(true)} disabled={skip}>{skip?'All shown':'Show all'}</button></header>{unique&&<p>Equal rarity. Equal points.</p>}<div className={small?'small-room-discoveries':'large-room-discoveries'}>{[...groups].sort((a,b)=>a.answer.localeCompare(b.answer)).map((g,i)=><article className={'rare-discovery '+(g.count===1?'unique':'matched')} key={g.answer} style={{'--delay':`${Math.min(i,8)*.35}s`} as CSSProperties}><PixelSprite kind={g.count===1?'jelly':'fish'}/><strong>{g.answer}</strong><span>{g.count===1?'Unique answer':`${g.count} players matched`}</span><p>{participants.filter(p=>p.answer.toLowerCase()===g.answer.toLowerCase()).map(p=>p.name).join(' · ')|| (ownAnswer?.trim().toLowerCase()===g.answer.toLowerCase()?'Your answer':'')}</p>{!small&&<div className="rarity-frequency"><i style={{width:`${g.count/Math.max(1,total)*100}%`}}/></div>}<b>+{g.points.toLocaleString('en')}</b></article>)}</div><footer>Matching answers share points. Small rooms have a smaller rarity bonus.</footer></section>
}
