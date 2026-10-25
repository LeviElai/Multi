/** Real HTTP + WebSocket smoke test. Credentials live only in ignored local QA state. */
import assert from 'node:assert/strict';
import {recordClock,snapshotClock} from '../apps/web/lib/server-clock';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {io,type Socket} from 'socket.io-client';
import {getArcadeQuiz} from '../packages/game-modes/src/fixtures';
import {roundFromAnswer,questionSeed,type QuestionAnswer} from '../packages/game-modes/src/question';
import {isArcade,scoreArcade} from '../packages/game-modes/src/arcade';
import type {Snapshot,Round,Submission,Quiz} from '../packages/contracts/src/index';
const origin=process.env.QA_ORIGIN??'http://localhost:3005',service=process.env.QA_SERVICE??'http://127.0.0.1:4001',keep=process.argv.includes('--keep');
await mkdir('.sites-runtime',{recursive:true});
const file='.sites-runtime/arcade-accounts.json';let accounts:Record<string,{email:string;password:string}>={};
try{accounts=JSON.parse(await readFile(file,'utf8'));}catch{}
const account=accounts[origin]??{email:`arcade-qa-${randomUUID().slice(0,8)}@example.test`,password:randomUUID()+randomUUID()};accounts[origin]=account;await writeFile(file,JSON.stringify(accounts),{mode:0o600});
async function call<T=any>(path:string,method='GET',body?:unknown,cookie='',expected=200,key=randomUUID()){
 const started=performance.now();const response=await fetch(origin+path,{method,headers:{Origin:origin,'Idempotency-Key':key,...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 const raw=await response.text();assert.ok(raw,`${method} ${path}: empty HTTP ${response.status}`);const value=JSON.parse(raw) as {data:T;error?:{message:string;code:string}};
 assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(value.error??{})}`);
 recordClock(value.data,Date.now(),performance.now()-started);
 return {data:value.data,cookie:response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};
}
const authPath='/api/auth/';let hostCookie='';console.log('Signing in');
const login=await fetch(origin+authPath+'login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(account),signal:AbortSignal.timeout(45000)});
if(login.ok)hostCookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
else if(login.status===401)hostCookie=(await call(authPath+'register','POST',{...account,displayName:'Arcade QA'},'',201)).cookie;
else throw new Error('Login service unavailable: HTTP '+login.status);
assert.ok(hostCookie);console.log('Authenticated; creating private QA quiz');
const quizInput=getArcadeQuiz();const exact=quizInput.rounds.find(r=>r.mode==='fermi')!;exact.scoringPolicy='exact';exact.questionType='single';exact.answerStructure='integer';quizInput.title='Private pixel polish verification';
const qa:QuestionAnswer={type:'boolean',kind:'boolean',text:'An octopus has three hearts.',answer:'true',exact:true,unit:'',alternatives:[],distractors:[]};quizInput.rounds.push(roundFromAnswer(qa,'sling',questionSeed('boolean')));quizInput.rounds.push(roundFromAnswer({...qa,type:'multiple',kind:'multiple',text:'Which of these are mammals?',answer:'Cat|Whale',distractors:['Lizard','Trout']},'fish',questionSeed('multiple')));
const quiz=(await call<Quiz>('/api/v1/quizzes','POST',quizInput,hostCookie,201)).data;
const reopened=(await call<Quiz>('/api/v1/quizzes/'+quiz.id,'GET',undefined,hostCookie)).data;assert.equal(reopened.rounds.find(r=>r.mode==='fermi')!.scoringPolicy,'exact');assert.equal(reopened.rounds.find(r=>r.mode==='fermi')!.questionType,'single');
const version=(await call<{id:string}>(`/api/v1/quizzes/${quiz.id}/publish`,'POST',{expectedRevision:quiz.revision},hostCookie,201)).data;
const room=(await call<{sessionId:string;pin:string}>('/api/v1/sessions','POST',{quizVersionId:version.id},hostCookie,201)).data;
const base='/api/v1/sessions/'+room.sessionId;
const clients: {cookie:string;id:string}[]=[],sockets:Socket[]=[];let socketEvents=0;
for(const nickname of ['Pixel','Pebble','Sprout']){const joined=await call<{participantId:string}>('/api/v1/sessions/join','POST',{pin:room.pin,nickname},'',201);clients.push({cookie:joined.cookie,id:joined.data.participantId});}
const snap=async(cookie=hostCookie)=>(await call<Snapshot>(base+'/snapshot?role='+(cookie===hostCookie?'host':'player'),'GET',undefined,cookie)).data;
async function action(action:string){
 let original:string|undefined;
 for(let attempt=0;attempt<3;attempt++){
  const s=await snap();if(s.state==='SESSION_COMPLETED')return;if(original&&s.state!==original)return;original=s.state;
  if(action==='LOCK'&&s.state!=='ROUND_ACTIVE')return;
  const response=await fetch(origin+base+'/host-actions',{method:'POST',headers:{Origin:origin,Cookie:hostCookie,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({action,expectedStateVersion:s.stateVersion}),signal:AbortSignal.timeout(30000)});
  const body=await response.json() as {error?:{code:string;message:string}};
  if(response.status===409&&body.error?.code==='VERSION_CONFLICT')continue;
  assert.equal(response.status,200,action+': '+(body.error?.message??''));return;
 }
 throw new Error('Host action remained stale after three fresh snapshots');
}
async function until(predicate:(s:Snapshot)=>boolean){let last:Snapshot|undefined;for(let i=0;i<50;i++){last=await snap();if(predicate(last))return last;if(i%10===0)console.log('Waiting',last.roundIndex,last.state);await new Promise(r=>setTimeout(r,200));}throw new Error('Timed out waiting for round '+last?.roundIndex+' phase '+last?.state);}
function answer(r:Round,correct=true):Submission['payload']{
 if(isArcade(r)){if(r.mode==='fish'&&r.publicConfig.kind==='multiple'&&r.publicConfig.fishScoring!=='catch-v1')return {choices:correct?r.secretConfig.correctOptionIds:r.secretConfig.correctOptionIds.slice(0,1),locked:true};if(r.mode==='draw')return {value:Number(r.secretConfig.answer)+(correct?0:1),ink:[[{x:10,y:10},{x:20,y:200}]],locked:true};if(['stack','crack'].includes(r.mode))return {value:Number(r.secretConfig.answer)+(correct?0:r.publicConfig.step),locked:true};if(r.mode==='drop')return {choiceId:String(correct?r.secretConfig.answer:!r.secretConfig.answer),locked:true};return {choiceId:correct?r.secretConfig.correctOptionIds[0]:r.publicConfig.options.find(o=>!r.secretConfig.correctOptionIds.includes(o.id))!.id,locked:true};}
 if(r.mode==='fermi')return {value:r.secretConfig.answer*(correct?1:2),locked:true};if(r.mode==='size_it_up')return {ratio:r.secretConfig.targetSize/r.publicConfig.referenceSize*(correct?1:1.1),locked:true};if(r.mode==='amountle')return {count:r.secretConfig.answer+(correct?0:1),locked:true};return {};
}
const report:{mode:string;points:number;answer:unknown}[]=[];let total=0;
try{
 if(process.env.QA_TRANSPORT!=='polling'){const socket=io(service,{transports:['websocket'],forceNew:true,reconnection:false,extraHeaders:{Origin:origin,Cookie:clients[0].cookie},auth:{sessionId:room.sessionId,role:'player'}});sockets.push(socket);
 await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('WebSocket connection timeout')),10000);socket.once('session.snapshot',()=>{socketEvents++;clearTimeout(t);resolve();});socket.once('connect_error',reject);});socket.on('session.snapshot',()=>socketEvents++);}
 await action('START');
 for(let i=0;i<quizInput.rounds.length;i++){
  const r=quizInput.rounds[i];console.log('Testing',i,r.mode);let s=await snap();assert.equal(s.roundIndex,i);if(s.state==='ROUND_PREPARE')await action('ADVANCE');await until(s=>s.state==='ROUND_ACTIVE');
  const before=await snap(clients[0].cookie);assert.equal(before.reveal,undefined);assert.ok(!JSON.stringify(before.round).includes('secretConfig'));assert.ok(!JSON.stringify(before.round).includes('correctOptionIds'));
  if(r.mode==='fish'){await action('PAUSE');assert.equal((await snap()).state,'PAUSED');await action('RESUME');}
  const earned:number[]=[];

  for(const [j,client]of clients.entries()){
   if(r.mode==='fish'&&r.publicConfig.fishScoring==='catch-v1'){const sample=await snap(client.cookie),clock=snapshotClock(sample),start=Date.parse(sample.deadlineAt!)-r.timerSeconds*1000,index=r.publicConfig.options.findIndex(o=>o.id===r.secretConfig.correctOptionIds[0]),elapsed=Date.now()+clock.offsetMs+clock.deliveryMs-start+index*600;await new Promise(resolve=>setTimeout(resolve,(1800-elapsed%3600+3600)%3600));}
   const payload=r.mode==='word_puzzle'?{roundId:r.id,clientMutationId:randomUUID(),guess:j<2?r.secretConfig.answer:'AAAAA'}:{roundId:r.id,clientMutationId:randomUUID(),revision:1,payload:answer(r,j<2)};
   const path=base+(r.mode==='word_puzzle'?'/word-guesses':'/submissions');const receipt=await call(path,'POST',payload,client.cookie);if(r.mode==='fish'&&r.publicConfig.fishScoring==='catch-v1'&&j<2)assert.equal(receipt.data.fishPoints,100,'Timed catch must be accepted');earned.push(receipt.data.fishPoints??receipt.data.potentialPoints??(isArcade(r)?scoreArcade(r,answer(r,j<2)).points:j<2?1000:0));
   if(j===0){const repeated=await call(path,'POST',payload,client.cookie);assert.deepEqual(repeated.data,receipt.data);}
  }
  s=await snap();if(s.state==='ROUND_ACTIVE')await action('LOCK');
  s=await until(s=>s.state==='ROUND_REVEAL'||s.state==='ROUND_SCORED'||s.state==='INTERMISSION'||s.state==='SESSION_COMPLETED');if(s.state==='ROUND_SCORED'){await action('REVEAL');s=await snap();}
  const expected=earned[0];total+=expected;
  const own=s.leaderboard.find(p=>p.participantId===clients[0].id)!;assert.equal(own.roundPoints,expected,r.mode+' points');assert.equal(own.points,total,r.mode+' total');
  assert.equal(s.leaderboard.find(p=>p.participantId===clients[1].id)!.roundPoints,earned[1]);assert.ok(s.reveal);if(r.mode==='draw')assert.deepEqual(s.roundAwards?.find(a=>a.participantId===clients[0].id)?.detail.ink,[[{x:10,y:10},{x:20,y:200}]]);
  report.push({mode:r.mode,points:expected,answer:s.reveal!.answer});
  if(s.state==='ROUND_REVEAL')await action('ADVANCE');s=await snap();if(i<quizInput.rounds.length-1&&s.state==='INTERMISSION')await action('ADVANCE');
 }
 const complete=await until(s=>s.state==='SESSION_COMPLETED');assert.equal(complete.leaderboard.find(p=>p.participantId===clients[0].id)!.points,total);assert.equal(complete.leaderboard[0].rank,1);if(process.env.QA_TRANSPORT!=='polling')assert.ok(socketEvents>1);
 await writeFile('.sites-runtime/arcade-room.json',JSON.stringify({origin,quizId:quiz.id,sessionId:room.sessionId,clients,hostCookie}),{mode:0o600});
 await writeFile('.sites-runtime/arcade-verification.json',JSON.stringify({origin,quizId:quiz.id,sessionId:room.sessionId,games:report,total,socketEvents,completed:true},null,2));
 console.log(JSON.stringify({games:report.length,total,socketEvents,completed:true,quizId:quiz.id}));
}finally{
 for(const socket of sockets)socket.disconnect();if(!keep)await call('/api/v1/quizzes/'+quiz.id,'DELETE',undefined,hostCookie);await call('/api/auth/logout','POST',{},hostCookie);
}
