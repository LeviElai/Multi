'use client';
import {useRef,useState} from 'react';
import type {Ack,ArcadeRound,Submission} from '../../../../packages/contracts/src/index';
import styles from './CrackGame.module.css';
export default function CrackGame({config,initial,disabled,busy,send}:{config:ArcadeRound['publicConfig'];initial?:Submission['payload'];disabled:boolean;busy:boolean;send:(payload:Submission['payload'])=>Promise<Ack>}){
 const [code,setCode]=useState(''),[feedback,setFeedback]=useState(initial?.crackHint??''),[attempts,setAttempts]=useState(initial?.crackAttempts??0);
 const [potential,setPotential]=useState(initial?.locked?initial.crackPoints??0:Math.max(1,Math.round(1000*.8**(initial?.crackAttempts??0))));
 const [cooldown,setCooldown]=useState(false);const sending=useRef(false),input=useRef<HTMLInputElement>(null);
 const solved=feedback==='solved'||initial?.locked;
 async function guess(event:React.FormEvent){
  event.preventDefault();if(sending.current||disabled||busy||cooldown||solved||!code)return;
  sending.current=true;
  try{const ack=await send({value:Number(code)});if(!ack.solved)input.current?.select();setAttempts(ack.attempt??attempts+1);setFeedback(ack.direction??'');setPotential(ack.potentialPoints??potential);setCooldown(true);setTimeout(()=>setCooldown(false),750);}
  catch{/* ModePlayer presents the network/validation error and retains its retry receipt. */}
  finally{sending.current=false;}
 }
 return <form className={styles.vault} onSubmit={guess}>
  <div className={styles.meter}><span>Guess {attempts+Number(!solved)}</span><strong>{potential.toLocaleString()} {solved?'points':'max points'}</strong></div>
  <label className={styles.label} htmlFor="crack-code">{solved?'Vault opened':'Enter your code'}<input ref={input} id="crack-code" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="go" placeholder={'0'.repeat(config.codeLength)} maxLength={config.codeLength} value={code} disabled={disabled||!!solved} readOnly={busy} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>
  <div className={styles.feedback} role="status" aria-live="polite">{feedback==='solved'?'✓ Cracked!':feedback==='higher'?'↑ Try a higher number':feedback==='lower'?'↓ Try a lower number':'Each wrong guess costs 20% of the next score.'}</div>
  <button className="btn btn-primary btn-full" disabled={disabled||busy||cooldown||!!solved||!code||Number(code)<config.min||Number(code)>config.max}>{solved?'Unlocked':busy?'Checking…':cooldown?'Ready in a moment…':'Try code'}</button>
 </form>;
}
