/** Isolated network workload. It never targets a production room.
 * Run: PLAYERS=25 node --import tsx tests/load/room.ts
 * This measures local HTTP/Socket.IO + SQLite, not PostgreSQL or browser capacity.
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { io, type Socket } from 'socket.io-client';
import { startGameServer } from '../../apps/game-service/src/server';
import type { Snapshot } from '../../packages/contracts/src/index';
import { getDemoQuiz } from '../../packages/game-modes/src/fixtures';

const players=Number(process.env.PLAYERS??25);
if(!Number.isInteger(players)||players<2||players>100)throw new Error('PLAYERS must be an integer from 2 through 100.');
const directory=await mkdtemp(join(tmpdir(),'multigame-load-'));
const publicOrigin='http://localhost:4001';
const password=randomBytes(24).toString('base64url');
const service=await startGameServer({...process.env,NODE_ENV:'test',DATABASE_URL:'',SQLITE_PATH:join(directory,'load.sqlite'),PORT:'0',HOST:'127.0.0.1',PUBLIC_ORIGIN:publicOrigin,PIN_PEPPER:randomBytes(32).toString('hex'),AUTH_BOOTSTRAP_EMAIL:'load@example.test',AUTH_BOOTSTRAP_PASSWORD:password,MAX_PLAYERS:String(players),TRUST_PROXY:'1'});
const url=`http://127.0.0.1:${service.port}`;const sockets:Socket[]=[];
const request=async<T>(path:string,method='GET',body?:unknown,cookie='',ip='127.0.0.1')=>{
  const response=await fetch(`${url}${path}`,{method,headers:{Origin:publicOrigin,'Content-Type':'application/json','Idempotency-Key':randomUUID(),'X-Forwarded-For':ip,Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
  const json=await response.json() as {data:T;error?:unknown};assert.ok(response.ok,JSON.stringify(json));
  return {data:json.data,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
};
try {
  const login=await request<{id:string}>('/api/auth/login','POST',{email:'load@example.test',password});
  const quiz=getDemoQuiz();quiz.title='Isolated concurrency workload';quiz.rounds=quiz.rounds.slice(0,1);
  const created=await request<{id:string;revision:number}>('/api/v1/quizzes','POST',quiz,login.cookie);
  const version=await request<{id:string}>(`/api/v1/quizzes/${created.data.id}/publish`,'POST',{expectedRevision:created.data.revision},login.cookie);
  const room=await request<{sessionId:string;pin:string}>('/api/v1/sessions','POST',{quizVersionId:version.data.id},login.cookie);
  const sessionPath=`/api/v1/sessions/${room.data.sessionId}`;
  const guests=await Promise.all(Array.from({length:players},async(_,index)=>{
    const ip=`192.0.2.${index+1}`;
    const joined=await request<{participantId:string}>('/api/v1/sessions/join','POST',{pin:room.data.pin,nickname:`Player ${index+1}`},'',ip);
    const socket=io(url,{autoConnect:false,transports:['websocket'],forceNew:true,reconnection:false,extraHeaders:{Origin:publicOrigin,Cookie:joined.cookie,'X-Forwarded-For':ip},auth:{sessionId:room.data.sessionId,role:'player'}});
    sockets.push(socket);
    await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Connection timed out')),12000);socket.once('session.snapshot',()=>{clearTimeout(timeout);resolve();});socket.once('connect_error',reject);socket.connect();});
    return {socket,cookie:joined.cookie};
  }));
  const getSnapshot=async()=> (await request<Snapshot>(`${sessionPath}/snapshot`,'GET',undefined,login.cookie)).data;
  const act=async(action:string)=>request(`${sessionPath}/host-actions`,'POST',{action,expectedStateVersion:(await getSnapshot()).stateVersion},login.cookie);
  await act('START');
  const end=Date.now()+15000;let active:Snapshot;
  do {active=await getSnapshot();if(active.state==='ROUND_ACTIVE')break;await new Promise(resolve=>setTimeout(resolve,200));}while(Date.now()<end);
  assert.equal(active.state,'ROUND_ACTIVE');
  const latencies=await Promise.all(guests.map(async({socket})=>{
    const started=performance.now();
    const command={roundId:quiz.rounds[0].id,clientMutationId:randomUUID(),revision:1,payload:{value:144}};
    const result=await new Promise<{data?:{accepted:boolean};error?:unknown}>((resolve,reject)=>socket.timeout(12000).emit('answer.submit',command,(error:Error|null,response:{data?:{accepted:boolean};error?:unknown})=>error?reject(error):resolve(response)));
    assert.equal(result.data?.accepted,true,JSON.stringify(result));return performance.now()-started;
  }));
  await act('LOCK');
  const scoringEnd=Date.now()+10000;
  while((await getSnapshot()).state!=='ROUND_SCORED'&&Date.now()<scoringEnd)await new Promise(resolve=>setTimeout(resolve,200));
  await act('REVEAL');const result=await getSnapshot();assert.equal(result.answerCount,players);assert.ok(result.leaderboard.every(row=>row.points===1000));
  latencies.sort((a,b)=>a-b);const percentile=(p:number)=>Math.round(latencies[Math.min(latencies.length-1,Math.floor(latencies.length*p))]);
  const report={generatedAt:new Date().toISOString(),scenario:'one_round_concurrent_acknowledged_submissions',players,storage:'local SQLite',transport:'real Node HTTP + Socket.IO WebSocket',p50AckMs:percentile(.5),p95AckMs:percentile(.95),maxAckMs:Math.round(latencies.at(-1)!),accepted:result.answerCount,correctLedgerRows:result.leaderboard.filter(row=>row.points===1000).length,limitations:['No browser rendering, mobile network, PostgreSQL or deployed infrastructure measurement','Not a sustained public capacity certification']};
  await mkdir('tests/reports',{recursive:true});await writeFile(`tests/reports/load-${players}.json`,JSON.stringify(report,null,2));process.stdout.write(`${JSON.stringify(report)}\n`);
} finally {for(const socket of sockets)socket.disconnect();await service.close();await rm(directory,{recursive:true,force:true});}
