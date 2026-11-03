'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, KeyRound, UserPlus } from 'lucide-react';
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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending=useRef(false);
  const [connectionAttempt,setConnectionAttempt]=useState(0);
  useEffect(() => {
    const next = new URLSearchParams(location.search).get('return_to');
    setDestination(creatorDestination(next));
    const controller=new AbortController();setError('');
    waitForService(controller.signal).then(f => setProvider(f.auth ?? 'chatgpt')).catch(() => {if(!controller.signal.aborted)setError('The game server is taking too long to start. Please try again.');});
    return()=>controller.abort();
  }, [connectionAttempt]);
  useEffect(()=>{if(!register||!username){setAvailable(null);return;}const clean=username.trim().replace(/^@/,'').toLowerCase();if(!/^[a-z][a-z0-9_]{2,23}$/.test(clean)){setAvailable(false);return;}const controller=new AbortController();const timer=setTimeout(()=>{void api<{available:boolean}>('/api/auth/username?value='+encodeURIComponent(clean),{signal:controller.signal}).then(v=>setAvailable(v.available)).catch(()=>setAvailable(null));},280);return()=>{clearTimeout(timer);controller.abort();};},[username,register]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if(sending.current)return; sending.current=true;setBusy(true); setError('');
    try {
      await waitForService();
      await signInCreator(register,{email,password,displayName:name,username});
      location.assign(destination);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); setBusy(false);sending.current=false; }
  }
  return <><Header/><main className="page login-page">
    <span className="eyebrow">MULTIGAME · PLAYER CARD</span>
    <h1>{register ? 'Make your player card' : 'Welcome back'}</h1>
    <p>{register?'Pick your name for games and a unique @username for world rankings.':'Your arcade is ready when you are.'}</p>
    {provider === 'chatgpt' ? <a className="btn btn-primary" href={'/signin-with-chatgpt?return_to=' + encodeURIComponent(destination)} target="_top">Continue with ChatGPT <ArrowRight size={17}/></a> : provider === 'credentials' ? <>
      <div className="auth-tabs" aria-label="Creator account"><button disabled={busy} aria-pressed={!register} onClick={() => {setRegister(false);setError('');}}>Sign in</button><button disabled={busy} aria-pressed={register} onClick={() => {setRegister(true);setError('');}}>Create account</button></div>
      <form onSubmit={submit}>
        {register && <><label className="field"><span>Display name · shown in games</span><input value={name} onChange={e => setName(e.target.value)} autoComplete="nickname" maxLength={60} required/></label><label className="field"><span>Username · world rankings</span><input value={username} onChange={e=>{setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g,''));setAvailable(null);}} autoComplete="off" maxLength={24} pattern="@?[a-z][a-z0-9_]{2,23}" placeholder="@pixelmaster" required aria-describedby="username-status"/></label><small id="username-status" role="status">{available===true?'Available!':available===false?'Choose 3–24 letters, numbers or underscores, starting with a letter.':''}</small></>}
        <label className="field"><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" maxLength={254} required/></label>
        <label className="field"><span>Password</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} maxLength={128} required/>{register && <small>At least 8 characters. Longer passphrases welcome.</small>}</label>
        <button className="btn btn-primary" disabled={busy}>{register ? <UserPlus size={17}/> : <KeyRound size={17}/>} {busy ? 'Opening the workshop…' : register ? 'Create account' : 'Sign in'} <ArrowRight size={17}/></button>
      </form>
    </> : !error && <p role="status">Connecting to the game server…</p>}
    {error && <div className="notice error" role="alert">{error}{!provider&&<button className="btn btn-outline" onClick={()=>setConnectionAttempt(n=>n+1)}>Try again</button>}</div>}
    <Link href="/join" className="text-link auth-guest-link">Playing with friends? Join as a guest →</Link>
  </main><Footer/></>;
}
