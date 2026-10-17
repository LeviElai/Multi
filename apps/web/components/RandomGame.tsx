'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Header,Footer} from './Brand';
import {Preview} from './Preview';
import {getArcadeQuiz} from '../../../packages/game-modes/src/fixtures';
import type {QuizInput} from '../../../packages/contracts/src/index';
const starters=[
 {id:'arcade',title:'The arcade sampler',modes:['fish','stack','drop','claw','crack']},
 {id:'eye-test',title:'Trust your eyes',modes:['size_it_up','amountle']},
 {id:'brainwave',title:'A little brainwave',modes:['word_puzzle','draw','sling']}
];
export default function RandomGame(){
 const [game,setGame]=useState<QuizInput|null>(null),[epoch,setEpoch]=useState(0);
 const choose=()=>{
  let previous='';try{previous=sessionStorage.getItem('multigame-last-starter')??'';}catch{}
  const pool=starters.filter(q=>q.id!==previous),choice=pool[Math.floor(Math.random()*pool.length)];
  const source=getArcadeQuiz();
  const quiz={...source,title:choice.title,rounds:choice.modes.map(mode=>source.rounds.find(r=>r.mode===mode)!)};
  try{sessionStorage.setItem('multigame-last-starter',choice.id);}catch{}
  setGame(quiz);setEpoch(v=>v+1);
 };
 useEffect(()=>choose(),[]);
 return <><Header/><main className="page random-page"><div className="random-heading"><div><span className="eyebrow">SOLO · MULTIGAME STARTER QUIZ</span><h1>{game?.title??'Choosing a game…'}</h1><p>By MULTIGAME · no room or account needed.</p></div><button className="btn btn-primary" onClick={choose}>Try another random game ↻</button></div><p className="starter-note">Quizzes are private for now. These starter quizzes are made by MULTIGAME.</p>{game&&<Preview key={epoch} quiz={game} solo/>}<Link href="/join" className="text-link">Playing with friends? Join their room →</Link></main><Footer/></>;
}
