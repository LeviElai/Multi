'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {playCue} from '../lib/audio';
import {Volume2,VolumeX,ArrowUpRight} from 'lucide-react';
export function Brand(){return <Link href="/" className="brand" aria-label="MULTIGAME home"><svg width="29" height="29" viewBox="0 0 29 29" aria-hidden="true"><path d="M1 3h8l5.5 9L20 3h8v23h-8V15l-5.5 8L9 15v11H1Z" fill="currentColor"/></svg><span>MULTIGAME</span></Link>;}
export function Header(){return <header className="site-header"><Brand/><nav aria-label="Main navigation"><SoundToggle/><Link href="/library" className="nav-library">My quizzes</Link><Link href="/join" className="nav-join">Join <ArrowUpRight size={15}/></Link><Link href="/create" className="btn btn-dark btn-small">Create a quiz <span aria-hidden="true">+</span></Link></nav></header>;}
export function Footer(){return <footer className="site-footer"><Brand/><nav><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/report">Report a problem</Link><Link href="/account">Account</Link></nav></footer>;}
export function SoundToggle(){const [muted,setMuted]=useState(false);useEffect(()=>{setMuted(localStorage.getItem('multigame-sound')==='off');const sync=()=>setMuted(localStorage.getItem('multigame-sound')==='off');window.addEventListener('multigame-sound-change',sync);return()=>window.removeEventListener('multigame-sound-change',sync);},[]);function toggle(){const v=!muted;setMuted(v);localStorage.setItem('multigame-sound',v?'off':'on');window.dispatchEvent(new Event('multigame-sound-change'));if(!v)playTone();}return <button className="icon-btn" onClick={toggle} aria-label={muted?'Turn sound on':'Mute sound'} aria-pressed={!muted}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button>;}
export function playTone(win=false){playCue(win?'win':'submit');}
