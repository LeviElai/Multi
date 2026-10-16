'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {PixelSprite} from './world/Sprites';
import {api} from '../lib/api';
import type {Profile} from '../../../packages/contracts/src/index';
export default function CreatorGate({children}:{children:ReactNode}) {
 const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
 useEffect(()=>{let active=true;api<Profile|null>('/me').then(profile=>{if(!active)return;if(profile)setState('ready');else location.replace('/login?return_to='+encodeURIComponent(location.pathname));}).catch(()=>{if(active)setState('error');});return()=>{active=false};},[]);
 if(state==='ready')return <>{children}</>;
 return <main className="page auth-check" role="status"><PixelSprite kind="star"/>{state==='loading'?<><h1>Opening the workshop</h1><p>Checking your sign-in…</p></>:<>Could not check your session. <button className="btn" onClick={()=>location.reload()}>Retry</button></>}</main>;
}
