'use client';
import Link from 'next/link';
import { Brand } from './Brand';
import JoinForm from './JoinForm';
import { WorldScene } from './world/WorldScene';
export default function Join({ initialPin = '' }: {
    initialPin?: string;
}) {
    return <main className="join-world"><WorldScene /><div className="join-world-content"><Brand /><h1>Join a game</h1><JoinForm initialPin={initialPin}/><Link href="/" className="text-link">← Back to MULTIGAME</Link><p className="join-legal"><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></p></div></main>;
}
