'use client';
import Link from 'next/link';
import {Header,Footer} from './Brand';
import Join from './Join';
import Utility,{Login} from './Utility';
import CreatorGate from './CreatorGate';
import dynamic from 'next/dynamic';
function OpeningGame(){return <main className="page" role="status">Opening the workshop…</main>;}
const Live=dynamic(()=>import('./Live'),{loading:OpeningGame});
const Creator=dynamic(()=>import('./Creator'),{loading:OpeningGame});
const Demo=dynamic(()=>import('./Demo'),{loading:OpeningGame});
const RandomGame=dynamic(()=>import('./RandomGame'),{loading:OpeningGame});
const AiQuizMaker=dynamic(()=>import('./AiQuizMaker'));
const DailyChallenge=dynamic(()=>import('./DailyChallenge'));
const Community=dynamic(()=>import('./Community'));

export default function RouteApp({path}:{path:string[]}){const [rawSection,id,action]=path;const section=rawSection==='acount'?'account':rawSection;if(section==='daily')return <DailyChallenge date={id==='archive'?undefined:id} archive={id==='archive'}/>;if(section==='community')return <><Header/><Community/><Footer/></>;if(section==='create'&&id==='ai')return <><Header/><CreatorGate><AiQuizMaker/></CreatorGate><Footer/></>;if(section==='join')return <Join initialPin={id}/>;if(section==='play'||section==='host'||section==='results')return <Live id={id} role={section==='host'?'host':'player'}/>;if(section==='display')return <Live role="display" displayToken={id}/>;if(section==='random')return <RandomGame/>;if(section==='demo')return <Demo/>;if(section==='login')return <Login/>;if(['privacy','terms','account','billing','report','admin'].includes(section))return <Utility page={section}/>;if(['create','library','quiz'].includes(section))return <><Header/><CreatorGate><Creator key={[section,id,action].join(':')} quizId={section==='quiz'?id:undefined} view={section==='quiz'?(action==='preview'?'preview':'edit'):section as 'create'|'library'}/></CreatorGate><Footer/></>;return <><Header/><main className="page not-found"><span className="eyebrow">404</span><h1>Page not found.</h1><Link href="/" className="btn btn-dark">Home</Link></main><Footer/></>;}
