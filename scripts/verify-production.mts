import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Snapshot, QuizInput } from '../packages/contracts/src/index';

const origin = process.env.BASE_URL;
if (!origin || new URL(origin).protocol !== 'https:') throw new Error('Set BASE_URL to the intended HTTPS deployment.');
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
const action=async(action:string,args?:unknown)=>call(host,path+'/host-actions','POST',{action,args,expectedStateVersion:(await snapshot()).stateVersion});
const wait=async(state:string)=>{for(let i=0;i<35;i++){const s=await snapshot();if(s.state===state)return s;await new Promise(r=>setTimeout(r,500));}throw new Error('State did not reach '+state);};
const pairing=await call<{token:string}>(host,path+'/display-pairing','POST',{},201);
assert.equal((await call<Snapshot>(players[0],'/api/v1/display/'+pairing.token+'/snapshot')).role,'display');
await call(players[0],path+'/host-actions','POST',{action:'START',expectedStateVersion:(await snapshot()).stateVersion},403);
await action('START');
const verified:string[]=[];
for(const round of demo.rounds){
  await wait('ROUND_ACTIVE');
  const before=await snapshot(players[0]);
  assert.equal(before.round?.id,round.id);assert.equal(before.reveal,undefined);assert.equal('secretConfig' in before.round!,false);assert.equal(before.round?.fillTarget,undefined,'Count answer remains secret');
  for(const [i,client] of players.entries()){
    if(round.mode==='word_puzzle') await call(client,path+'/word-guesses','POST',{roundId:round.id,clientMutationId:randomUUID(),guess:round.secretConfig.answer});
    else {const payload=round.mode==='fermi'?{value:Math.round(round.secretConfig.answer*(1+i*.1))}:round.mode==='rare_answers'?{text:round.secretConfig.answers[i].canonical}:round.mode==='size_it_up'?{ratio:round.secretConfig.targetSize/round.publicConfig.referenceSize*(1+i*.1)}:{count:Number(round.secretConfig.answer)+i};
      await call(client,path+'/submissions','POST',{roundId:round.id,clientMutationId:randomUUID(),revision:1,payload});}
  }
  if(round.mode==='fermi'){await action('PAUSE');const paused=await snapshot(players[0]);assert.equal(paused.state,'PAUSED');await action('RESUME');}
  await action('LOCK');await wait('ROUND_SCORED');await action('REVEAL');
  const results=await snapshot(players[0]);assert.ok(results.reveal);assert.equal(results.roundAwards?.length,3);assert.equal(results.leaderboard.length,3);
  assert.deepEqual((await snapshot(players[0])).leaderboard,results.leaderboard,'HTTP reconnection retains scores');
  await action('RESULT_STAGE',{stage:'standings'});assert.equal((await snapshot(players[1])).resultStage,'standings');
  verified.push(round.mode);await action('NEXT');
}
const final=await wait('SESSION_COMPLETED');assert.equal(final.leaderboard.length,3);assert.ok(final.leaderboard[0].points>0);
await call(host,`/api/v1/quizzes/${quiz.id}`,'DELETE',undefined);
await call(host,'/api/auth/logout','POST',{});
await call(host,'/api/v1/quizzes','GET',undefined,401);
console.log(JSON.stringify({origin,status:'passed',players:3,verified,checks:['creator registration','quiz save and publish','guest PIN joining','read-only display','host authorization','hidden answer keys','all five submissions','pause/resume','server scoring','placement broadcast','reconnection','final results','logout'],sessionId:room.sessionId},null,2));
