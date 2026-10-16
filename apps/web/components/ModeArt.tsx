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
}) { return <g fill={fill} stroke={stroke} strokeWidth={stroke ? 1.6 : 0} opacity={opacity}>{asset === 'person' ? <path d="M50 0a13 13 0 1 1 0 26 13 13 0 1 1 0-26ZM30 29h40l30 35-9 8-23-25v30l9 23H59l-9-28-9 28H23l9-23V47L9 72 0 64Z"/> : asset === 'tree' ? <path d="M50 0 77 30H66l25 28H76l24 24H58v18H42V82H0l24-24H9l25-28H23Z"/> : asset === 'car' ? <path d="M14 31 28 0h44l14 31h14v49H88v20H70V80H30v20H12V80H0V31Zm18-20-9 20h54l-9-20Z" fillRule="evenodd"/> : asset === 'circle' ? <circle cx="50" cy="50" r="50"/> : asset === 'bottle' ? <path d="M35 0h30v19c0 9 35 15 35 25v56H0V44c0-10 35-16 35-25Z"/> : asset === 'rocket' ? <path d="M50 0C35 17 29 44 29 68L0 89v11l36-9h28l36 9V89L71 68C71 44 65 17 50 0ZM50 34a10 10 0 1 1 0 20 10 10 0 1 1 0-20Z" fillRule="evenodd"/> : asset === 'tower' ? <path d="M45 0h10v12h8v32h7v17h9v16h21v23H0V77h21V61h9V44h7V12h8Z"/> : <rect x="0" y="0" width="100" height="100" rx="3"/>}</g>; }
