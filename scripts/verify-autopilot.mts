import assert from 'node:assert/strict';
import {avatarFor} from '../packages/contracts/src/avatar';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Snapshot, QuizInput } from '../packages/contracts/src/index';

const origin = process.env.BASE_URL;
if (!origin || !['https:','http:'].includes(new URL(origin).protocol)) throw new Error('Set BASE_URL to the intended HTTPS deployment.');
type Client = { cookie: string };
const host: Client = {cookie:''};
const players: Client[] = Array.from({length:3}, () => ({cookie:''}));
async function call<T>(client:Client, path:string, method='GET', body?:unknown, status=200):Promise<T> {
  const response = await fetch(origin + path, {signal:AbortSignal.timeout(45000), method, headers:{Origin:origin!, Cookie:client.cookie,
    ...(body === undefined ? {} : {'Content-Type':'application/json'}), 'Idempotency-Key':randomUUID()},
    body:body === undefined ? undefined : JSON.stringify(body)});
  const payload = await response.json() as {data:T;error?:unknown};
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(payload.error)}`);
  for(const value of response.headers.getSetCookie()) {
    const pair=value.split(';')[0], key=pair.split('=')[0];
    client.cookie=[...client.cookie.split('; ').filter(c=>c&&!c.startsWith(key+'=')),pair].join('; ');
  }
  return payload.data;
}
const password=randomBytes(24).toString('base64url');
await call(players[0],'/api/v1/quizzes','GET',undefined,401);
await call(host,'/api/auth/register','POST',{email:`qa-${randomUUID()}@example.test`,password,displayName:'Production verification'},201);
const demo=await call<QuizInput>(host,'/api/v1/demo');
demo.title='Production verification — five games';
demo.rounds=demo.rounds.map(r=>({...r,timerSeconds:20}));
const quiz=await call<{id:string;revision:number}>(host,'/api/v1/quizzes','POST',demo,201);
const version=await call<{id:string}>(host,`/api/v1/quizzes/${quiz.id}/publish`,'POST',{expectedRevision:quiz.revision},201);
const room=await call<{sessionId:string;pin:string}>(host,'/api/v1/sessions','POST',{quizVersionId:version.id},201);
const path=`/api/v1/sessions/${room.sessionId}`;
for(const [i,player]of players.entries()) await call(player,'/api/v1/sessions/join','POST',{pin:room.pin,nickname:['Luna','Moss','Pip'][i]},201);
const snapshot=(client=host)=>call<Snapshot>(client,path+'/snapshot');
const initial=(await snapshot()).members;
assert.ok(initial.every(m=>m.avatar),'new joins have stored appearance');
assert.equal(new Set(initial.map(m=>JSON.stringify(m.avatar))).size,initial.length);
const playerId=(await snapshot(players[0])).participantId!;
const look={...avatarFor('production-cast-check'),hat:2,skin:7};
await call(players[0],path+'/appearance?role=player','POST',{avatar:look});
for(const viewer of [host,...players])assert.deepEqual((await snapshot(viewer)).members.find(m=>m.id===playerId)?.avatar,look,'appearance synchronized');
await call(players[1],path+'/appearance?role=player','POST',{avatar:look,participantId:playerId},422);
await call(host,path+'/appearance','POST',{avatar:look},403);
const savedLooks=new Map((await snapshot()).members.map(m=>[m.id,m.avatar]));

const action=async(action:string,args?:unknown)=>call(host,path+'/host-actions','POST',{action,args,expectedStateVersion:(await snapshot()).stateVersion});
const wait=async(state:string)=>{for(let i=0;i<120;i++){const s=await snapshot();if(s.state===state)return s;await new Promise(r=>setTimeout(r,500));}throw new Error('State did not reach '+state);};
const pairing=await call<{token:string}>(host,path+'/display-pairing','POST',{},201);
assert.equal((await call<Snapshot>(players[0],'/api/v1/display/'+pairing.token+'/snapshot')).role,'display');
await call(players[0],path+'/host-actions','POST',{action:'START',expectedStateVersion:(await snapshot()).stateVersion},403);
await action('START');
const verified:string[]=[];
for(const round of demo.rounds){
  const reading=await wait('ROUND_PREPARE');assert.equal(reading.phase,'reading');assert.equal(reading.reveal,undefined);assert.equal(reading.round?.fillTarget,undefined);
  if(round===demo.rounds[0]){await call(players[0],path+'/submissions','POST',{roundId:round.id,clientMutationId:randomUUID(),revision:1,payload:{value:144,locked:true}},409);await action('PAUSE');assert.equal((await snapshot(players[1])).phase,'reading');await action('RESUME');}
  await wait('ROUND_ACTIVE');
  const before=await snapshot(players[0]);assert.equal(before.automatic,true,'new HTTP rooms enable automatic play');for(const m of before.members)assert.deepEqual(m.avatar,savedLooks.get(m.id),'appearance survives each round');
  if(round===demo.rounds[0])await call(players[0],path+'/appearance?role=player','POST',{avatar:look},409);
  assert.equal(before.round?.id,round.id);assert.equal(before.reveal,undefined);assert.equal('secretConfig' in before.round!,false);assert.equal(before.round?.fillTarget,undefined,'Count answer remains secret');
  if(round.mode==='fermi'){await action('PAUSE');const paused=await snapshot(players[0]);assert.equal(paused.state,'PAUSED');await action('RESUME');}
  for(const [i,client] of players.entries()){
    if(round.mode==='word_puzzle') await call(client,path+'/word-guesses','POST',{roundId:round.id,clientMutationId:randomUUID(),guess:round.secretConfig.answer});
    else {const payload=round.mode==='fermi'?{value:Math.round(round.secretConfig.answer*(1+i*.1))}:round.mode==='rare_answers'?{text:round.secretConfig.answers[i].canonical}:round.mode==='size_it_up'?{ratio:round.secretConfig.targetSize/round.publicConfig.referenceSize*(1+i*.1)}:{count:Number(round.secretConfig.answer)+i};
      await call(client,path+'/submissions','POST',{roundId:round.id,clientMutationId:randomUUID(),revision:1,payload:{...payload,locked:true}});}
  }

  await wait('ROUND_REVEAL');
  const results=await snapshot(players[0]);assert.ok(results.reveal);assert.equal(results.previousLeaderboard?.length,3);for(const p of results.leaderboard)assert.equal(p.points,results.previousLeaderboard!.find(b=>b.participantId===p.participantId)!.points+p.roundPoints);assert.equal(results.roundAwards?.length,3);assert.equal(results.leaderboard.length,3);
  assert.deepEqual((await snapshot(players[0])).leaderboard,results.leaderboard,'HTTP reconnection retains scores');
  if(round.mode==='fermi'){await action('PAUSE');const paused=await snapshot(players[0]);assert.equal(paused.phase,'reveal');assert.ok(paused.reveal);await action('RESUME');}
  if(round.id!==demo.rounds.at(-1)!.id){await wait('INTERMISSION');if(round.mode==='fermi'){await action('PAUSE');assert.equal((await snapshot(players[1])).phase,'placements');await action('RESUME');}}
  verified.push(round.mode);console.log('Automatic mode passed: '+round.mode);
}
const final=await wait('SESSION_COMPLETED');assert.equal(final.leaderboard.length,3);for(const p of final.leaderboard)assert.deepEqual(p.avatar,savedLooks.get(p.participantId),'podium keeps actual characters');assert.ok(final.leaderboard[0].points>0);
await call(host,`/api/v1/quizzes/${quiz.id}`,'DELETE',undefined);
await call(host,'/api/auth/logout','POST',{});
await call(host,'/api/v1/quizzes','GET',undefined,401);
console.log(JSON.stringify({origin,status:'passed',players:3,verified,checks:['reading blocks early answers','reading pause/resume','authoritative previous and new totals','stored unique appearances','synchronized lobby edits','appearance authorization','appearance persistence through rounds and podium','creator registration','quiz save and publish','guest PIN joining','read-only display','host authorization','hidden answer keys','all five submissions','pause/resume','server scoring','placement broadcast','reconnection','final results','logout'],sessionId:room.sessionId},null,2));
