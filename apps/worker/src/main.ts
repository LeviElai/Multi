import { pathToFileURL } from 'node:url';
import { createRuntime, migrateRuntimeDatabase } from '../../game-service/src/runtime';
import { GameEngine } from '../../game-service/src/engine';

export async function startWorker(environment:NodeJS.ProcessEnv=process.env) {
  const {db,store}=await createRuntime(environment);
  const engine=new GameEngine(store,()=>Date.now(),{pinSecret:environment.PIN_PEPPER});
  let closing=false;let running=false;let lastCleanup=0;
  async function tick() {
    if(closing||running)return;running=true;
    try {
      await engine.reconcile();
      if(Date.now()-lastCleanup>3600000) {await db.query('DELETE FROM auth_sessions WHERE expires_at <= ?',[new Date().toISOString()]);lastCleanup=Date.now();}
    }catch(error){process.stderr.write(`${JSON.stringify({event:'worker_tick_failed',errorType:error instanceof Error?error.name:'unknown'})}\n`);}
    finally{running=false;}
  }
  await tick();const timer=setInterval(()=>void tick(),1000);timer.unref();
  return {async close(){closing=true;clearInterval(timer);while(running)await new Promise(resolve=>setTimeout(resolve,20));await db.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(process.argv.includes('--migrate')){
    const {db}=await createRuntime({...process.env,AUTO_MIGRATE:'0'});try{await migrateRuntimeDatabase(db);}finally{await db.close();}
  }else {
    const worker=await startWorker();
    const keepAlive=setInterval(()=>{},60000);
    for(const signal of ['SIGTERM','SIGINT']as const)process.once(signal,()=>{clearInterval(keepAlive);void worker.close().then(()=>process.exit(0));});
  }
}
