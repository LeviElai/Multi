'use client';
import Link from 'next/link';
import {Header,Footer} from './Brand';
import Join from './Join';
import Live from './Live';
import Utility,{Login} from './Utility';
import Creator from './Creator';
import Demo from './Demo';
import CreatorGate from './CreatorGate';
export default function RouteApp({path}:{path:string[]}){const [section,id,action]=path;if(section==='join')return <Join initialPin={id}/>;if(section==='play'||section==='host'||section==='results')return <Live id={id} role={section==='host'?'host':'player'}/>;if(section==='display')return <Live role="display" displayToken={id}/>;if(section==='demo')return <Demo/>;if(section==='login')return <Login/>;if(['privacy','terms','account','billing','report','admin'].includes(section))return <Utility page={section}/>;if(['create','library','quiz'].includes(section))return <><Header/><CreatorGate><Creator key={[section,id,action].join(':')} quizId={section==='quiz'?id:undefined} view={section==='quiz'?(action==='preview'?'preview':'edit'):section as 'create'|'library'}/></CreatorGate><Footer/></>;return <><Header/><main className="page not-found"><span className="eyebrow">404</span><h1>Page not found.</h1><Link href="/" className="btn btn-dark">Home</Link></main><Footer/></>;}
