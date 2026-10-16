import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import type { Snapshot, QuizInput, Round } from '../../packages/contracts/src/index';

const publicOrigin='http://localhost:4001';
type Running={child:ChildProcess;url:string;stop(signal?:NodeJS.Signals):Promise<void>};
type Envelope<T>={data:T;error?:{code:string;message:string}};
async function launch(environment:NodeJS.ProcessEnv):Promise<Running> {
  const child=spawn(process.execPath,['--import','tsx','apps/game-service/src/server.ts'],{env:environment,stdio:['ignore','pipe','pipe']});
  let text='';let diagnostic='';
  child.stderr?.on('data',chunk=>{diagnostic+=String(chunk);});
  const port=await new Promise<number>((resolve,reject)=>{
    const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error(`Server startup timed out: ${diagnostic}`));},15000);
    child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Server exited ${code}: ${diagnostic}`));});
    child.stdout?.on('data',chunk=>{
      text+=String(chunk);const lines=text.split('\n');text=lines.pop()??'';
      for(const line of lines){try{const event=JSON.parse(line);if(event.event==='service_started'){clearTimeout(timeout);resolve(Number(event.port));}}catch{/* diagnostic line */}}
    });
  });
  return {child,url:`http://127.0.0.1:${port}`,async stop(signal='SIGTERM'){
    if(child.exitCode!==null||child.signalCode!==null)return;
    const ended=once(child,'exit');child.kill(signal);await ended;
  }};
}
async function connect(url:string,sessionId:string,cookie:string,role:'host'|'player'|'display',displayToken?:string) {
  const socket=io(url,{autoConnect:false,transports:['websocket'],forceNew:true,reconnection:false,timeout:5000,
    extraHeaders:{Origin:publicOrigin,Cookie:cookie},auth:{sessionId,role,displayToken}});
  const initial=new Promise<Snapshot>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Snapshot timeout')),7000);
    socket.once('session.snapshot',(snapshot:Snapshot)=>{clearTimeout(timeout);resolve(snapshot);});
    socket.once('connect_error',error=>{clearTimeout(timeout);reject(error);});
  });socket.connect();return {socket,snapshot:await initial};
}
async function command<T>(socket:Socket,event:string,payload:unknown):Promise<Envelope<T>> {
  return new Promise((resolve,reject)=>{socket.timeout(8000).emit(event,payload,(error:Error|null,result:Envelope<T>)=>error?reject(error):resolve(result));});
}

