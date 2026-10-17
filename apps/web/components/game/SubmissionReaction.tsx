'use client';
import {PixelSprite} from '../world/Sprites';
import type {ModeId} from '../../../../packages/contracts/src/index';
export default function SubmissionReaction({mode,value,solved=true,attempts,finished,players}:{mode:ModeId;value?:string;solved?:boolean;attempts?:number;finished?:number;players?:number}){
 const titles:Record<ModeId,string>={size_it_up:'Size fixed!',amountle:'Jar sealed!',word_puzzle:solved?'Spell unlocked!':'Book closed',rare_answers:'Into the deep!',fermi:'Estimate launched!'};
 return <section className={'submission-reaction reaction-'+mode} role="status" aria-label={titles[mode]}>
 <div className="reaction-stage" aria-hidden="true"><div className="reaction-track"/><div className="reaction-object"><PixelSprite kind={mode}/></div><i className="reaction-spark spark-a"/><i className="reaction-spark spark-b"/><i className="reaction-spark spark-c"/>{mode==='size_it_up'&&<div className="reaction-clamp"/>}{mode==='amountle'&&<div className="reaction-lid"/>}{mode==='word_puzzle'&&<div className="reaction-letters">A B C</div>}</div>
 <div className="reaction-message"><h3>{titles[mode]}</h3>{value&&<strong>{value}</strong>}<p>{mode==='word_puzzle'?solved?`Solved in ${attempts} ${attempts===1?'guess':'guesses'}.`:'No guesses left this round.':mode==='rare_answers'?'Hidden until the reveal.':mode==='fermi'?'Your estimate is locked.':mode==='size_it_up'?'Your size is locked.':"No more drops this round."}</p>{players!==undefined&&finished!==undefined&&<small>{Math.max(1,finished)} of {players} players finished · reveal coming up</small>}</div>
 </section>;
}
