'use client';
import Link from 'next/link';
import {Header,Footer} from './Brand';
import Join from './Join';
import Live from './Live';
import Utility,{Login} from './Utility';
import Creator from './Creator';
import Demo from './Demo';
export default function RouteApp({path}:{path:string[]}){const [section,id,action]=path;if(section==='join')return <Join initialPin={id}/>;if(section==='play'||section==='host'||section==='results')return <Live id={id} role={section==='host'?'host':'player'}/>;if(section==='display')return <Live role="display" displayToken={id}/>;if(section==='demo')return <Demo/>;if(section==='login')return <Login/>;if(['privacy','terms','account','billing','report','admin'].includes(section))return <Utility page={section}/>;if(['create','library','quiz'].includes(section))return <><Header/><Creator key={[section,id,action].join(':')} quizId={section==='quiz'?id:undefined} view={section==='quiz'?(action==='preview'?'preview':'edit'):section as 'create'|'library'}/><Footer/></>;return <><Header/><main className="page not-found"><span className="eyebrow">404 · WRONG ROOM</span><h1>This round doesn't exist.</h1><Link href="/" className="btn btn-dark">Back to the show →</Link></main><Footer/></>;}
