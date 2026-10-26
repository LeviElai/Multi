import {prepareDaily,selectDailyWithAI} from './daily-preparation';
import {compactTemporaryData} from './cost-maintenance';
import { geminiGenerate, runGenerationWorker } from './ai';
import { adsReady } from './ads';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Server as SocketServer, type Socket } from 'socket.io';
import { DomainError, type Features, type Principal } from '../../../packages/contracts/src/index';
import { handleApi, resolvePrincipal } from './api';
import { GameEngine } from './engine';
import { CreatorAuth } from './auth';
import { createRuntime } from './runtime';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Connected = {request:Request;sessionId:string;lastSeq:number;lastStateVersion:number};
type Budget = {count:number;expires:number};
export class RateLimiter {
  private buckets=new Map<string,Budget>();
  allow(key:string,limit:number,windowMs:number) {
    const now=Date.now();
    let bucket=this.buckets.get(key);
    if(!bucket||bucket.expires<=now){
      if(this.buckets.size>=50000){for(const [id,value]of this.buckets)if(value.expires<=now)this.buckets.delete(id);if(this.buckets.size>=50000&&!bucket)return false;}
      bucket={count:0,expires:now+windowMs};this.buckets.set(key,bucket);
    }
    bucket.count++;
    if(this.buckets.size>10000)for(const [id,value]of this.buckets)if(value.expires<=now)this.buckets.delete(id);
    return bucket.count<=limit;
  }
}
function errorResponse(error:unknown) {
  if(error instanceof DomainError)return Response.json({error:{code:error.code,message:error.message,requestId:randomUUID(),...(error.details?{details:error.details}:{})}},{status:error.status});
  return Response.json({error:{code:'INTERNAL_ERROR',message:'The request could not be completed.',requestId:randomUUID()}},{status:500});
}
function log(event:string,details:Record<string,unknown>={}) {process.stdout.write(`${JSON.stringify({time:new Date().toISOString(),event,...details})}\n`);}
function environmentOrigin(value:string|undefined,production:boolean) {
  if(!value&&production)throw new Error('PUBLIC_ORIGIN is required in production.');
  const parsed=new URL(value??'http://localhost:4001');
  if(parsed.origin!==value&&value)throw new Error('PUBLIC_ORIGIN must contain only scheme and host (no path or trailing slash).');
  if(production&&parsed.protocol!=='https:')throw new Error('Production PUBLIC_ORIGIN must use HTTPS.');
  return parsed.origin;
}
function requestAddress(req:IncomingMessage,trustProxy:boolean) {
  // Enable only behind one trusted proxy which overwrites, rather than appends, this header.
  const forwarded=req.headers['x-forwarded-for'];
  return trustProxy&&typeof forwarded==='string'?forwarded.split(',').at(-1)?.trim()??'unknown':req.socket.remoteAddress??'unknown';
}
async function webRequest(req:IncomingMessage,origin:string) {
  const headers=new Headers();
  for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(', '):value);
  let body:Buffer|undefined;
  if(req.method!=='GET'&&req.method!=='HEAD') {
    const chunks:Buffer[]=[];let bytes=0;
    for await(const chunk of req) {
      const value=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=value.length;
      if(bytes>1024*1024)throw new DomainError('PAYLOAD_TOO_LARGE','Request exceeds 1 MiB.',413);
      chunks.push(value);
    }
    body=Buffer.concat(chunks);
  }
  const path=req.url?.startsWith('/')&&!req.url.startsWith('//')?req.url:'/';
  return new Request(new URL(path,origin),{method:req.method,headers,body:body?.length?new Uint8Array(body):undefined});
}
async function sendResponse(res:ServerResponse,response:Response,secure:boolean,origin:string|null) {
  res.statusCode=response.status;
  response.headers.forEach((value,key)=>{if(key!=='set-cookie')res.setHeader(key,value);});
  const cookies=response.headers.getSetCookie();
  if(cookies.length)res.setHeader('set-cookie',cookies);
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Vary','Origin');}
  res.end(Buffer.from(await response.arrayBuffer()));
}

