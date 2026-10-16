'use client';
import type { CSSProperties, ReactNode } from 'react';
import type { ModeId } from '../../../../packages/contracts/src/index';
import { Atmosphere } from './Atmosphere';
import { PixelSprite } from './Sprites';

export const GAME_WORLDS: Record<ModeId, { name: string; cue: string; color: string }> = {
  size_it_up: { name: 'Wonderwood', cue: 'A little perspective goes a long way.', color: '#bde597' },
  amountle: { name: 'The Drop Shop', cue: 'Tap for one. Hold for a stream.', color: '#ffc778' },
  fermi: { name: 'Stargazer Station', cue: 'Big number or small hunch?', color: '#c6b4ff' },
  rare_answers: { name: 'The Quiet Reef', cue: 'Find something the others missed.', color: '#7de1ce' },
  word_puzzle: { name: 'The Word Garden', cue: 'Follow the letters to the answer.', color: '#f6b4d0' },
};

export function GameBackdrop({ mode, children, className = '' }: { mode: ModeId; children?: ReactNode; className?: string }) {
  const world = GAME_WORLDS[mode];
  return <div className={`game-world world-${mode} ${className}`} style={{ '--world-accent': world.color } as CSSProperties}>
    <div className="game-world-art" aria-hidden="true" /><Atmosphere/>
    {children}
  </div>;
}

export function GameIntro({ mode }: { mode: ModeId }) {
  return <div className={`game-intro-art world-${mode}`} aria-hidden="true"><div className="game-world-art"/><Atmosphere/><PixelSprite kind={mode}/><span>{GAME_WORLDS[mode].name}</span></div>;
}
