import {memo,type CSSProperties} from 'react';

/** Deterministic decoration: no hydration randomness or animation render loop. */
export const Atmosphere=memo(function Atmosphere({ global = false }: { global?: boolean }) {
  return <div className={global ? 'ambient-world ambient-global' : 'ambient-world'} aria-hidden="true">
    {Array.from({ length: global ? 10 : 14 }, (_, i) => <i key={i} style={{
      '--x': `${(i * 23 + 7) % 97}%`, '--y': `${(i * 31 + 11) % 89}%`,
      '--delay': `${-i * 1.7}s`, '--duration': `${12 + i % 7 * 2}s`,
      '--drift': `${(i % 2 ? 1 : -1) * (18 + i * 3)}px`,
    } as CSSProperties}/>)}
    <div className="ambient-glow"/>{!global&&<><span className="ambient-fish fish-one"/><span className="ambient-fish fish-two"/><span className="ambient-gear"/><span className="ambient-page"/></>}
  </div>;
});
