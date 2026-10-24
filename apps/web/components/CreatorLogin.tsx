'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, KeyRound, UserPlus } from 'lucide-react';
import { Header, Footer } from './Brand';
import { api } from '../lib/api';
import {creatorDestination,signInCreator} from '../lib/creator-session';
import type { Features } from '../../../packages/contracts/src/index';

export default function CreatorLogin() {
  const [destination, setDestination] = useState('/create');
  const [provider, setProvider] = useState<Features['auth']>();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending=useRef(false);
  useEffect(() => {
    const next = new URLSearchParams(location.search).get('return_to');
    setDestination(creatorDestination(next));
    api<Features>('/features').then(f => setProvider(f.auth ?? 'chatgpt')).catch(() => setError('Could not reach sign-in. Refresh to try again.'));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if(sending.current)return; sending.current=true;setBusy(true); setError('');
    try {
      await signInCreator(register,{email,password,displayName:name});
      location.assign(destination);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in.'); setBusy(false);sending.current=false; }
  }
  return <><Header/><main className="page login-page">
    <span className="eyebrow">THE CREATOR WORKSHOP</span>
    <h1>{register ? 'Create account' : 'Sign in'}</h1>
    <p>Save your quizzes and host a room. Your players only need a PIN.</p>
    {provider === 'chatgpt' ? <a className="btn btn-primary" href={'/signin-with-chatgpt?return_to=' + encodeURIComponent(destination)} target="_top">Continue with ChatGPT <ArrowRight size={17}/></a> : provider === 'credentials' ? <>
      <div className="auth-tabs" aria-label="Creator account"><button disabled={busy} aria-pressed={!register} onClick={() => {setRegister(false);setError('');}}>Sign in</button><button disabled={busy} aria-pressed={register} onClick={() => {setRegister(true);setError('');}}>Create account</button></div>
      <form onSubmit={submit}>
        {register && <label className="field"><span>Your name</span><input value={name} onChange={e => setName(e.target.value)} autoComplete="nickname" maxLength={60} required/></label>}
        <label className="field"><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" maxLength={254} required/></label>
        <label className="field"><span>Password</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : undefined} maxLength={128} required/>{register && <small>At least 12 characters.</small>}</label>
        <button className="btn btn-primary" disabled={busy}>{register ? <UserPlus size={17}/> : <KeyRound size={17}/>} {busy ? 'Opening the workshop…' : register ? 'Create account' : 'Sign in'} <ArrowRight size={17}/></button>
      </form>
    </> : !error && <p role="status">Opening sign-in…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <Link href="/join" className="text-link auth-guest-link">Here to play? Join with a PIN →</Link>
  </main><Footer/></>;
}
