'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {PixelCharacter} from './game/PlayerIdentity';
import styles from './Account.module.css';
import { Header, Footer } from './Brand';
import {waitForService} from '../lib/service-ready';
import {api} from '../lib/api';
import {creatorDestination,signInCreator} from '../lib/creator-session';
import type { Features } from '../../../packages/contracts/src/index';

export default function CreatorLogin() {
  const [destination, setDestination] = useState('/create');
  const [provider, setProvider] = useState<Features['auth']>();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username,setUsername]=useState('');
  const [available,setAvailable]=useState<boolean|null>(null);
  const [checking,setChecking]=useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending=useRef(false);
  const [connectionAttempt,setConnectionAttempt]=useState(0);
  useEffect(() => {
    const next = new URLSearchParams(location.search).get('return_to');
    setDestination(creatorDestination(next));
    const controller=new AbortController();setError('');
    const deadline=setTimeout(()=>{controller.abort();setError('The server is taking longer than expected. Try again.');},15000);
    waitForService(controller.signal).then(f => setProvider(f.auth ?? 'chatgpt')).catch(() => {if(!controller.signal.aborted)setError('Could not connect to the server. Try again.');}).finally(()=>clearTimeout(deadline));
    return()=>{clearTimeout(deadline);controller.abort();};
  }, [connectionAttempt]);
  const validUsername=/^[a-z][a-z0-9_]{2,23}$/.test(username);
  useEffect(()=>{
    setAvailable(null);setChecking(false);
    if(!register||!validUsername)return;
    const controller=new AbortController();setChecking(true);
    const timer=setTimeout(()=>{void api<{available:boolean}>('/api/auth/username?value='+encodeURIComponent(username),{signal:controller.signal}).then(v=>setAvailable(v.available)).catch(()=>{if(!controller.signal.aborted)setAvailable(null);}).finally(()=>{if(!controller.signal.aborted)setChecking(false);});},280);
    return()=>{clearTimeout(timer);controller.abort();};
  },[username,register,validUsername]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if(sending.current)return; sending.current=true;setBusy(true); setError('');
    try {
      await signInCreator(register,{email,password,displayName:name,username});
      location.assign(destination);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); setBusy(false);sending.current=false; }
  }
  return <><Header/><main className={styles.page}><section className={styles.card} aria-labelledby="login-title">
    <header className={styles.heading}><div className={styles.character}><PixelCharacter id="welcome"/></div><h1 id="login-title">{register?'Create account':'Welcome back'}</h1></header>
    {provider==='chatgpt'?<a className={styles.primary} href={'/signin-with-chatgpt?return_to='+encodeURIComponent(destination)} target="_top">Continue with ChatGPT</a>:provider==='credentials'?<>
      <div className={styles.tabs} aria-label="Account options"><button disabled={busy} aria-pressed={!register} onClick={()=>{setRegister(false);setError('');}}>Sign in</button><button disabled={busy} aria-pressed={register} onClick={()=>{setRegister(true);setError('');}}>Create account</button></div>
      <form onSubmit={submit} className={styles.form}>
        {register&&<><label className={styles.field}><span>Display name <small>In multiplayer</small></span><input value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" maxLength={60} required/></label><label className={styles.field}><span>Username <small>On Daily rankings</small></span><input value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={24} pattern="[a-z][a-z0-9_]{2,23}" placeholder="pixelmaster" required aria-describedby="username-status"/></label><small id="username-status" className={styles.hint} role="status">{username&&!validUsername?'Use 3–24 letters, numbers or underscores; start with a letter.':checking?'Checking…':available===true?'Username available':available===false?'That username is taken.':''}</small></>}
        <label className={styles.field}><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete={register?'email':'username'} maxLength={254} required/></label>
        <label className={styles.field}><span>Password {register&&<small>8 characters or more</small>}</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={register?'new-password':'current-password'} minLength={register?8:undefined} maxLength={128} required/></label>
        <button className={styles.primary} disabled={busy||(register&&(available===false||checking))}>{busy?(register?'Creating account…':'Signing in…'):register?'Create account':'Sign in'}</button>
      </form>
    </>:!error&&<p className={styles.loading} role="status">Connecting…</p>}
    {error&&<div className={styles.error} role="alert">{error}{!provider&&<button className={styles.secondary} onClick={()=>setConnectionAttempt(n=>n+1)}>Retry connection</button>}</div>}
    <Link href="/" className={styles.guestLink}>Continue as guest</Link>
  </section></main><Footer/></>;
}
