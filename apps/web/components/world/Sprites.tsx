import type { CSSProperties } from 'react';
import type { ModeId } from '../../../../packages/contracts/src/index';
/** Small original vector sprites share a 32-unit grid; never used to represent scores. */
export function PixelSprite({ kind = 'fish', className = '', style }: {
    kind?: 'fish' | 'jelly' | 'star' | 'diver' | 'shell' | ModeId;
    className?: string;
    style?: CSSProperties;
}) {
    return <svg viewBox="0 0 32 32" className={`pixel-sprite ${className}`} style={style} shapeRendering="crispEdges" aria-hidden="true">
    {kind === 'fish' || kind === 'rare_answers' ? <><path fill="#ffbd83" d="M8 10h14v3h4v7h-4v3H8v-3H4v4H0V9h4v4h4Z"/><path fill="#e77d77" d="M11 7h8v3h-8ZM10 23h9v3h-9Z"/><path fill="#ffe6b2" d="M10 12h9v3h-9Z"/><path fill="#152d46" d="M22 13h3v3h-3Z"/></> : kind === 'jelly' ? <><path fill="#aaabef" d="M9 4h14v3h4v4h3v10H2V11h3V7h4Z"/><path fill="#e4c8ff" d="M10 7h10v3H7v6H4v-5h3V8Z"/><path fill="#a6f0df" d="M6 21h3v8H6ZM14 21h3v11h-3ZM23 21h3v7h-3Z"/><path fill="#263858" d="M11 15h2v3h-2ZM21 15h2v3h-2Z"/></> : kind === 'star' ? <path fill="#ffe4a3" d="M14 1h4v10h5v4h8v3H21v5h-4v8h-3V21H9v-4H1v-3h10V9h3Z"/> : kind === 'diver' ? <><path fill="#eebc68" d="M12 2h12v4h4v14h-4v4H12v-4H8V6h4Z"/><path fill="#a5e9db" d="M12 8h12v9H12Z"/><path fill="#f9df9e" d="M12 8h6v3h-6Z"/><path fill="#ef927e" d="M11 24h13v5H11ZM7 28h8v4H7ZM22 28h8v4h-8Z"/></> : kind === 'word_puzzle' ? <><path fill="#edb8d0" d="M2 5h28v24H2Z"/><path fill="#ffe5ed" d="M5 3h22v21H5Z"/><path fill="#6d497c" d="M9 7h4v9h2V7h3v9h2V7h4v14h-5v-3h-5v3H9Z"/></> : kind === 'fermi' ? <><path fill="#c4dff0" d="M1 13h4V9h4V5h6V2h6v8h-4v4h-4v4H6v4H1Z"/><path fill="#f1ca7c" d="M18 0h7v10h-7Z"/><path fill="#8a9ccc" d="M14 17h4v3h4v4h4v7h-4v-5h-4v-4h-4v10h-4V20h4Z"/></> : kind === 'size_it_up' ? <><path fill="#97cbaa" d="M2 19h10v12H2ZM17 3h13v28H17Z"/><path fill="#d7efba" d="M17 3h13v5H17ZM2 19h10v4H2Z"/><path fill="#426e6d" d="M23 11h4v4h-4ZM23 20h4v4h-4Z"/></> : kind === 'amountle' ? <><path fill="#83cfcd" d="M5 10h3v17h16V10h3v20H5Z"/><path fill="#f7c77e" d="M9 19h5v5H9ZM16 23h5v5h-5ZM18 14h5v5h-5ZM12 7h5v5h-5ZM18 0h5v5h-5Z"/></> : <><path fill="#edb2c0" d="M5 13h3V8h5V5h7v3h5v5h3v10H5Z"/><path fill="#ffe2cb" d="M10 12h3v10h-3ZM18 9h3v13h-3Z"/></>}
  </svg>;
}
