'use client';
import {useEffect,type CSSProperties,type ReactNode} from 'react';
import type { ModeId } from '../../../../packages/contracts/src/index';
import { Atmosphere } from './Atmosphere';
import { PixelSprite } from './Sprites';

export const GAME_WORLDS: Record<ModeId, { name: string; cue: string; color: string }> = {
  draw:{name:'The Ink Workshop',cue:'Draw, check, then seal your number.',color:'#f4d4a3'},
  claw:{name:'Moonlight Arcade',cue:'Move the claw. Grab your answer.',color:'#f6b4d0'},
  drop:{name:'Starlight Carnival',cue:'Left is True. Right is False.',color:'#c6b4ff'},
  sling:{name:'The Acorn Range',cue:'Pull back, aim, then release.',color:'#bde597'},
  fish:{name:'The Coral Garden',cue:'Tap the fish carrying your answer.',color:'#7de1ce'},
  stack:{name:'Cloudtop Construction',cue:'Build a number with blocks.',color:'#ffc778'},
  crack:{name:'The Clockwork Vault',cue:'Turn the wheels. Lock your code.',color:'#a8bcea'},
  answer:{name:'The Answer Desk',cue:'Check your answers, then lock.',color:'#a8bcea'},
  size_it_up: { name: 'The Measuring Room', cue: 'Drag to resize. Match the reference.', color: '#bde597' },
  amountle: { name: 'The Drop Shop', cue: 'Tap for one. Hold for a stream.', color: '#ffc778' },
  fermi: { name: 'Stargazer Station', cue: 'Enter your estimate, then lock it in.', color: '#c6b4ff' },
  rare_answers: { name: 'The Quiet Reef', cue: 'Find something the others missed.', color: '#7de1ce' },
  word_puzzle: { name: 'The Spell Library', cue: 'Find the word in six guesses.', color: '#f6b4d0' },
};

export function GameBackdrop({ mode, children, className = '' }: { mode: ModeId; children?: ReactNode; className?: string }) {
  const world = GAME_WORLDS[mode];
  return <div className={`game-world world-${mode} ${className}`} style={{ '--world-accent': world.color } as CSSProperties}>
    <div className="game-world-art" aria-hidden="true" /><Atmosphere/>
    {children}
  </div>;
}

export function GameIntro({ mode }: { mode: ModeId }) {
  useEffect(()=>{if(['draw','claw','drop','sling','fish','stack','crack','answer'].includes(mode))void import('../game/ArcadePlayer').catch(()=>{});},[mode]);
  return <div className={`game-intro-art world-${mode}`} aria-hidden="true"><div className="game-world-art"/><Atmosphere/><PixelSprite kind={mode}/><span>{GAME_WORLDS[mode].name}</span></div>;
}
