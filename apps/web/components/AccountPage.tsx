'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Header,Footer} from './Brand';
import {api} from '../lib/api';
import {type Avatar} from '../../../packages/contracts/src/avatar';
import {CharacterEditor,PixelCharacter} from './game/PlayerIdentity';
import styles from './Account.module.css';

type Account={id:string;displayName:string;username:string;email:string};
export default function AccountPage(){
 const [account,setAccount]=useState<Account|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[recoverable,setRecoverable]=useState(false),[attempt,setAttempt]=useState(0);
 const [displayName,setDisplayName]=useState(''),[username,setUsername]=useState(''),[currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState('');
 const [avatar,setAvatar]=useState<Avatar|null>(null),[avatarError,setAvatarError]=useState('');
 const [availability,setAvailability]=useState<'idle'|'checking'|'available'|'taken'|'invalid'|'unknown'>('idle');
 useEffect(()=>{
  let active=true;const controller=new AbortController();setLoading(true);setRecoverable(false);setError('');
  void api<Account>('/api/auth/profile',{signal:controller.signal}).then(a=>{
   if(active){setAccount(a);setDisplayName(a.displayName);setUsername(a.username);setRecoverable(false);}
  }).catch(e=>{if(active){setRecoverable(e?.status!==401);if(e?.status!==401)setError('Your profile could not connect. Try again.');}}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;controller.abort();};
 },[attempt]);
 useEffect(()=>{
  if(!account)return;let active=true;setAvatarError('');
  void api<{avatar:Avatar}>('/account/appearance').then(r=>{if(active)setAvatar(r.avatar);}).catch(()=>{if(active)setAvatarError('Your character could not load. Retry your profile to edit it.');});
  return()=>{active=false;};
 },[account?.id,attempt]);
 useEffect(()=>{
  if(!account||username===account.username){setAvailability('idle');return;}
  if(!/^[a-z][a-z0-9_]{2,23}$/.test(username)){setAvailability('invalid');return;}
  const controller=new AbortController();setAvailability('checking');
  const timer=setTimeout(()=>{void api<{available:boolean}>('/api/auth/username?value='+encodeURIComponent(username),{signal:controller.signal}).then(r=>setAvailability(r.available?'available':'taken')).catch(()=>{if(!controller.signal.aborted)setAvailability('unknown');});},300);
  return()=>{clearTimeout(timer);controller.abort();};
 },[username,account?.username]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{const next=await api<Account>('/api/auth/profile',{method:'PATCH',body:JSON.stringify({displayName,username})});setAccount(prev=>prev?{...prev,...next}:null);setDisplayName(next.displayName);setUsername(next.username);setMessage('Profile saved.');}catch(e){setError(e instanceof Error?e.message:'Could not save your profile.');}finally{setBusy(false);}}
 async function changePassword(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{await api('/api/auth/password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});setCurrentPassword('');setNewPassword('');setMessage('Password changed. Other sessions were signed out.');}catch(e){setError(e instanceof Error?e.message:'Could not change your password.');}finally{setBusy(false);}}
 async function exportData(){setBusy(true);setError('');try{const data=await api('/account/export');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='multigame-my-data.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),500);}catch(e){setError(e instanceof Error?e.message:'Could not export your data.');}finally{setBusy(false);}}
 async function privacyRequest(type:'delete'|'export'){if(type==='delete'&&!window.confirm('Record a request to delete your account and associated data?'))return;setBusy(true);setError('');try{const receipt=await api<{receiptId:string}>('/privacy/requests',{method:'POST',body:JSON.stringify({type})});setMessage('Request recorded for review. Reference: '+receipt.receiptId);}catch(e){setError(e instanceof Error?e.message:'Could not record your request.');}finally{setBusy(false);}}
 async function signOut(){setBusy(true);setError('');try{await api('/api/auth/logout',{method:'POST',body:'{}'});location.assign('/');}catch(e){setError(e instanceof Error?e.message:'Could not sign out. Try again.');setBusy(false);}}
 return <><Header/><main className={styles.page}><section className={styles.card} aria-labelledby="profile-title">
  <header className={styles.heading}><div className={styles.character}><PixelCharacter id={account?.id??'welcome'} avatar={avatar??undefined}/></div><div><h1 id="profile-title">{account?'Your profile':'Player profile'}</h1>{account&&<p className={styles.username}>@{account.username}</p>}</div></header>
  {error&&<p role="alert" className={styles.error}>{error}</p>}{message&&<p role="status" className={styles.success}>{message}</p>}
  {loading?<p role="status" className={styles.loading}>Opening your profile…</p>:recoverable&&!account?<button className={styles.primary} onClick={()=>setAttempt(n=>n+1)}>Retry connection</button>:!account?<div className={styles.guest}><p>Choose a name and character to keep.</p><Link className={styles.primary} href="/login?return_to=%2Faccount">Sign in or create account</Link><Link className={styles.secondary} href="/">Continue as guest</Link></div>:<>
   <div className={styles.characterAction}>{avatar?<CharacterEditor member={{id:account.id,nickname:account.displayName,avatar,joinedAt:'',status:'active'}} onSaved={()=>{}} onSaveAvatar={async look=>{const result=await api<{avatar:Avatar}>('/account/appearance',{method:'PATCH',body:JSON.stringify({avatar:look})});setAvatar(result.avatar);setMessage('Character saved.');}}/>:<button className={styles.secondary} disabled={!avatarError} onClick={()=>setAttempt(n=>n+1)}>{avatarError?'Retry character':'Loading character…'}</button>}{avatarError&&<p role="alert" className={styles.error}>{avatarError}</p>}</div>
   <form onSubmit={save} className={styles.form}>
    <label className={styles.field}><span>Display name <small>In multiplayer</small></span><input autoComplete="nickname" value={displayName} maxLength={60} onChange={e=>setDisplayName(e.target.value)} required/></label>
    <label className={styles.field}><span>Username <small>On Daily rankings</small></span><input autoComplete="off" autoCapitalize="none" spellCheck={false} value={username} maxLength={24} pattern="[a-z][a-z0-9_]{2,23}" onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))} required aria-describedby="profile-username-status"/></label>
    <small id="profile-username-status" className={styles.hint} role="status">{availability==='checking'?'Checking…':availability==='available'?'Username available':availability==='taken'?'That username is taken.':availability==='invalid'?'Use 3–24 letters, numbers or underscores; start with a letter.':availability==='unknown'?'Availability will be checked when you save.':''}</small>
    <button className={styles.primary} disabled={busy||['checking','taken','invalid'].includes(availability)}>{busy?'Saving…':'Save profile'}</button>
   </form>
   <nav className={styles.shortcuts} aria-label="Your account"><Link href="/library">My quizzes</Link><Link href="/daily">Daily results</Link><Link href="/billing">AI credits</Link></nav>
   <details className={styles.settings}><summary>Password & account</summary><p className={styles.email}>{account.email}</p><form onSubmit={changePassword} className={styles.form}><label className={styles.field}><span>Current password</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required/></label><label className={styles.field}><span>New password</span><input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/><small>At least 8 characters</small></label><button className={styles.secondary} disabled={busy}>Change password</button></form>
    <div className={styles.dataActions}><button className={styles.textButton} disabled={busy} onClick={()=>void exportData()}>Download quiz data</button><button className={styles.textButton} disabled={busy} onClick={()=>void privacyRequest('export')}>Request full export</button><button className={styles.textButton} disabled={busy} onClick={()=>void privacyRequest('delete')}>Request account deletion</button></div>
    <button className={styles.secondary} disabled={busy} onClick={()=>void signOut()}>Sign out</button>
   </details>
  </>}
 </section></main><Footer/></>;
}
