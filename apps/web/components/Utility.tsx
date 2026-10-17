'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Download, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
const AccountCharacter=dynamic(()=>import('./AccountExtras').then(m=>m.AccountCharacter));
const Credits=dynamic(()=>import('./AccountExtras').then(m=>m.Credits));
import { Header, Footer } from './Brand';
import { api, post } from '../lib/api';
import type { Profile } from '../../../packages/contracts/src/index';
export default function Utility({ page }: {
    page: string;
}) { const [profile, setProfile] = useState<Profile | null>(null); const [profileLoading,setProfileLoading]=useState(true); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); useEffect(() => { if (['account', 'billing', 'admin'].includes(page))
    void api<Profile | null>('/me').then(setProfile).catch(e => setError(e.message)).finally(()=>setProfileLoading(false)); }, [page]); async function request(type: string) { setBusy(true); setError(''); try {
    const r = await post<{
        receiptId: string;
        message: string;
    }>('/privacy/requests', { type });
    setMessage(`${r.message} Reference: ${r.receiptId}`);
}
catch (e) {
    setError(e instanceof Error ? e.message : 'Request failed.');
}
finally {
    setBusy(false);
} } return <><Header /><main className="page utility-page">{page === 'report' ? <Report /> : page === 'account' ? <><h1>Your account</h1><p>Manage your account and the information you share.</p>{profile ? <><div className="account-profile"><span className="player-avatar">{profile.displayName[0]}</span><div><h2>{profile.displayName}</h2><p>Creator account</p></div><Link href="/billing" className="btn btn-outline btn-small">Billing & credits</Link><button className="btn btn-outline btn-small" onClick={async()=>{await api('/api/auth/logout',{method:'POST',body:'{}'});location.assign('/login');}}>Sign out</button></div><div className="account-content-grid"><AccountCharacter profile={profile}/><Credits compact/></div><section className="utility-block"><h2>Your data</h2><p>Download your profile and owned quiz drafts. For a fuller export or deletion, submit a request below. The confirmation is a receipt, not a completed deletion.</p><div className="button-row"><button className="btn btn-dark" onClick={async () => { try {
    const data = await api('/account/export');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'multigame-my-data.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
}
catch (e) {
    setError(String(e));
} }}><Download size={17}/> Export quiz data</button><button className="btn btn-outline" disabled={busy} onClick={() => void request('export')}>Request full export</button><button className="btn btn-outline danger" disabled={busy} onClick={() => { if (window.confirm('Record a request to delete your account and associated data?'))
    void request('delete'); }}>Request deletion</button></div></section></> : profileLoading ? <div className="notice" role="status">Loading your account…</div> : <div className="notice">Sign in to manage your account. <Link href="/login">Continue to sign in →</Link></div>}</> : page === 'billing' ? <><Link href="/account" className="creator-back">← Account</Link><h1>Billing & credits</h1><p>Your monthly AI balance. Creating manually and playing are free.</p>{profile?<Credits/>:profileLoading?<p role="status">Loading your credits…</p>:<div className="notice"><Link href="/login">Sign in to see your credits →</Link></div>}<section className="billing-included pixel-panel"><h2>Included for free</h2><p>All eleven games, saved quizzes, public library, solo practice and room hosting.</p><p>No subscription or payment method is connected.</p></section></> : page === 'privacy' ? <><h1>Privacy</h1><div className="notice">Development privacy notice · Public launch policies still require review.</div><section className="utility-block"><h2>What this build stores</h2><p>Creators have an account identifier, email, display name, and a securely hashed password. Quiz drafts are private to their creator unless explicitly shared in the community library. Shared versions, answers and the creator’s display name become public. Game rooms store player nicknames, accepted answers, word attempts, scores, and moderation decisions so play can recover after reconnecting. Use pseudonyms and avoid sensitive personal information.</p><h2>Who sees what</h2><p>Players see the current question, their own answers, and the room leaderboard. Answer keys appear at reveal. Correct answers stay private until the reveal. A paired display has read-only access and cannot control the game.</p><h2>Browser storage and services</h2><p>Scoped authentication cookies keep your seat in a room. Sound preferences stay on your device. Creators sign in to manage private quizzes and host rooms. Guests join a room with its PIN. If you use the AI question maker, your topic and instructions are sent to Google Gemini. Avoid personal or sensitive information. Generated quizzes remain private drafts until you share them. We store monthly usage and generation status to apply the 20-question allowance. Optional rewarded ads, when enabled, load Google advertising only after you choose to watch; completion adds five questions for the current month, up to three ad opportunities daily. Google may process device and advertising data under its privacy terms. We do not show ads during gameplay. Required regional consent and publisher approval must be configured before ads are enabled.</p><h2>Export, deletion, and issues</h2><p>Creators can download quiz data and file a request from <Link href="/account">Account</Link>. Anyone can <Link href="/report">report a problem</Link>. Requests are recorded for administrative review; submission does not imply completion. A retention schedule and responsible operating entity must be approved before public launch.</p></section></> : page === 'terms' ? <><h1>Playing together</h1><div className="notice">Development participation terms · Not a public commercial agreement.</div><section className="utility-block"><p>This private evaluation build is for testing adult-hosted game nights. It is not ready for school deployment, paid events, or sensitive personal data.</p><h2>For creators</h2><p>Use questions and assets you have permission to use. Check the answers and mark their provenance honestly. Do not upload private information about someone without their permission.</p><h2>For players</h2><p>Choose a suitable nickname. Be respectful. Hosts can remove players and review answers. Scores use server-accepted input and the round's published rules.</p><h2>Availability and payments</h2><p>This build can change and may have interruptions. There are no paid plans. Optional rewarded ads may be offered in the creator workspace after publisher approval. Rewards are in-site question credits, expire at the monthly reset and cannot be exchanged for money. Final service terms, regions, support arrangements, and policy review remain launch gates.</p><Link className="btn btn-outline" href="/report">Report a concern <ArrowRight size={16}/></Link></section></> : <><h1>Restricted access.</h1><p>Administrative access requires an explicitly assigned staff role. Creator accounts do not grant moderation privileges.</p><Link href="/library" className="btn btn-dark">Back to my games</Link></>}{message && <div className="notice success" role="status">{message}</div>}{error && <div className="notice error" role="alert">{error}</div>}</main><Footer /></>; }
function Report() { const [category, setCategory] = useState('gameplay'); const [context, setContext] = useState(''); const [targetId, setTargetId] = useState(''); const [error, setError] = useState(''); const [receipt, setReceipt] = useState(''); const [busy, setBusy] = useState(false); return <><h1>Tell us what happened.</h1><p>Report a game issue, inappropriate content, or a privacy concern.</p>{receipt ? <div className="notice success" role="status"><Check size={18}/> Report recorded. Reference: {receipt}</div> : <form className="utility-form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try {
    const r = await post<{
        receiptId: string;
    }>('/reports', { category, context, targetId: targetId || undefined, targetType: targetId ? 'session' : 'general' });
    setReceipt(r.receiptId);
}
catch (e) {
    setError(e instanceof Error ? e.message : 'Could not record report.');
}
finally {
    setBusy(false);
} }}><label className="field"><span>What is this about?</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="gameplay">Gameplay or technical issue</option><option value="content">Inappropriate content</option><option value="privacy">Privacy concern</option><option value="rights">Content ownership</option></select></label><label className="field"><span>Room ID, if you have it</span><input value={targetId} maxLength={100} onChange={e => setTargetId(e.target.value)} placeholder="Optional"/></label><label className="field"><span>What happened?</span><textarea rows={5} value={context} maxLength={2000} onChange={e => setContext(e.target.value)} required placeholder="Please include the steps that led to the problem. Avoid private or sensitive information."/></label>{error && <div className="notice error" role="alert">{error}</div>}<button className="btn btn-dark" disabled={busy}>{busy ? 'Recording…' : 'Submit report'} <ArrowRight size={16}/></button><p className="control-hint">This creates a stored report. Response times are not guaranteed during development.</p></form>}</>; }
export { default as Login } from './CreatorLogin';
