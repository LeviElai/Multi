import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { SqlDatabase, Store } from '../../../packages/db/src/types';

const scrypt = promisify(scryptCallback);
const SESSION_SECONDS = 7 * 24 * 60 * 60;
export type CreatorIdentity = {id:string;displayName:string};
type Account = {id:string;email:string;password_hash:string;display_name:string};

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
        await this.db.query('INSERT INTO auth_accounts (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING',[user.id,email,await hashPassword(password),user.displayName,new Date().toISOString()]);
      }
    }
  }
  async identify(request:Request):Promise<CreatorIdentity|null> {
    const token=readCookie(request,this.cookieName);
    if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
    const result=await this.db.query<{id:string;display_name:string}>(
      'SELECT a.id, a.display_name FROM auth_sessions s JOIN auth_accounts a ON a.id = s.user_id WHERE s.token_digest = ? AND s.expires_at > ?',
      [digestToken(token),new Date().toISOString()]);
    return result.rows[0]?{id:result.rows[0].id,displayName:result.rows[0].display_name}:null;
  }
  private cookie(token:string,maxAge=SESSION_SECONDS) {
    return `${this.cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${this.secure?'; Secure':''}`;
  }
  async handle(request:Request):Promise<Response|null> {
    const path=new URL(request.url).pathname;
    if(path==='/api/auth/me' && request.method==='GET') return Response.json({data:await this.identify(request)});
    if(path==='/api/auth/logout'&&request.method==='POST') {
      const token=readCookie(request,this.cookieName);
      if(token)await this.db.query('DELETE FROM auth_sessions WHERE token_digest = ?',[digestToken(token)]);
      return Response.json({data:{signedOut:true}},{headers:{'Set-Cookie':this.cookie('',0)}});
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
    return Response.json({data:{id:account.id,displayName:account.display_name}},{headers:{'Set-Cookie':this.cookie(token)}});
  }
  async purgeExpired() { await this.db.query('DELETE FROM auth_sessions WHERE expires_at <= ?',[new Date().toISOString()]); }
  private failure(code:string,message:string,status:number){return Response.json({error:{code,message,requestId:randomUUID()}},{status});}
}
