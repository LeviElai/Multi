'use client';
import type {Snapshot} from '../../../../packages/contracts/src/index';
import {useEffect,useRef,type CSSProperties} from 'react';
export function PixelChampion({name,rank=1}:{name:string;rank?:number}){
 const hue=Array.from(name).reduce((a,c)=>a+c.charCodeAt(0),0)%5;
 const coat=['#8ad5c4','#cf9fd4','#e7a66e','#8caee4','#bfcc79'][hue];
 return <svg viewBox="0 0 24 32" shapeRendering="crispEdges" aria-hidden="true" className="pixel-champion">
 <path fill="#18263e" d="M6 8h12v3h3v12h-3v6h-4v3H8v-3H5V12h1Z"/>
 <path fill="#eab78e" d="M7 9h10v10H7Z"/><path fill="#ffe0b0" d="M7 10h3v6H7Z"/>
 <path fill="#273449" d="M8 12h2v2H8Zm6 0h2v2h-2Zm-4 4h4v1h-4Z"/>
 <path fill={coat} d="M5 20h14v7H5ZM3 22h3v4H3Zm15 0h3v4h-3Z"/>
 <path fill="#fff0c8" d="M10 20h4v3h-4Z"/><path fill="#425879" d="M7 27h4v4H7Zm6 0h4v4h-4Z"/>
 {rank===1?<><path fill="#bd7f3e" d="M5 1h3v3h3V0h3v4h3V1h3v8H5Z"/><path fill="#ffe195" d="M6 2h2v3h4V1h1v4h5V2h1v5H6Z"/><path fill="#ec8e9b" d="M11 5h3v2h-3Z"/></>:<path fill={rank===2?'#b9cedd':'#d69b70'} d="M5 5h14v4H5Z"/>}
 </svg>;
}
export default function FinalStage({snapshot:s}:{snapshot:Snapshot}){
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{root.current?.scrollIntoView({block:'start',behavior:'instant'});},[]);
 const groups=[...new Set(s.leaderboard.filter(p=>p.rank<=3).map(p=>p.rank))];
 const ordered=[...groups].sort((a,b)=>(a===2?0:a===1?1:2)-(b===2?0:b===1?1:2));
 const winners=s.leaderboard.filter(p=>p.rank===1);
 return <section ref={root} className="final-arena" aria-label="Final podium">
 <div className="pixel-confetti" aria-hidden="true">{Array.from({length:32},(_,i)=><i key={i} style={{'--x':(i*47%100)+'%','--delay':(i%8)*.11+'s','--color':['#ffdf8c','#9ed8c5','#cfacf0','#ffac9f'][i%4]} as CSSProperties}/>)}</div>
 <div className="final-marquee"><span>★</span> {s.state==='SESSION_ABORTED'?'GAME ENDED':'THAT’S A WRAP!'} <span>★</span></div>
 <h2>{!winners.length?'Thanks for playing':winners.length>1?'Joint champions':winners[0].nickname==='You'?'You win!':winners[0].nickname+' wins!'}</h2>
 <p>{s.title}</p>
 <div className="final-podium">{ordered.map(rank=><div key={rank} className={'final-place final-place-'+rank}>
 <div className="final-players">{s.leaderboard.filter(p=>p.rank===rank).map(p=><div className="final-person" key={p.participantId}><PixelChampion name={p.nickname} rank={rank}/><strong>{p.nickname}{p.participantId===s.participantId&&p.nickname!=='You'?' (you)':''}</strong><span>{p.points.toLocaleString('en')} points</span></div>)}</div>
 <div className="final-plinth"><small>{s.leaderboard.filter(p=>p.rank===rank).length>1?'TIED':''}</small><b>{rank}</b><span>{rank===1?'CHAMPION':rank===2?'RUNNER-UP':'THIRD PLACE'}</span></div>
 </div>)}</div>
 <div className="final-floor" aria-hidden="true"/>
 </section>;
}
