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
}) { return <g fill={fill} stroke={stroke} strokeWidth={stroke ? 1.6 : 0} opacity={opacity}>{asset === 'person' ? <path d="M38 0h24v5h5v17h-5v5H38v-5h-5V5h5ZM28 30h44v7h9v13h9v16h10v8H85V62H73v16l10 22H60L50 77l-10 23H17l10-22V62H15v12H0v-8h10V50h9V37h9Z"/> : asset === 'tree' ? <path d="M50 0 77 30H66l25 28H76l24 24H58v18H42V82H0l24-24H9l25-28H23Z"/> : asset === 'car' ? <path d="M14 31 28 0h44l14 31h14v49H88v20H70V80H30v20H12V80H0V31Zm18-20-9 20h54l-9-20Z" fillRule="evenodd"/> : asset === 'circle' ? <path d="M30 0h40v5h15v10h10v15h5v40h-5v15H85v10H70v5H30v-5H15V85H5V70H0V30h5V15h10V5h15Z"/> : asset === 'bottle' ? <path d="M35 0h30v20h5v10h15v10h15v60H0V40h15V30h15V20h5Z"/> : asset === 'rocket' ? <path d="M50 0C35 17 29 44 29 68L0 89v11l36-9h28l36 9V89L71 68C71 44 65 17 50 0ZM50 34a10 10 0 1 1 0 20 10 10 0 1 1 0-20Z" fillRule="evenodd"/> : asset === 'tower' ? <path d="M45 0h10v12h8v32h7v17h9v16h21v23H0V77h21V61h9V44h7V12h8Z"/> : <rect x="0" y="0" width="100" height="100" rx="0"/>}</g>; }
