'use client';
import Link from 'next/link';
import {Header,Footer} from './Brand';
import JoinForm from './JoinForm';
import {PixelSprite} from './world/Sprites';
import {MODES,MODE_META} from '../../../packages/contracts/src/index';
export default function Home(){return <div className="clean-home"><Header/><main>
 <section className="home-entry"><div className="home-title"><h1>One quiz.<br/>Five different games.</h1><p>Host a quiz. Players join with a code.</p></div><JoinForm compact/><Link href="/create" className="btn btn-primary home-create">Create a quiz <span aria-hidden="true">→</span></Link></section>
 <section className="home-games" aria-label="Try the games"><h2>Try a game</h2><div>{MODES.map(mode=><Link href={'/demo?mode='+mode} key={mode}><PixelSprite kind={mode}/><span><strong>{MODE_META[mode].name}</strong><small>{MODE_META[mode].description}</small></span><b aria-hidden="true">↗</b></Link>)}</div></section>
 </main><Footer/></div>}
