'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {playCue} from '../lib/audio';
import {Volume2,VolumeX} from 'lucide-react';
import {usePathname} from 'next/navigation';
import styles from './Navigation.module.css';
export function Brand(){return <Link href="/" className="brand" aria-label="MULTIGAME home"><svg width="29" height="29" viewBox="0 0 29 29" aria-hidden="true"><path d="M1 3h8l5.5 9L20 3h8v23h-8V15l-5.5 8L9 15v11H1Z" fill="currentColor"/></svg><span>MULTIGAME</span></Link>;}
const destinations=[['/','Home'],['/daily','Daily'],['/join','Join'],['/community','Quizzes'],['/account','Profile']] as const;
export function Header(){
 const path=usePathname();
 return <header className={styles.header}><div className={styles.identity}><Brand/><SoundToggle/></div><nav className={styles.navigation} aria-label="Main navigation">{destinations.map(([href,label])=>{
 const selected=href==='/'?path==='/':href==='/community'?['/community','/library','/create','/quiz'].some(prefix=>path?.startsWith(prefix)):path?.startsWith(href);
 return <Link key={href} href={href} aria-current={selected?'page':undefined}>{label}</Link>;
 })}</nav></header>;
}
export function Footer(){return <footer className={styles.footer}><nav aria-label="Legal and support"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/report">Help</Link></nav></footer>;}
export function SoundToggle(){const [muted,setMuted]=useState(false);useEffect(()=>{setMuted(localStorage.getItem('multigame-sound')==='off');const sync=()=>setMuted(localStorage.getItem('multigame-sound')==='off');window.addEventListener('multigame-sound-change',sync);return()=>window.removeEventListener('multigame-sound-change',sync);},[]);function toggle(){const v=!muted;setMuted(v);localStorage.setItem('multigame-sound',v?'off':'on');window.dispatchEvent(new Event('multigame-sound-change'));if(!v)playTone();}return <button className="icon-btn" onClick={toggle} aria-label={muted?'Turn sound on':'Mute sound'} aria-pressed={!muted}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button>;}
export function playTone(win=false){playCue(win?'win':'submit');}
