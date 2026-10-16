import test from 'node:test';
import assert from 'node:assert/strict';
import { siteApi } from '../../apps/web/lib/site-api';

test('Vercel proxy removes decoded compression headers, preserves cookies, and strips forged identity', async () => {
  const previous = process.env.GAME_SERVICE_URL;
  const original = globalThis.fetch;
  process.env.GAME_SERVICE_URL = 'https://backend.example.test';
  globalThis.fetch = async (input, options) => {
    assert.equal(String(input), 'https://backend.example.test/api/auth/login');
    const headers = new Headers(options?.headers);
    assert.equal(headers.get('oai-authenticated-user-id'), null);
    assert.equal(headers.get('oai-authenticated-user-email'), null);
    assert.equal(headers.get('cookie'), 'mg_host=test-only');
    assert.equal(headers.get('accept-encoding'), 'identity');
    return new Response('{"data":{"id":"creator"}}', {status:201,headers:{
      'Content-Type':'application/json','Content-Encoding':'br','Content-Length':'12',
      'Set-Cookie':'__Host-mg_host=test-token; Path=/; Secure; HttpOnly; SameSite=Strict',
    }});
  };
  try {
    const response = await siteApi(new Request('https://frontend.example.test/api/auth/login', {method:'POST',body:'{}',headers:{
      Cookie:'mg_host=test-only','oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@example.test',
    }}));
    assert.equal(response.status,201);
    assert.equal(response.headers.get('content-encoding'),null);
    assert.equal(response.headers.get('content-length'),null);
    assert.match(response.headers.get('set-cookie')!,/HttpOnly/);
    assert.deepEqual(await response.json(),{data:{id:'creator'}});
  } finally {
    globalThis.fetch=original;
    if(previous===undefined)delete process.env.GAME_SERVICE_URL;else process.env.GAME_SERVICE_URL=previous;
  }
});