export async function startGameServer(environment:NodeJS.ProcessEnv=process.env) {
  const maintenance=environment.MAINTENANCE_MODE==='1';
  if(environment.MIGRATION_TARGET_DATABASE_URL){
    if(!maintenance)throw new Error('Database copying requires maintenance mode.');
    const {copyPostgresDatabase}=await import('../../../scripts/copy-postgres');
    await copyPostgresDatabase(environment);
  }
  const production=environment.NODE_ENV==='production';
  const publicOrigin=environmentOrigin(environment.PUBLIC_ORIGIN,production);
  const secure=publicOrigin.startsWith('https:');
  const pinSecret=environment.PIN_PEPPER;
  if(!pinSecret||pinSecret.length<32)throw new Error('PIN_PEPPER must contain at least 32 characters. Generate one before starting the service.');
  const maxPlayers=Number(environment.MAX_PLAYERS??25);
  if(!Number.isInteger(maxPlayers)||maxPlayers<1||maxPlayers>100)throw new Error('MAX_PLAYERS must be an integer from 1 through 100. The default private-alpha cap is 25.');
  const origins=new Set([publicOrigin,...(environment.ALLOWED_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean)]);
  for(const origin of origins)if(new URL(origin).origin!==origin)throw new Error('ALLOWED_ORIGINS must be exact origins.');
  const {db,store}=await createRuntime(environment);
  const auth=new CreatorAuth(store,db,secure);
  try {await auth.initialize(environment);}catch(error){await db.close();throw error;}
  const engine=new GameEngine(store,()=>Date.now(),{pinSecret,maxPlayers,automatic:environment.AUTOMATIC_FLOW!=='0',rulesVersion:environment.GAME_RULES_V2==='1'?2:undefined});
  const adsConfig={unitPath:environment.GOOGLE_REWARDED_AD_UNIT??'',approved:environment.ADS_APPROVED==='1',consentReady:environment.ADS_CONSENT_READY==='1'};
  const aiEnabled=!!environment.GEMINI_API_KEY;
  const features:Features={ai:aiEnabled,billing:false,ads:adsReady(adsConfig),stage:'private_alpha',transport:'socket',auth:'credentials'};
  let nextAiCheck=0,aiWake=0,nextCompaction=0,nextDailyCheck=0;
  const limiter=new RateLimiter();let draining=false;let ticking=false;
  let broadcastTimer:NodeJS.Timeout|undefined;let broadcasting=false;let broadcastAgain=false;
  const connections=new Map<string,Connected>();
  const server=createServer(async(req,res)=>{
    const started=Date.now();const path=new URL(req.url??'/',publicOrigin).pathname;
    const safeLogPath=path.replace(/(\/display\/)[^/]+/,'$1[redacted]');
    const origin=typeof req.headers.origin==='string'?req.headers.origin:null;
    const allowedOrigin=origin&&origins.has(origin)?origin:null;
    try {
      if(path==='/health/live')return await sendResponse(res,Response.json({status:draining?'draining':'live'},{status:draining?503:200}),secure,null);
      if(path==='/health/ready'){
        if(draining)throw new DomainError('DRAINING','Service is draining.',503);
        await db.query('SELECT 1');return await sendResponse(res,Response.json({status:'ready',...(maintenance?{maintenance:true}:{})}),secure,null);
      }
      if(maintenance)throw new DomainError('MAINTENANCE','Database migration in progress. Please try again shortly.',503);
      if(draining)throw new DomainError('DRAINING','Service is restarting. Retry shortly.',503);
      if(origin&&!allowedOrigin)throw new DomainError('ORIGIN_DENIED','Origin is not permitted.',403);
      if(!['GET','HEAD','OPTIONS'].includes(req.method??'GET')&&!allowedOrigin)throw new DomainError('ORIGIN_REQUIRED','A matching Origin header is required.',403);
      if(req.method==='OPTIONS') {
        if(!allowedOrigin)throw new DomainError('ORIGIN_DENIED','Origin is not permitted.',403);
        return await sendResponse(res,new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Idempotency-Key, If-Match','Access-Control-Max-Age':'600'}}),secure,allowedOrigin);
      }
      const address=requestAddress(req,environment.TRUST_PROXY==='1');
      // Many legitimate phones can share one Wi-Fi address. Fine-grained
      // participant/action limits remain in the controller; this is a coarse
      // transport ceiling which permits fallback polling plus input updates.
      if(!limiter.allow(`http:${address}`,Math.max(6000,maxPlayers*240),60000))throw new DomainError('RATE_LIMITED','Too many requests. Try again shortly.',429);
      if((path==='/api/auth/login'||path==='/api/auth/register')&&!limiter.allow(`login:${address}`,8,60000))throw new DomainError('RATE_LIMITED','Too many sign-in attempts. Try again in a minute.',429);
      if(path==='/api/v1/sessions/join'&&!limiter.allow(`join:${address}`,90,60000))throw new DomainError('RATE_LIMITED','Too many join attempts. Try again in a minute.',429);
      const request=await webRequest(req,allowedOrigin??publicOrigin);
      const authResponse=await auth.handle(request);
      const response=authResponse??await handleApi(request,{store,user:await auth.identify(request),features,cookieSecure:secure,pinSecret,clientIp:address,maxPlayers,automatic:environment.AUTOMATIC_FLOW!=='0',rulesVersion:environment.GAME_RULES_V2==='1'?2:undefined,aiEnabled,adsConfig});
      await sendResponse(res,response,secure,allowedOrigin);
      if(req.method!=='GET'&&response.ok){scheduleBroadcast();if(path==='/api/v1/ai/generate'){aiWake++;nextAiCheck=0;}}
      log('http_request',{method:req.method,path:safeLogPath,status:response.status,durationMs:Date.now()-started});
    } catch(error) {
      if(!(error instanceof DomainError))log('http_error',{path:safeLogPath,errorType:error instanceof Error?error.name:'unknown'});
      if(!res.headersSent)await sendResponse(res,errorResponse(error),secure,allowedOrigin);
    }
  });
  server.requestTimeout=30000;server.headersTimeout=15000;
  const io=new SocketServer(server,{
    transports:['websocket','polling'],maxHttpBufferSize:32768,serveClient:false,
    cors:{origin:[...origins],credentials:true},
    allowRequest:(req,callback)=>callback(null,!maintenance&&!draining&&typeof req.headers.origin==='string'&&origins.has(req.headers.origin)),
    connectionStateRecovery:undefined,
  });
  async function authorize(connection:Connected):Promise<Principal> {
    return resolvePrincipal(connection.request,store,await auth.identify(connection.request),connection.sessionId);
  }
  async function sendSnapshot(socket:Socket,force=false) {
    const connection=connections.get(socket.id);if(!connection)return;
    const principal=await authorize(connection);
    const snapshot=await engine.snapshot(principal,connection.sessionId);
    if(snapshot.latestSeq<connection.lastSeq||snapshot.stateVersion<connection.lastStateVersion)return;
    if(force||snapshot.latestSeq!==connection.lastSeq||snapshot.stateVersion!==connection.lastStateVersion) {
      socket.emit('session.snapshot',snapshot);connection.lastSeq=snapshot.latestSeq;connection.lastStateVersion=snapshot.stateVersion;
    }
  }
  async function broadcastSnapshots() {
    if(broadcasting){broadcastAgain=true;return;}broadcasting=true;
    try {await Promise.allSettled([...io.sockets.sockets.values()].map(async(socket)=>{
      try {await sendSnapshot(socket);}catch(error){socket.emit('client.error',{code:error instanceof DomainError?error.code:'SNAPSHOT_FAILED',message:'Reconnect to restore your room.'});socket.disconnect(true);}
    }));}finally{broadcasting=false;if(broadcastAgain){broadcastAgain=false;scheduleBroadcast();}}
  }
  function scheduleBroadcast() {
    if(broadcastTimer||draining)return;
    // A submission burst schedules one role-projected update, avoiding N² full
    // snapshot reads. ACK delivery does not wait for unrelated players' views.
    broadcastTimer=setTimeout(()=>{broadcastTimer=undefined;void broadcastSnapshots();},40);broadcastTimer.unref();
  }
  io.use(async(socket,next)=>{
    try {
      const input=socket.handshake.auth as Record<string,unknown>;
      if(typeof input.sessionId!=='string'||!UUID.test(input.sessionId))throw new DomainError('INVALID_SESSION','Session is required.',400);
      if(!limiter.allow(`socket:${requestAddress(socket.request,environment.TRUST_PROXY==='1')}`,60,60000))throw new DomainError('RATE_LIMITED','Too many connection attempts.',429);
      const url=new URL(`/api/v1/sessions/${input.sessionId}/snapshot`,publicOrigin);
      if(input.role==='host'||input.role==='player')url.searchParams.set('role',input.role);
      if(typeof input.displayToken==='string'&&input.displayToken.length<=256)url.searchParams.set('displayToken',input.displayToken);
      const request=new Request(url,{headers:{cookie:socket.handshake.headers.cookie??'',Origin:publicOrigin}});
      const connection={request,sessionId:input.sessionId,lastSeq:-1,lastStateVersion:-1};
      await authorize(connection);connections.set(socket.id,connection);next();
    }catch(error){const denied=new Error(error instanceof DomainError?error.code:'UNAUTHORIZED');next(denied);}
  });
  const routes:Record<string,string>={'answer.submit':'submissions','word.guess':'word-guesses','host.action':'host-actions','review.decide':'rare-review'};
  io.on('connection',(socket)=>{
    void sendSnapshot(socket,true).catch(()=>socket.disconnect(true));
    socket.on('session.resume',(_payload:unknown,ack?:unknown)=>{
      if(!limiter.allow(`resume:${socket.id}`,10,10000))return;
      void sendSnapshot(socket,true).then(()=>{if(typeof ack==='function')ack({accepted:true});}).catch(()=>socket.disconnect(true));
    });
    for(const [event,route]of Object.entries(routes))socket.on(event,async(payload:unknown,ack?:unknown)=>{
      try {
        if(draining)throw new DomainError('DRAINING','Service is restarting.',503);
        if(!limiter.allow(`command:${socket.id}`,100,10000))throw new DomainError('RATE_LIMITED','Too many commands.',429);
        if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new DomainError('INVALID_REQUEST','Invalid command.',400);
        const connection=connections.get(socket.id);if(!connection)throw new DomainError('UNAUTHORIZED','Reconnect first.',401);
        await authorize(connection);
        const data=payload as Record<string,unknown>;
        const url=new URL(connection.request.url);url.pathname=`/api/v1/sessions/${connection.sessionId}/${route}`;
        const headers=new Headers(connection.request.headers);headers.set('Content-Type','application/json');
        if(typeof data.idempotencyKey==='string')headers.set('Idempotency-Key',data.idempotencyKey);
        const response=await handleApi(new Request(url,{method:'POST',headers,body:JSON.stringify(data)}),{store,user:await auth.identify(connection.request),features,cookieSecure:secure,pinSecret,clientIp:requestAddress(socket.request,environment.TRUST_PROXY==='1'),maxPlayers,automatic:environment.AUTOMATIC_FLOW!=='0',rulesVersion:environment.GAME_RULES_V2==='1'?2:undefined});
        const result=await response.json() as {data?:unknown;error?:unknown};
        if(typeof ack==='function')ack(result);
        if(response.ok){if(event==='answer.submit'||event==='word.guess')socket.emit('answer.ack',result.data);scheduleBroadcast();}
        else {socket.emit('client.error',result.error);await sendSnapshot(socket,true);}
      }catch(error){const response=errorResponse(error);const result=await response.json() as {error:unknown};if(typeof ack==='function')ack(result);socket.emit('client.error',result.error);}
    });
    socket.on('disconnect',()=>{connections.delete(socket.id);});
  });
  // Poll committed canonical state; no transient pub/sub message is necessary for recovery.
  const timer=setInterval(async()=>{
    if(ticking||draining||maintenance)return;ticking=true;
    try {await engine.reconcile();await broadcastSnapshots();}catch(error){log('reconcile_failed',{errorType:error instanceof Error?error.name:'unknown'});}finally{ticking=false;}
  },500);timer.unref();
  let aiTicking=false;
  const aiTimer=setInterval(async()=>{
    if(aiTicking||draining||maintenance)return;
    const now=Date.now();if(now<nextAiCheck&&now<nextCompaction&&now<nextDailyCheck)return;aiTicking=true;const wake=aiWake;
    try{
      if(now>=nextDailyCheck){nextDailyCheck=now+3600000;if(environment.DAILY_ENABLED==='1')try{const result=await prepareDaily(db,now,environment.GEMINI_API_KEY?(day,candidates)=>selectDailyWithAI(day,candidates,environment.GEMINI_API_KEY!,environment.GEMINI_MODEL):undefined);log('daily_prepared',result);}catch(error){nextDailyCheck=now+60000;log('daily_preparation_failed',{errorType:error instanceof Error?error.name:'unknown'});}}
      if(now>=nextCompaction){nextCompaction=now+3600000;try{await compactTemporaryData(store);}catch(error){log('temporary_cleanup_failed',{errorType:error instanceof Error?error.name:'unknown',code:typeof (error as {code?:unknown})?.code==='string'?(error as {code:string}).code:'unknown'});}}
      if(aiEnabled&&now>=nextAiCheck){const worked=await runGenerationWorker(store,(input,onUsage)=>geminiGenerate(input,environment.GEMINI_API_KEY!,environment.GEMINI_MODEL,onUsage));nextAiCheck=aiWake!==wake?0:Date.now()+(worked?1000:30000);}else if(!aiEnabled)nextAiCheck=now+30000;
    }catch(error){nextAiCheck=Date.now()+30000;log('generation_worker_failed',{errorType:error instanceof Error?error.name:'unknown'});}finally{aiTicking=false;}
  },1500);aiTimer.unref();
  if(!maintenance)await engine.reconcile();
  const port=Number(environment.PORT??4001);const host=environment.HOST??'0.0.0.0';
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  log('service_started',{port:(server.address()as{port:number}).port,stage:features.stage,storage:db.dialect});
  async function close() {
    if(draining)return;draining=true;clearInterval(timer);clearInterval(aiTimer);if(broadcastTimer)clearTimeout(broadcastTimer);io.emit('server.draining',{retryAfterMs:1500});
    await new Promise<void>((resolve)=>io.close(()=>resolve()));
    if(server.listening)await new Promise<void>((resolve)=>server.close(()=>resolve()));
    while(ticking||broadcasting||aiTicking)await new Promise(resolve=>setTimeout(resolve,20));
    await db.close();log('service_stopped');
  }
  return {server,io,store,db,close,port:(server.address()as{port:number}).port};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const service=await startGameServer();
  for(const signal of ['SIGTERM','SIGINT']as const)process.once(signal,()=>{
    const timeout=setTimeout(()=>process.exit(1),25000);timeout.unref();
    void service.close().then(()=>{clearTimeout(timeout);process.exit(0);}).catch(()=>process.exit(1));
  });
}
