import { readFile } from 'node:fs/promises';
import { hashPassword } from './auth';
import { createRuntime } from './runtime';

// Operator-only credential rotation. Password is read from a secret file, never
// command-line arguments or terminal output. Sessions are revoked atomically.
if(process.argv[2]!=='rotate')throw new Error('Usage: credentials.ts rotate');
const email=process.env.AUTH_ACCOUNT_EMAIL?.trim().toLowerCase();
const file=process.env.AUTH_PASSWORD_FILE;
if(!email||!file)throw new Error('Set AUTH_ACCOUNT_EMAIL and AUTH_PASSWORD_FILE.');
const password=(await readFile(file,'utf8')).replace(/\r?\n$/,'');
if(password.length<16||password.length>1024)throw new Error('Password must contain 16–1024 characters.');
const {db}=await createRuntime();
try {
  const result=await db.query<{id:string}>('SELECT id FROM auth_accounts WHERE email = ?',[email]);
  if(!result.rows[0])throw new Error('Account not found.');
  await db.batch([
    {sql:'UPDATE auth_accounts SET password_hash = ? WHERE id = ?',params:[await hashPassword(password),result.rows[0].id]},
    {sql:'DELETE FROM auth_sessions WHERE user_id = ?',params:[result.rows[0].id]},
  ]);
  process.stdout.write('Password rotated and existing sessions revoked.\n');
}finally{await db.close();}
