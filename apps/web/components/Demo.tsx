'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Header, Footer } from './Brand';
import { Preview } from './Preview';
import { getDemoQuiz } from '../../../packages/game-modes/src/fixtures';
import { MODES, type QuizInput } from '../../../packages/contracts/src/index';
export default function Demo() { const [quiz, setQuiz] = useState<QuizInput | null>(null); const [index, setIndex] = useState(0); useEffect(() => { setQuiz(getDemoQuiz()); const mode = new URLSearchParams(location.search).get('mode'); setIndex(Math.max(0, MODES.findIndex(m => m === mode))); }, []); return <><Header /><main className="page demo-page"><div className="practice-page-title"><h1>Practice</h1><p>Five rounds. Two simulated opponents.</p></div>{quiz ? <Preview quiz={quiz} initialRound={index}/> : <div className="loading-stage"><div className="loading-blocks"><i /><i /><i /></div></div>}</main><Footer /></>; }
