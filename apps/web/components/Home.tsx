'use client';
import Link from 'next/link';
import { Header, Footer } from './Brand';
import JoinForm from './JoinForm';
export default function Home() {
    return <div className="clean-home plaza-home"><Header/><main><section className="plaza-entry"><div className="plaza-scenery" aria-hidden="true"><div className="plaza-cloud cloud-a"/><div className="plaza-cloud cloud-b"/><div className="plaza-sun"/></div><div className="plaza-content"><span className="plaza-wordmark" aria-label="MULTIGAME">MULTI<span>GAME</span></span><h1>Ready to play?</h1><JoinForm compact/><p className="plaza-tagline">One quiz. Five different games.</p></div><div className="plaza-hosting"><div><strong>Hosting?</strong><span>Make a quiz. Invite your friends.</span></div><Link href="/create" className="btn btn-primary">Create a quiz →</Link><Link href="/community" className="text-link">Browse quizzes</Link></div></section></main><Footer/></div>;
}
