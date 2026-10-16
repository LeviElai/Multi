'use client';
import Link from 'next/link';
import { Header, Footer } from '../apps/web/components/Brand';
import { PixelSprite } from '../apps/web/components/world/Sprites';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <><Header/><main className="page utility-page recovery-page">
    <PixelSprite kind="diver"/><span className="eyebrow">LET’S GET YOU BACK</span>
    <h1>That page hit a snag.</h1>
    <p>Try opening it again. If you were in a room, use the same browser to keep your seat.</p>
    <div className="button-row"><button className="btn btn-primary" onClick={reset}>Try again</button><Link className="btn btn-outline" href="/">Back to the harbor</Link></div>
  </main><Footer/></>;
}
