import {ApiError} from './api';
import {recoverableRead} from './recoverable-read';
export type Identity={id:string;displayName:string};
export type SessionState={status:'initializing'}|{status:'authenticated';identity:Identity}|{status:'anonymous'|'expired'|'recoverable_failure'};
let pending:Promise<SessionState>|undefined;
/** Deduplicate simultaneous restoration. A transport error never invalidates a session. */
export function restoreSession():Promise<SessionState>{
 if(pending)return pending;
 pending=recoverableRead<Identity|null>('/api/auth/me').then(identity=>identity?{status:'authenticated',identity} as SessionState:{status:'anonymous'} as SessionState).catch(error=>({status:error instanceof ApiError&&error.status===401?'expired':'recoverable_failure'} as SessionState)).finally(()=>{pending=undefined;});
 return pending;
}
