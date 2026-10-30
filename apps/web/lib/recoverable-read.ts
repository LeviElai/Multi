import {api,ApiError} from './api';

/** A cold service can take longer than one request. Retry reads only, with a
 * fixed budget; mutations retain their caller-owned idempotency and retry UI. */
export async function recoverableRead<T>(path:string,signal?:AbortSignal,onRetry?:()=>void):Promise<T>{
 for(let attempt=0;attempt<3;attempt++){
  signal?.throwIfAborted();
  try{return await api<T>(path,{signal});}
  catch(error){
   if(signal?.aborted||attempt===2||error instanceof ApiError&&![408,502,503,504].includes(error.status))throw error;
   onRetry?.();
   await new Promise<void>((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);reject(signal?.reason??new DOMException('Aborted','AbortError'));};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},750);
    signal?.addEventListener('abort',abort,{once:true});
   });
  }
 }
 throw new Error('Connection interrupted. Please retry.');
}
