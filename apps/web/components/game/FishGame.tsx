'use client';
import {useState, type CSSProperties} from 'react';
import type {ArcadeRound, Submission} from '../../../../packages/contracts/src/index';
import {FishArt} from './FishArt';
import {playCue} from '../../lib/audio';
import styles from './FishGame.module.css';

/** Stable touch targets; only the illustration swims. Knowledge decides the catch. */
export default function FishGame({config,disabled,effect,initial,onCommit}:{
 config:ArcadeRound['publicConfig'];disabled:boolean;effect:string;
 initial?:Submission['payload'];onCommit:(payload:Submission['payload'],name:string)=>Promise<void>;
}){
 const multiple=config.kind==='multiple';
 const [selected,setSelected]=useState<string[]>(initial?.choices??(initial?.choiceId?[initial.choiceId]:[]));
 const blocked=disabled||!!effect;
 const caught=effect?(initial?.choices??(effect==='caught'?selected:[effect])):selected;
 function select(id:string){
  if(blocked)return;
  setSelected(previous=>multiple?(previous.includes(id)?previous.filter(x=>x!==id):[...previous,id]):[id]);
  playCue('adjust','fish');
 }
 return <div className={styles.game}>
  <p className={styles.instruction}>{multiple?'Choose the correct fish, then reel them in.':'Choose your answer, then reel it in.'}</p>
  <div className={styles.pond} role="group" aria-label="Fish answers" data-caught={!!effect}>
   {config.options.map((option,index)=><button key={option.id} type="button" className={styles.fish}
    style={{'--fish-delay':`${index*-.4}s`} as CSSProperties} aria-pressed={caught.includes(option.id)}
    disabled={blocked} onClick={()=>select(option.id)}>
    <span className={styles.art} aria-hidden="true"><FishArt species={index}/></span>
    <strong>{option.label}</strong><span className={styles.check} aria-hidden="true">{caught.includes(option.id)?'✓':''}</span>
   </button>)}
  </div>
  <button type="button" className="btn btn-primary btn-full" disabled={blocked||!selected.length}
   onClick={()=>void onCommit(multiple?{choices:selected}:{choiceId:selected[0]},multiple?'caught':selected[0])}>
   {effect?'Catch locked':multiple?`Reel in${selected.length?' · '+selected.length:''}`:'Reel in'}
  </button>
  <p className={styles.status} role="status">{effect?'Answer saved':selected.length?config.options.filter(o=>selected.includes(o.id)).map(o=>o.label).join(' · '):'Tap a fish to choose'}</p>
 </div>;
}
