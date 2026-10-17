'use client';
import Link from 'next/link';
import { Header, Footer } from './Brand';
import JoinForm from './JoinForm';
import { WorldScene } from './world/WorldScene';
export default function Home() {
    return <div className="clean-home"><Header /><main>
 <section className="home-entry"><WorldScene /><div className="home-title"><span className="eyebrow">MULTIGAME</span><h1>One quiz.<br />Five different games.</h1><p>Host a quiz. Players join with a code.</p></div><JoinForm compact/><Link href="/create" className="btn btn-primary home-create">Create a quiz <span aria-hidden="true">→</span></Link></section>

 </main><Footer /></div>;
}
