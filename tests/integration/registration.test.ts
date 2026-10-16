import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CreatorAuth } from '../../apps/game-service/src/auth';
import { NodeSqliteDatabase } from '../../packages/db/src/sqlite';
import { SqlStore } from '../../packages/db/src/store';

test('creator registration validates passwords, signs in, prevents duplicates and isolates identities', async t => {
  const db = new NodeSqliteDatabase(':memory:');
  t.after(() => db.close());
  await db.migrate(await readFile(new URL('../../packages/db/migrations/sqlite/0001_initial.sql', import.meta.url), 'utf8'));
  const auth = new CreatorAuth(new SqlStore(db), db, false);
  await auth.initialize({ NODE_ENV: 'test' });
  const request = (route: string, payload: unknown, cookie = '') => new Request('http://localhost/api/auth/' + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(payload),
  });
  const account = { email: 'creator@example.test', password: 'long-test-password-123', displayName: 'Luna' };
  assert.equal((await auth.handle(request('register', {...account, password:'short'})))?.status, 400);
  const created = (await auth.handle(request('register', account)))!;
  assert.equal(created.status, 201);
  const cookie = created.headers.get('set-cookie')!.split(';')[0];
  assert.match(created.headers.get('set-cookie')!, /HttpOnly/);
  const identity = await auth.identify(new Request('http://localhost', {headers:{Cookie:cookie}}));
  assert.equal(identity?.displayName, 'Luna');
  assert.equal((await auth.handle(request('register', account)))?.status, 409);
  assert.equal((await auth.handle(request('login', {...account, password:'incorrect'})))?.status, 401);
  const login = (await auth.handle(request('login', {...account, email:'CREATOR@example.test'})))!;
  assert.equal(login.status, 200);
  const other = (await auth.handle(request('register', {...account, email:'other@example.test'})))!;
  assert.notEqual(((await other.json()) as {data:{id:string}}).data.id, identity!.id);
  await auth.handle(request('logout', {}, cookie));
  assert.equal(await auth.identify(new Request('http://localhost', {headers:{Cookie:cookie}})), null);
});
