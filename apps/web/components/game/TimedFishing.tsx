'use client';
import {useEffect,useRef,useState} from 'react';
import type {Ack,ArcadeRound,PublicRound,Submission} from '../../../../packages/contracts/src/index';
import {fishPosition} from '../../../../packages/game-modes/src/fish';
import {FishArt} from './FishArt';
import {playCue} from '../../lib/audio';
import styles from './TimedFishing.module.css';
export default function TimedFishing({config,round,initial,disabled,busy,serverTime,clock,deadlineAt,send}:{config:ArcadeRound['publicConfig'];round:PublicRound;initial?:Submission['payload'];disabled:boolean;busy:boolean;serverTime?:string;clock?:{offsetMs:number;deliveryMs:number};deadlineAt?:string|null;send:(payload:Submission['payload'])=>Promise<Ack>}){
 const [points,setPoints]=useState(initial?.fishPoints??0),[catches,setCatches]=useState(initial?.fishCatches??0),[feedback,setFeedback]=useState(initial?.fishFeedback??'Tap a correct fish in the gold zone');
 const [cast,setCast]=useState(''),[cooldown,setCooldown]=useState(false),[outcome,setOutcome]=useState<'catch'|'miss'|''>('');
 const offset=useRef(0),lanes=useRef<(HTMLSpanElement|null)[]>([]),sending=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>{offset.current=clock?clock.offsetMs+clock.deliveryMs:serverTime?Date.parse(serverTime)-Date.now():0;},[serverTime,clock?.offsetMs,clock?.deliveryMs]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{if(disabled||!deadlineAt)return;let frame=0;const start=Date.parse(deadlineAt)-round.timerSeconds*1000;
  const animate=()=>{const now=Date.now()+offset.current;lanes.current.forEach((el,i)=>{if(!el)return;const p=fishPosition(now,start,i);el.style.left=p.position+'%';el.dataset.ready=String(p.catchable);});frame=requestAnimationFrame(animate);};
  frame=requestAnimationFrame(animate);return()=>cancelAnimationFrame(frame);
 },[disabled,deadlineAt,round.timerSeconds]);
 async function catchFish(id:string){
  if(disabled||busy||cooldown||sending.current)return;
  const castStarted=performance.now();sending.current=true;setCast(id);setOutcome('');playCue('pour','fish');
  try{const ack=await send({choiceId:id});setPoints(ack.fishPoints??points);setCatches(ack.fishCatches??catches);setOutcome((ack.fishCatches??catches)>catches?'catch':'miss');setFeedback(ack.fishFeedback??'Catch saved');playCue((ack.fishCatches??catches)>catches?'submit':'error','fish');}
  catch{setFeedback('Cast not confirmed. Try again.');}
  finally{sending.current=false;setCooldown(true);timer.current=setTimeout(()=>{setCooldown(false);setCast('');setOutcome('');},Math.max(0,650-(performance.now()-castStarted)));}
 }
 return <div className={styles.game}>
  <div className={styles.score}><span>{catches} caught</span><strong>{points} / 1,000</strong></div>
  <div className={styles.pond} role="group" aria-label="Tap correct fish in the gold zone">
   {config.options.map((option,index)=><button type="button" key={option.id} className={styles.lane} disabled={disabled||busy||cooldown} onClick={()=>void catchFish(option.id)} aria-label={'Catch '+option.label} data-cast={cast===option.id} data-outcome={cast===option.id?outcome:''}>
    <strong>{option.label}</strong><span className={styles.water}><span className={styles.zone} aria-hidden="true"/><span className={styles.fish} ref={el=>{lanes.current[index]=el;}} aria-hidden="true"><FishArt species={index}/></span><span className={styles.hook} aria-hidden="true">⌄</span><span className={styles.splash} aria-hidden="true"><i/><i/><i/></span></span>
   </button>)}
  </div>
  <p className={styles.status} role="status" aria-live="polite">{feedback}</p>
 </div>;
}
