import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { SqlDatabase, Store } from '../../../packages/db/src/types';

const scrypt = promisify(scryptCallback);
const SESSION_SECONDS = 7 * 24 * 60 * 60;
export type CreatorIdentity = {id:string;displayName:string;username:string};
type Account = {id:string;email:string;password_hash:string;display_name:string;username:string};
const USERNAME=/^[a-z][a-z0-9_]{2,23}$/;
const RESERVED=/^(admin|administrator|moderator|support|staff|official|multigame|system|root|help|security|guest|player)$/;
const COMMON=new Set(['password','password1','password123','12345678','123456789','1234567890','qwerty123','qwertyuiop','letmein1','welcome1','iloveyou','admin123','abc12345','football1','monkey123','dragon123','sunshine1','superman1']);
function normalizeUsername(value:unknown){return typeof value==='string'?value.trim().replace(/^@/,'').toLowerCase():'';}
function validPassword(value:string,email:string){return value.length>=8&&value.length<=128&&!COMMON.has(value.toLowerCase())&&!value.toLowerCase().includes(email.split('@')[0].toLowerCase());}

export function digestToken(value:string) { return createHash('sha256').update(value).digest('hex'); }
export function readCookie(request:Request,name:string):string|null {
  const cookies=request.headers.get('cookie')?.split(';')??[];
  const value=cookies.find(part=>part.trim().startsWith(`${name}=`))?.trim().slice(name.length+1);
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return null; }
}
export async function hashPassword(password:string):Promise<string> {
  const salt=randomBytes(24).toString('hex');
  const derived=await scrypt(password,salt,64) as Buffer;
  return `scrypt-v1$${salt}$${derived.toString('hex')}`;
}
export async function verifyPassword(password:string,encoded:string):Promise<boolean> {
  const [version,salt,hex]=encoded.split('$');
  if(version!=='scrypt-v1'||!salt||!hex||hex.length!==128||password.length>1024)return false;
  const derived=await scrypt(password,salt,64) as Buffer;
  const expected=Buffer.from(hex,'hex');
  return derived.length===expected.length && timingSafeEqual(derived,expected);
}

