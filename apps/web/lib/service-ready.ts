import type {Features} from '../../../packages/contracts/src/index';
import {api,ApiError} from './api';
/** Only the side-effect-free feature endpoint is retried; credentials and mutations never are. */
export async function waitForService(signal?:AbortSignal):Promise<Features>{
 for(let attempt=0;attempt<6;attempt++){
  signal?.throwIfAborted();
  try{return await api<Features>('/features',{signal});}
  catch(error){
   if(signal?.aborted||attempt===5||error instanceof ApiError&&![408,429,502,503,504].includes(error.status))throw error;
   await new Promise(resolve=>setTimeout(resolve,500));
  }
 }
 throw new Error('The game service is unavailable. Try again.');
}
