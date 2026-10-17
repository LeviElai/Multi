'use client';
import {PixelCharacter} from './PlayerIdentity';
import type {Snapshot} from '../../../../packages/contracts/src/index';
import {useEffect,useRef,type CSSProperties} from 'react';
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
 <div className="final-players">{s.leaderboard.filter(p=>p.rank===rank).map(p=><div className="final-person" key={p.participantId}><PixelCharacter id={p.participantId} avatar={p.avatar} crown={rank===1} mood={rank===1?"celebrate":"happy"}/><strong>{p.nickname}{p.participantId===s.participantId&&p.nickname!=='You'?' (you)':''}</strong><span>{p.points.toLocaleString('en')} points</span></div>)}</div>
 <div className="final-plinth"><small>{s.leaderboard.filter(p=>p.rank===rank).length>1?'TIED':''}</small><b>{rank}</b><span>{rank===1?'CHAMPION':rank===2?'RUNNER-UP':'THIRD PLACE'}</span></div>
 </div>)}</div>
 <div className="final-floor" aria-hidden="true"/>
 </section>;
}
