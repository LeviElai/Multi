'use client';
import {useEffect,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {PixelSprite} from './world/Sprites';
import {restoreSession,type SessionState} from '../lib/session-restoration';
export default function CreatorGate({children}:{children:ReactNode}) {
 const [state,setState]=useState<SessionState>({status:'initializing'});
 const [attempt,setAttempt]=useState(0),[waking,setWaking]=useState(false);
 useEffect(()=>{setWaking(false);if(state.status!=='initializing')return;const timer=setTimeout(()=>setWaking(true),6000);return()=>clearTimeout(timer);},[state.status,attempt]);
 useEffect(()=>{let active=true;setState({status:'initializing'});void restoreSession().then(next=>{if(active)setState(next);});return()=>{active=false;};},[attempt]);
 useEffect(()=>{const resume=()=>{if(document.visibilityState==='visible'&&state.status==='recoverable_failure')setAttempt(n=>n+1);};window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);return()=>{window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};},[state.status]);
 if(state.status==='authenticated')return <>{children}</>;
 return <main className="page auth-check" role="status"><PixelSprite kind="star"/>{state.status==='initializing'?<><h1>Opening the workshop</h1><p>{waking?'The arcade is waking up. Your sign-in is safe.':'Checking your sign-in…'}</p></>:state.status==='recoverable_failure'?<><h1>Connection interrupted</h1><p>We couldn’t check your session. Try again when connected.</p><button className="btn" onClick={()=>setAttempt(n=>n+1)}>Retry</button></>:<><h1>{state.status==='expired'?'Session expired':'Sign in to create'}</h1><Link className="btn btn-primary" href={'/login?return_to='+encodeURIComponent(typeof location==='undefined'?'/create':location.pathname)}>Sign in</Link></>}</main>;
}