test('HTTP + Socket.IO: ten players, five modes, authorization and process-crash recovery', {timeout:90000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'multigame-node-e2e-'));
  const environment:NodeJS.ProcessEnv={...process.env,NODE_ENV:'test',DATABASE_URL:'',SQLITE_PATH:join(directory,'session.sqlite'),AUTO_MIGRATE:'1',PORT:'0',HOST:'127.0.0.1',PUBLIC_ORIGIN:publicOrigin,PIN_PEPPER:randomBytes(32).toString('hex'),AUTH_BOOTSTRAP_EMAIL:'host@example.test',AUTH_BOOTSTRAP_PASSWORD:'local-test-password-strong',AUTH_BOOTSTRAP_NAME:'Test Host'};
  let runtime=await launch(environment);const sockets:Socket[]=[];
  const call=async<T=Record<string,unknown>>(path:string,method='GET',body?:unknown,cookie='',expected=200,headers:Record<string,string>={})=>{
    const response=await fetch(`${runtime.url}${path}`,{method,headers:{Origin:publicOrigin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),'Idempotency-Key':randomUUID(),...headers},body:body!==undefined?JSON.stringify(body):undefined});
    const result=await response.json() as Envelope<T>;
    assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(result)}`);
    return {data:result.data,error:result.error,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; '),response};
  };
  try {
    await call('/health/ready');
    await call('/api/v1/quizzes','GET',undefined,'',401,{'oai-authenticated-user-id':'forged-owner','oai-authenticated-user-email':'host@example.test'});
    await call('/api/auth/login','POST',{email:'host@example.test',password:'wrong'},'',401);
    const loggedIn=await call('/api/auth/login','POST',{email:'host@example.test',password:environment.AUTH_BOOTSTRAP_PASSWORD});
    assert.match(loggedIn.response.headers.get('set-cookie')??'',/HttpOnly/);const hostCookie=loggedIn.cookie;
    await call('/api/auth/logout','POST',{},hostCookie,403,{Origin:'https://attacker.invalid'});
    const demo=(await call<QuizInput>('/api/v1/demo')).data;
    const created=(await call<{id:string;revision:number}>('/api/v1/quizzes','POST',demo,hostCookie,201)).data;
    const version=(await call<{id:string}>(`/api/v1/quizzes/${created.id}/publish`,'POST',{expectedRevision:created.revision},hostCookie,201)).data;
    const room=(await call<{sessionId:string;pin:string}>('/api/v1/sessions','POST',{quizVersionId:version.id},hostCookie,201)).data;
    const sessionPath=`/api/v1/sessions/${room.sessionId}`;
    await call('/api/v1/sessions/join','POST',{pin:room.pin,nickname:'<script>alert(1)</script>'},'',422);
    const first=await call<{participantId:string}>('/api/v1/sessions/join','POST',{pin:room.pin,nickname:'Ada'},'',201);
    const second=await call<{participantId:string}>('/api/v1/sessions/join','POST',{pin:room.pin,nickname:'Bo'},'',201);
    const participants=[first,second];
    for(let index=2;index<10;index++)participants.push(await call<{participantId:string}>('/api/v1/sessions/join','POST',{pin:room.pin,nickname:`Player ${index+1}`},'',201));
    const host=await connect(runtime.url,room.sessionId,hostCookie,'host');sockets.push(host.socket);
    let player=await connect(runtime.url,room.sessionId,first.cookie,'player');sockets.push(player.socket);
    for(const participant of participants.slice(1))sockets.push((await connect(runtime.url,room.sessionId,participant.cookie,'player')).socket);
    assert.equal(player.snapshot.role,'player');assert.equal(player.snapshot.pin,undefined);
    const pairing=(await call<{token:string}>(`${sessionPath}/display-pairing`,'POST',{},hostCookie,201)).data;
    const display=await connect(runtime.url,room.sessionId,'','display',pairing.token);sockets.push(display.socket);
    assert.equal(display.snapshot.role,'display');assert.equal(display.snapshot.pin,undefined);
    const forged=await command(player.socket,'host.action',{action:'START',expectedStateVersion:0,idempotencyKey:randomUUID()});
    assert.equal(forged.error?.code,'FORBIDDEN');
    const snapshot=async(cookie=hostCookie)=> (await call<Snapshot>(`${sessionPath}/snapshot`,'GET',undefined,cookie)).data;
    const act=async(action:string)=>{const before=await snapshot();return call(`${sessionPath}/host-actions`,'POST',{action,expectedStateVersion:before.stateVersion},hostCookie);};
    const waitState=async(state:Snapshot['state'])=>{
      const end=Date.now()+10000;
      do {const current=await snapshot();if(current.state===state)return current;await new Promise(resolve=>setTimeout(resolve,180));}while(Date.now()<end);
      assert.fail(`Room did not reach ${state}`);
    };
    await act('START');
    for(let index=0;index<demo.rounds.length;index++) {
      const current=await waitState('ROUND_ACTIVE');const round=demo.rounds[index];
      const projected=await snapshot(first.cookie);
      assert.equal(projected.round?.mode,round.mode);assert.equal(projected.reveal,undefined);
      assert.equal('secretConfig' in (projected.round??{}),false);
      if(index===0){
        const deadline=current.deadlineAt;
        sockets.forEach(socket=>socket.disconnect());
        await runtime.stop('SIGKILL');runtime=await launch(environment);
        const recovered=await snapshot(first.cookie);assert.equal(recovered.deadlineAt,deadline);assert.equal(recovered.state,'ROUND_ACTIVE');
        player=await connect(runtime.url,room.sessionId,first.cookie,'player');sockets.push(player.socket);
        for(const participant of participants.slice(1))sockets.push((await connect(runtime.url,room.sessionId,participant.cookie,'player')).socket);
      }
      if(round.mode==='word_puzzle'){
        const guess={roundId:round.id,clientMutationId:randomUUID(),guess:round.secretConfig.answer};
        const result=await command<{accepted:boolean;solved:boolean}>(player.socket,'word.guess',guess);
        assert.equal(result.data.accepted,true);assert.equal(result.data.solved,true);
        const repeat=await command(player.socket,'word.guess',guess);assert.deepEqual(repeat.data,result.data);
        await call(`${sessionPath}/word-guesses`,'POST',{...guess,clientMutationId:randomUUID()},second.cookie);
        for(const participant of participants.slice(2))await call(`${sessionPath}/word-guesses`,'POST',{...guess,clientMutationId:randomUUID()},participant.cookie);
      }else {
        const answer=(r:Round,participantIndex=0)=>r.mode==='fermi'?{value:r.secretConfig.answer}:r.mode==='rare_answers'?{text:['Coral','Mint','Lilac','Lemon','Sky'][participantIndex%5]}:r.mode==='size_it_up'?{ratio:r.secretConfig.targetSize/r.publicConfig.referenceSize}:r.mode==='amountle'?{count:r.secretConfig.answer}:{};
        const submission={roundId:round.id,clientMutationId:randomUUID(),revision:round.mode==='amountle'?8:1,payload:answer(round)};
        const result=await command<{accepted:boolean}>(player.socket,'answer.submit',submission);assert.equal(result.data.accepted,true);
        const repeat=await command(player.socket,'answer.submit',submission);assert.deepEqual(repeat.data,result.data);
        await call(`${sessionPath}/submissions`,'POST',{...submission,clientMutationId:randomUUID(),payload:answer(round,1)},second.cookie);
        for(let participantIndex=2;participantIndex<participants.length;participantIndex++)await call(`${sessionPath}/submissions`,'POST',{...submission,clientMutationId:randomUUID(),payload:answer(round,participantIndex)},participants[participantIndex].cookie);
        if(round.mode==='amountle') {
          const stale=await command(player.socket,'answer.submit',{...submission,clientMutationId:randomUUID(),revision:7,payload:{count:1}});
          assert.ok(stale.error,'Stale revision must be rejected');
          assert.equal((await snapshot(first.cookie)).ownSubmission?.payload.count,round.secretConfig.answer);
        }
      }
      await act('LOCK');await waitState('ROUND_SCORED');await act('REVEAL');
      const revealed=await snapshot(first.cookie);assert.ok(revealed.reveal);assert.equal(revealed.ownPoints,(index+1)*1000-(index>=1?111:0));
      await act('NEXT');
    }
    const complete=await waitState('SESSION_COMPLETED');
    assert.equal(complete.leaderboard.length,10);assert.ok(complete.leaderboard.every(row=>row.rank===1));
    assert.equal(complete.leaderboard[0].nickname,'Ada');assert.equal(complete.leaderboard[0].points,4889);
    sockets.forEach(socket=>socket.disconnect());await runtime.stop('SIGKILL');runtime=await launch(environment);
    assert.deepEqual((await snapshot()).leaderboard,complete.leaderboard);
    await call('/api/auth/logout','POST',{},hostCookie);
    await call('/api/v1/quizzes','GET',undefined,hostCookie,401);
  }finally{for(const socket of sockets)socket.disconnect();await runtime.stop();await rm(directory,{recursive:true,force:true});}
});

test('cross-origin WebSocket handshakes are rejected', {timeout:25000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'multigame-origin-e2e-'));
  const runtime=await launch({...process.env,NODE_ENV:'test',DATABASE_URL:'',SQLITE_PATH:join(directory,'test.sqlite'),AUTO_MIGRATE:'1',PORT:'0',HOST:'127.0.0.1',PUBLIC_ORIGIN:publicOrigin,PIN_PEPPER:randomBytes(32).toString('hex'),AUTH_BOOTSTRAP_EMAIL:'',AUTH_BOOTSTRAP_PASSWORD:''});
  const socket=io(runtime.url,{autoConnect:false,transports:['websocket'],reconnection:false,timeout:4000,extraHeaders:{Origin:'https://attacker.invalid'},auth:{sessionId:randomUUID()}});
  try{const failed=new Promise<Error>(resolve=>socket.once('connect_error',resolve));socket.connect();const error=await failed;assert.ok(error);assert.equal(socket.connected,false);}
  finally{socket.disconnect();await runtime.stop();await rm(directory,{recursive:true,force:true});}
});
