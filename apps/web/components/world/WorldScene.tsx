'use client';
import { memo, type CSSProperties } from 'react';
import { PixelSprite } from './Sprites';
export const WorldScene = memo(function WorldScene({ ocean = false }: {
    ocean?: boolean;
}) {
    return <div className={`world-scene ${ocean ? 'ocean-scene' : 'village-scene'}`} aria-hidden="true">
    <div className="scene-painting"/>
    {ocean ? <><div className="ocean-caustics"/><div className="ocean-surface"/>{Array.from({ length: 12 }, (_, i) => <i key={i} className="ocean-bubble" style={{ '--i': i, left: `${5 + (i * 17) % 91}%`, animationDelay: `${-i * 1.7}s` } as CSSProperties}/>)}{[0, 1, 2, 3, 4].map(i => <div className="swimming-fish" key={i} style={{ top: `${22 + i * 14}%`, animationDelay: `${-i * 9}s`, '--duration': `${27 + i * 7}s` } as CSSProperties}><PixelSprite kind={i === 3 ? 'jelly' : 'fish'}/></div>)}<div className="foreground-kelp kelp-left"/><div className="foreground-kelp kelp-right"/></> : <><div className="harbor-cloud cloud-one"/><div className="harbor-cloud cloud-two"/>{Array.from({ length: 10 }, (_, i) => <PixelSprite kind="star" key={i} className="harbor-star" style={{ left: `${4 + (i * 23) % 91}%`, top: `${5 + (i * 7) % 33}%`, animationDelay: `${i * .7}s` } as CSSProperties}/>)}<div className="harbor-water"/><div className="harbor-wanderer"><PixelSprite kind="diver"/></div></>}
  </div>;
});
