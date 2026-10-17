'use client';
import type { ModeId } from '../../../packages/contracts/src/index';
import { PixelSprite } from './world/Sprites';
export function ModeArt({ mode, large = false }: {
    mode: ModeId;
    large?: boolean;
}) { return <div className={'mode-art mode-emblem ' + (large ? 'art-large' : '')} aria-hidden="true"><PixelSprite kind={mode}/></div>; }
export function Shape({ asset, fill = 'currentColor', stroke, opacity = 1 }: {
    asset: string;
    fill?: string;
    stroke?: string;
    opacity?: number;
}) { return <g fill={fill} stroke={stroke} strokeWidth={stroke ? 1.6 : 0} opacity={opacity}>{asset === 'person' ? <path d="M38 0h24v5h5v17h-5v5H38v-5h-5V5h5ZM28 30h44v7h9v13h9v16h10v8H85V62H73v16l10 22H60L50 77l-10 23H17l10-22V62H15v12H0v-8h10V50h9V37h9Z"/> : asset === 'tree' ? <path d="M46 0h8v8h8v8h8v8h8v6H66v7h8v7h9v7h8v7H76v8h8v7h8v5h8v4H58v18H42V82H0v-4h8v-5h8v-7h8v-8H9v-7h8v-7h9v-7h8v-7H23v-6h8v-8h8V8h7Z"/> : asset === 'car' ? <path d="M14 31 28 0h44l14 31h14v49H88v20H70V80H30v20H12V80H0V31Zm18-20-9 20h54l-9-20Z" fillRule="evenodd"/> : asset === 'circle' ? <path d="M30 0h40v5h15v10h10v15h5v40h-5v15H85v10H70v5H30v-5H15V85H5V70H0V30h5V15h10V5h15Z"/> : asset === 'bottle' ? <path d="M35 0h30v20h5v10h15v10h15v60H0V40h15V30h15V20h5Z"/> : asset === 'rocket' ? <path d="M50 0C35 17 29 44 29 68L0 89v11l36-9h28l36 9V89L71 68C71 44 65 17 50 0ZM50 34a10 10 0 1 1 0 20 10 10 0 1 1 0-20Z" fillRule="evenodd"/> : asset === 'tower' ? <path d="M45 0h10v12h8v32h7v17h9v16h21v23H0V77h21V61h9V44h7V12h8Z"/> : <rect x="0" y="0" width="100" height="100" rx="0"/>}{!stroke&&asset==='tree'&&<g stroke="none"><path d="M42 78h16v22H42Z" fill="#946449"/><path d="M43 80h5v20h-5Z" fill="#c59b68"/><path d="M46 8h8v8h8v8H42v8H32v-8h7v-8h7ZM32 37h10v8h-8v6H22v-6h10ZM21 64h13v8H21v7H8v-5h13Z" fill="#ffe5aa" opacity=".55"/><path d="M58 32h8v7h8v8h9v8H66v-8h-8ZM63 62h12v8h8v8H58v-7h5Z" fill="#76583f" opacity=".28"/></g>}{!stroke&&asset==='tower'&&<g stroke="none"><path d="M45 0h10v13H45ZM30 42h40v5H30ZM21 60h58v5H21ZM0 94h100v6H0Z" fill="#c4d8bc"/><path d="M44 22h5v9h-5ZM53 22h5v9h-5ZM36 51h7v8h-7ZM55 51h7v8h-7ZM30 70h8v9h-8ZM58 70h8v9h-8ZM45 82h11v18H45Z" fill="#344f59"/><path d="M45 2h4v11h-4ZM25 82h5v12h-5Z" fill="#e6deb0"/></g>}{!stroke&&asset==='car'&&<g stroke="none"><path d="M33 12h16v18H25ZM54 12h13l8 18H54Z" fill="#b7dbd6"/><path d="M8 44h13v9H8ZM79 44h13v9H79Z" fill="#fff0b7"/><path d="M3 65h94v7H3ZM12 82h18v15H12ZM70 82h18v15H70Z" fill="#344d5b"/></g>}</g>; }
