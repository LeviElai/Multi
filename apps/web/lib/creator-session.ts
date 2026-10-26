import {api,ApiError} from './api';
export function creatorDestination(value:string|null):string{
 if(!value||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020]/.test(value))return '/create';
 const path=value.split(/[?#]/)[0];
 // Auth endpoints and the login screen must never be their own return target.
 return /^\/(create|library|quiz|host|account|daily)(\/|$)/.test(path)?value:'/create';
}
export async function signInCreator(register:boolean,credentials:{email:string;password:string;displayName:string}){
 const result=await api<{id:string}>('/api/auth/'+(register?'register':'login'),{method:'POST',body:JSON.stringify(credentials)});
 const session=await api<{id:string}|null>('/api/auth/me');
 if(!session||typeof result?.id!=='string'||!result.id||session.id!==result.id)throw new ApiError('Sign-in did not persist in this browser. Allow cookies for this site, then try again.',401,'SESSION_NOT_SAVED');
 return session;
}
