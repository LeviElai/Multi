import {recordClock} from './server-clock';
import {newId} from '../../../packages/contracts/src/id';
export class ApiError extends Error {status:number;code:string;details:unknown;constructor(message:string,status:number,code:string,details?:unknown){super(message);this.status=status;this.code=code;this.details=details;}}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
 const headers=new Headers(options.headers);headers.set('Accept','application/json');
 if(options.body)headers.set('Content-Type','application/json');
 if(options.method && !['GET','HEAD'].includes(options.method) && !headers.has('Idempotency-Key'))headers.set('Idempotency-Key',newId());
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 const started=performance.now();
 try{const response=await fetch(path.startsWith('/api/')?path:'/api/v1'+path,{...options,headers,credentials:'same-origin',cache:'no-store',signal:options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal});
 const result=await response.json().catch(()=>({error:{code:'UNAVAILABLE',message:'The game service could not be reached. Please try again.'}})) as {data?:unknown;error?:{code?:string;message?:string;details?:unknown}};
 if(!response.ok)throw new ApiError(result?.error?.message??'Something went wrong.',response.status,result?.error?.code??'UNKNOWN',result?.error?.details);
 if(!result||typeof result!=='object'||!Object.hasOwn(result,'data')||result.error)throw new ApiError('The server returned an incomplete response. Please try again.',502,'INVALID_RESPONSE');
 recordClock(result.data,Date.now(),performance.now()-started);
 return result.data as T;
 }catch(e){if(e instanceof DOMException && e.name==='AbortError')throw new ApiError('The connection took too long. Your last acknowledged answer is safe.',408,'TIMEOUT');throw e;}finally{clearTimeout(timeout);}
}
export const post=<T,>(path:string,body:unknown)=>api<T>(path,{method:'POST',body:JSON.stringify(body)});
