'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {Profile} from '../../../packages/contracts/src/index';
import {avatarFor,type Avatar} from '../../../packages/contracts/src/avatar';
import {api} from '../lib/api';
import {CharacterEditor,PixelCharacter} from './game/PlayerIdentity';

type Quota={remaining:number;allowance:number;used:number;reserved:number;resetsAt:string;adsEnabled:boolean};
export function Credits({compact=false}:{compact?:boolean}){
 const [quota,setQuota]=useState<Quota|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;api<Quota>('/ai/quota').then(q=>{if(active)setQuota(q);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 return <section className={'credits-panel pixel-panel '+(compact?'credits-compact':'')} aria-labelledby="credits-title"><div className="credits-heading"><h2 id="credits-title">AI question credits</h2><span className="credit-plan">Free plan</span></div>{quota?<><div className="credit-balance"><strong>{quota.remaining}</strong><span>questions left<br/><small>of {quota.allowance} this month</small></span></div><progress aria-label="AI credits used" value={quota.used+quota.reserved} max={quota.allowance}/><div className="credit-breakdown"><span>{quota.used} used</span><span>{quota.reserved} in progress</span><span>{quota.allowance-20} bonus</span></div><p>Resets {new Date(quota.resetsAt).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})} (UTC).</p></>:error?<p className="notice error" role="alert">{error} <button className="text-link" onClick={()=>{setError('');void api<Quota>('/ai/quota').then(setQuota).catch(e=>setError(e.message));}}>Retry</button></p>:<p role="status">Loading your credits…</p>}<div className="button-row"><Link href="/create/ai" className="btn btn-primary">Make a quiz with AI →</Link></div>{!compact&&<><p>One credit makes one question. You get 20 free each month. Failed requests return your credits; manual questions are unlimited.</p><div className="ad-status"><strong>Bonus credits from ads</strong><p>{quota?.adsEnabled?'Optional ads are available in the AI maker. Complete an ad to earn five credits.':'Not available yet. Google publisher approval and ad setup are still pending. You can use your free credits now.'}</p></div></>}</section>;
}
export function AccountCharacter({profile}:{profile:Profile}){
 const [avatar,setAvatar]=useState<Avatar|null>(null),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 useEffect(()=>{let active=true;api<{avatar:Avatar}>('/account/appearance').then(r=>{if(active)setAvatar(r.avatar);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[profile.id]);
 return <section className="account-character pixel-panel"><div className="account-character-stage"><PixelCharacter id={profile.id} avatar={avatar??avatarFor(profile.id)}/></div><div><h2>Your character</h2><p>Your saved look follows you when you join a new room while signed in.</p>{avatar&&<CharacterEditor member={{id:profile.id,nickname:profile.displayName,avatar,joinedAt:'',status:'active'}} onSaveAvatar={async look=>{const result=await api<{avatar:Avatar}>('/account/appearance',{method:'PATCH',body:JSON.stringify({avatar:look})});setAvatar(result.avatar);setSaved(true);}} onSaved={()=>{}}/>}{saved&&<p className="character-saved" role="status">Look saved to your account.</p>}{error&&<p className="notice error" role="alert">{error}</p>}</div></section>;
}