/** Private-alpha credential authentication. No account is ever inferred from request headers. */
export class CreatorAuth {
  private dummyHash='';
  readonly cookieName:string;
  constructor(private store:Store,private db:SqlDatabase,private secure:boolean) {
    this.cookieName=secure?'__Host-mg_host':'mg_host';
  }
  async identifyGuest(request:Request):Promise<{id:string;displayName:string}|null>{
    const token=readCookie(request,this.secure?'__Host-mg_daily_guest':'mg_daily_guest');
    if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
    const result=await this.db.query<{id:string;display_name:string}>('SELECT u.id,u.display_name FROM auth_sessions s JOIN users u ON u.id=s.user_id LEFT JOIN auth_accounts a ON a.id=u.id WHERE s.token_digest=? AND s.expires_at>? AND a.id IS NULL',[digestToken(token),new Date().toISOString()]);
    return result.rows[0]?{id:result.rows[0].id,displayName:result.rows[0].display_name}:null;
  }
  async initialize(environment:NodeJS.ProcessEnv=process.env) {
    this.dummyHash=await hashPassword(randomBytes(32).toString('base64url'));
    const email=environment.AUTH_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const password=environment.AUTH_BOOTSTRAP_PASSWORD;
    if ((email&&!password)||(!email&&password)) throw new Error('Both AUTH_BOOTSTRAP_EMAIL and AUTH_BOOTSTRAP_PASSWORD are required together.');
    if(email&&password) {
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error('Invalid bootstrap email.');
      if(password.length<16||password.length>1024)throw new Error('Bootstrap password must contain 16–1024 characters.');
      const existing=await this.db.query<Account>('SELECT * FROM auth_accounts WHERE email = ?', [email]);
      if(!existing.rows[0]) {
        const user=await this.store.ensureUser(`credential:${email}`,environment.AUTH_BOOTSTRAP_NAME?.slice(0,80)||email.split('@')[0]);
        await this.db.query('INSERT INTO auth_accounts (id, email, password_hash, display_name, username, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING',[user.id,email,await hashPassword(password),user.displayName,`player_${user.id.replaceAll('-','').slice(0,16)}`,new Date().toISOString()]);
      }
    }
  }
  async identify(request:Request):Promise<CreatorIdentity|null> {
    const token=readCookie(request,this.cookieName);
    if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
    const result=await this.db.query<{id:string;display_name:string;username:string}>(
      'SELECT a.id, a.display_name, a.username FROM auth_sessions s JOIN auth_accounts a ON a.id = s.user_id WHERE s.token_digest = ? AND s.expires_at > ?',
      [digestToken(token),new Date().toISOString()]);
    return result.rows[0]?{id:result.rows[0].id,displayName:result.rows[0].display_name,username:result.rows[0].username}:null;
  }
  private cookie(token:string,maxAge=SESSION_SECONDS) {
    return `${this.cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${this.secure?'; Secure':''}`;
  }
  async handle(request:Request):Promise<Response|null> {
    const path=new URL(request.url).pathname;
    if(path==='/api/auth/guest'&&request.method==='POST'){
      const existing=await this.identifyGuest(request);
      if(existing)return Response.json({data:{ready:true}});
      const token=randomBytes(32).toString('base64url'),now=Date.now();
      const guest=await this.store.ensureUser('daily-guest:'+randomUUID(),'Daily guest');
      await this.db.query('INSERT INTO auth_sessions (token_digest,user_id,expires_at,created_at) VALUES (?,?,?,?)',[digestToken(token),guest.id,new Date(now+SESSION_SECONDS*1000).toISOString(),new Date(now).toISOString()]);
      const cookie=`${this.secure?'__Host-mg_daily_guest':'mg_daily_guest'}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${this.secure?'; Secure':''}`;
      return Response.json({data:{ready:true}},{headers:{'Set-Cookie':cookie}});
    }
    if(path==='/api/auth/username'&&request.method==='GET'){
      const username=normalizeUsername(new URL(request.url).searchParams.get('value'));
      if(!USERNAME.test(username)||RESERVED.test(username))return Response.json({data:{available:false}});
      const identity=await this.identify(request);
      const match=await this.db.query<{id:string}>('SELECT id FROM auth_accounts WHERE lower(username) = ?',[username]);
      return Response.json({data:{available:!match.rows.length||match.rows[0].id===identity?.id}});
    }
    if(path==='/api/auth/profile'&&request.method==='GET'){
      const identity=await this.identify(request);
      if(!identity)return this.failure('UNAUTHENTICATED','Sign in to edit your profile.',401);
      const result=await this.db.query<{email:string}>('SELECT email FROM auth_accounts WHERE id=?',[identity.id]);
      return Response.json({data:{...identity,email:result.rows[0]?.email}});
    }
    if(path==='/api/auth/profile'&&request.method==='PATCH'){
      const identity=await this.identify(request);
      if(!identity)return this.failure('UNAUTHENTICATED','Sign in to edit your profile.',401);
      let payload:{displayName?:unknown;username?:unknown};
      try{payload=await request.json() as typeof payload;}catch{return this.failure('INVALID_REQUEST','Check your profile.',400);}
      const displayName=typeof payload.displayName==='string'?payload.displayName.trim():'';
      const username=normalizeUsername(payload.username);
      if(!displayName||displayName.length>60||!USERNAME.test(username)||RESERVED.test(username))return this.failure('INVALID_PROFILE','Use a display name and a username of 3–24 letters, numbers or underscores.',400);
      try {
        await this.db.batch([{sql:'UPDATE auth_accounts SET display_name=?,username=? WHERE id=?',params:[displayName,username,identity.id]},{sql:'UPDATE users SET display_name=? WHERE id=?',params:[displayName,identity.id]}]);
      }catch(error){if(/unique|duplicate/i.test(String(error)))return this.failure('USERNAME_TAKEN','That username is already taken.',409);throw error;}
      return Response.json({data:{id:identity.id,displayName,username}});
    }
    if(path==='/api/auth/password'&&request.method==='POST'){
      const identity=await this.identify(request);
      if(!identity)return this.failure('UNAUTHENTICATED','Sign in to change your password.',401);
      let payload:{currentPassword?:unknown;newPassword?:unknown};
      try{payload=await request.json() as typeof payload;}catch{return this.failure('INVALID_REQUEST','Check your password.',400);}
      const account=(await this.db.query<Account>('SELECT * FROM auth_accounts WHERE id=?',[identity.id])).rows[0];
      if(typeof payload.currentPassword!=='string'||!await verifyPassword(payload.currentPassword,account.password_hash))return this.failure('INVALID_CREDENTIALS','Current password is incorrect.',401);
      if(typeof payload.newPassword!=='string'||!validPassword(payload.newPassword,account.email))return this.failure('WEAK_PASSWORD','Choose 8 or more characters that are not a common password.',400);
      const digest=readCookie(request,this.cookieName);
      await this.db.batch([{sql:'UPDATE auth_accounts SET password_hash=? WHERE id=?',params:[await hashPassword(payload.newPassword),identity.id]},{sql:'DELETE FROM auth_sessions WHERE user_id=? AND token_digest<>?',params:[identity.id,digest?digestToken(digest):'']}]);
      return Response.json({data:{changed:true}});
    }
    if(path==='/api/auth/me' && request.method==='GET') {
      const started=Date.now();
      try {
        const identity=await this.identify(request);
        const state=identity?'authenticated':readCookie(request,this.cookieName)?'expired':'anonymous';
        // Only lifecycle metadata: never log cookies, token digests, names or email addresses.
        console.info(JSON.stringify({event:'session_restored',state,durationMs:Date.now()-started}));
        return state==='expired'?this.failure('SESSION_EXPIRED','Your session has expired. Sign in again.',401):Response.json({data:identity});
      } catch(error) {
        console.warn(JSON.stringify({event:'session_restore_failed',state:'recoverable_failure',durationMs:Date.now()-started,errorType:error instanceof Error?error.name:'UnknownError'}));
        throw error;
      }
    }
    if(path==='/api/auth/logout'&&request.method==='POST') {
      const token=readCookie(request,this.cookieName);
      if(token)await this.db.query('DELETE FROM auth_sessions WHERE token_digest = ?',[digestToken(token)]);
      return Response.json({data:{signedOut:true}},{headers:{'Set-Cookie':this.cookie('',0)}});
    }
    if(path==='/api/auth/register' && request.method==='POST') {
      let payload: {email?:unknown;password?:unknown;displayName?:unknown;username?:unknown};
      try { payload=await request.json() as typeof payload; } catch {return this.failure('INVALID_REQUEST','Check your account details.',400);}
      const email=typeof payload.email==='string'?payload.email.trim().toLowerCase():'';
      const password=typeof payload.password==='string'?payload.password:'';
      const displayName=typeof payload.displayName==='string'?payload.displayName.trim():'';
      const username=normalizeUsername(payload.username);
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!validPassword(password,email)||!displayName||displayName.length>60||!USERNAME.test(username)||RESERVED.test(username))
        return this.failure('INVALID_ACCOUNT','Use a display name, available username, valid email and a password of at least 8 characters.',400);
      const exists=await this.db.query<Account>('SELECT * FROM auth_accounts WHERE email = ?',[email]);
      if(exists.rows[0])return this.failure('ACCOUNT_EXISTS','An account already uses this email. Sign in instead.',409);
      if((await this.db.query('SELECT id FROM auth_accounts WHERE lower(username)=?',[username])).rows.length)return this.failure('USERNAME_TAKEN','That username is already taken.',409);
      const user=await this.store.ensureUser(`credential:${email}`,displayName);
      let result;
      try{result=await this.db.query('INSERT INTO auth_accounts (id, email, password_hash, display_name, username, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING',
        [user.id,email,await hashPassword(password),displayName,username,new Date().toISOString()]);}
      catch(error){if(/unique|duplicate/i.test(String(error)))return this.failure('USERNAME_TAKEN','That username is already taken.',409);throw error;}
      if(!result.changes)return this.failure('ACCOUNT_EXISTS','An account already uses this email. Sign in instead.',409);
      const token=randomBytes(32).toString('base64url');
      const now=Date.now();
      await this.db.query('INSERT INTO auth_sessions (token_digest, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
        [digestToken(token),user.id,new Date(now+SESSION_SECONDS*1000).toISOString(),new Date(now).toISOString()]);
      return Response.json({data:{id:user.id,displayName,username}}, {status:201,headers:{'Set-Cookie':this.cookie(token)}});
    }
    if(path!=='/api/auth/login'||request.method!=='POST')return null;
    let payload:{email?:unknown;password?:unknown};
    try { payload=await request.json() as typeof payload; } catch {return this.failure('INVALID_REQUEST','Invalid credentials.',400);}
    const email=typeof payload.email==='string'?payload.email.trim().toLowerCase():'';
    const password=typeof payload.password==='string'?payload.password:'';
    if(!email||email.length>254||!password||password.length>1024)return this.failure('INVALID_CREDENTIALS','Invalid email or password.',401);
    const result=await this.db.query<Account>('SELECT * FROM auth_accounts WHERE email = ?',[email]);
    const account=result.rows[0];
    const valid=await verifyPassword(password,account?.password_hash??this.dummyHash);
    if(!account||!valid)return this.failure('INVALID_CREDENTIALS','Invalid email or password.',401);
    const token=randomBytes(32).toString('base64url');
    const now=Date.now();
    await this.db.query('INSERT INTO auth_sessions (token_digest, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
      [digestToken(token),account.id,new Date(now+SESSION_SECONDS*1000).toISOString(),new Date(now).toISOString()]);
    return Response.json({data:{id:account.id,displayName:account.display_name,username:account.username}},{headers:{'Set-Cookie':this.cookie(token)}});
  }
  async purgeExpired() { await this.db.query('DELETE FROM auth_sessions WHERE expires_at <= ?',[new Date().toISOString()]); }
  private failure(code:string,message:string,status:number){return Response.json({error:{code,message,requestId:randomUUID()}},{status});}
}
