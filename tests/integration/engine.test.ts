import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeSqliteDatabase } from '../../packages/db/src/sqlite';
import { SqlStore } from '../../packages/db/src/store';
import { getDemoQuiz, getDefaultRound } from '../../packages/game-modes/src/index';
import { DomainError, type HostAction, type Principal, type QuizInput } from '../../packages/contracts/src/index';
import { GameEngine } from '../../apps/game-service/src/engine';
import { handleApi } from '../../apps/game-service/src/api';
import { digestToken } from '../../apps/game-service/src/security';

const PIN_SECRET = 'integration-test-only-pin-key-32-bytes';
const key = () => crypto.randomUUID();
const isCode = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code;
async function fixture(t: { after: (fn: () => Promise<void>) => void }, input: QuizInput = getDemoQuiz(), players = 2) {
  const directory = await mkdtemp(join(tmpdir(), 'multigame-engine-'));
  const path = join(directory, 'game.sqlite');
  let db = new NodeSqliteDatabase(path);
  await db.migrate(await readFile(new URL('../../drizzle/0000_initial.sql', import.meta.url), 'utf8'));
  let now = Date.now();
  let store = new SqlStore(db, () => new Date(now));
  const host = await store.ensureUser('host-test', 'Host');
  const quiz = await store.createQuiz(host.id, input);
  const version = await store.publishQuiz(quiz.id, host.id, quiz.revision);
  let engine = new GameEngine(store, () => now, { pinSecret: PIN_SECRET });
  const room = await engine.createSession(host.id, version.id, key());
  const members: { principal: Principal; token: string }[] = [];
  for (let i = 0; i < players; i++) {
    const joined = await engine.join(room.pin, `Player ${i + 1}`);
    members.push({ principal: { role: 'player', id: joined.participantId, sessionId: room.sessionId }, token: joined.token });
    now += 1;
  }
  const hostPrincipal: Principal = { role: 'host', id: host.id };
  async function action(action: HostAction['action'], args?: HostAction['args']) {
    const data = await store.getSession(room.sessionId);
    return engine.hostAction(host.id, room.sessionId, { action, expectedStateVersion: data.session.stateVersion, args }, key());
  }
  async function active() {
    now += 5000;
    await engine.reconcile(room.sessionId);
    assert.equal((await store.getSession(room.sessionId)).session.state, 'ROUND_ACTIVE');
  }
  t.after(async () => { db.close(); await rm(directory, { recursive: true, force: true }); });
  return {
    get db() { return db; }, get store() { return store; }, get engine() { return engine; }, host, hostPrincipal, quiz, version, room, members, action, active,
    advance(ms: number) { now += ms; },
    async restart() { db.close(); db = new NodeSqliteDatabase(path); store = new SqlStore(db, () => new Date(now)); engine = new GameEngine(store, () => now, { pinSecret: PIN_SECRET }); },
  };
}

// AT-01,03,05,06,14,22: the complete five-mode path uses actual SQL, not mocks.
test('ten players finish five modes with immutable scores, private projections, replay receipts and process-state recovery', async t => {
  const f = await fixture(t, getDemoQuiz(), 10);
  const display = await f.engine.pairDisplay(f.host.id, f.room.sessionId);
  const displayPrincipal = await f.store.findDisplay(await digestToken(display.token));
  assert.ok(displayPrincipal);
  await f.action('START'); await f.active();
  let firstAck;
  for (let roundIndex = 0; roundIndex < 5; roundIndex++) {
    const round = f.version.rounds[roundIndex];
    const publicState = await f.engine.snapshot(displayPrincipal, f.room.sessionId);
    assert.equal(publicState.round?.id, round.id);
    assert.equal(publicState.pin, undefined);
    assert.equal(publicState.reveal, undefined);
    assert.equal(JSON.stringify(publicState).includes('secretConfig'), false);
    const payload = round.mode === 'fermi' ? { value: 144 } : round.mode === 'rare_answers' ? { text: ['Coral', 'Mint', 'Lilac', 'Lemon', 'Sky'][0] } : round.mode === 'size_it_up' ? { ratio: 2.4 } : { count: 56, locked: true };
    for (let i = 0; i < f.members.length; i++) {
      if (round.mode === 'word_puzzle') {
        await f.engine.wordGuess(f.members[i].principal, f.room.sessionId, { roundId: round.id, clientMutationId: key(), guess: 'ORBIT' });
      } else {
        const input = { roundId: round.id, clientMutationId: key(), revision: 1, payload };
        const ack = await f.engine.submit(f.members[i].principal, f.room.sessionId, input);
        if (!roundIndex && !i) {
          firstAck = ack;
          const duplicates = await Promise.all(Array.from({ length: 50 }, () => f.engine.submit(f.members[i].principal, f.room.sessionId, input)));
          assert.ok(duplicates.every((item) => JSON.stringify(item) === JSON.stringify(ack)));
        }
      }
    }
    const privateState = await f.engine.snapshot(f.members[0].principal, f.room.sessionId);
    assert.equal(privateState.ownAttempts.length, round.mode === 'word_puzzle' ? 1 : 0);
    assert.equal(privateState.answerCount, 10);
    assert.equal(privateState.leaderboard[0].roundPoints, 0, 'unrevealed score is hidden');
    const previousTotal = privateState.leaderboard[0].points;
    await f.action('LOCK');
    if (roundIndex === 2) await f.restart();
    await f.engine.reconcile(f.room.sessionId);
    assert.equal((await f.store.getSession(f.room.sessionId)).session.state, 'ROUND_SCORED');
    assert.equal((await f.engine.snapshot(f.members[0].principal, f.room.sessionId)).leaderboard[0].points, previousTotal);
    await f.action('REVEAL');
    const revealed = await f.engine.snapshot(f.members[0].principal, f.room.sessionId);
    assert.ok(revealed.reveal);
    assert.equal(revealed.leaderboard[0].roundPoints, round.mode === 'rare_answers' ? 0 : 1000);
    const events = await f.store.events(f.room.sessionId, 0);
    assert.equal(JSON.stringify(events).includes('secretConfig'), false);
    assert.equal(JSON.stringify(events).includes('ORBIT'), false);
    const seq = events.map(event => event.seq);
    assert.equal(new Set(seq).size, seq.length);
    await f.action('NEXT');
    if (roundIndex < 4) await f.active(); else { f.advance(900); await f.engine.reconcile(); }
  }
  const final = await f.engine.snapshot(f.hostPrincipal, f.room.sessionId);
  assert.equal(final.state, 'SESSION_COMPLETED');
  assert.equal(final.leaderboard.length, 10);
  assert.ok(final.leaderboard.every(row => row.points === 4000 && row.rank === 1));
  assert.deepEqual(final.leaderboard.map(row => row.participantId), f.members.map(member => member.principal.id));
  assert.equal(Number((await f.db.query<{ n: number }>('SELECT COUNT(*) AS n FROM scoring_runs')).rows[0].n), 5);
  assert.equal(Number((await f.db.query<{ n: number }>('SELECT COUNT(*) AS n FROM round_scores')).rows[0].n), 50);
  assert.ok(firstAck);
  await f.engine.reconcile();
  assert.deepEqual((await f.engine.snapshot(f.hostPrincipal, f.room.sessionId)).leaderboard, final.leaderboard);
});

test('absolute deadline, pause, bounded extension, stale revisions and explicit lock are authoritative', async t => {
  const input = getDemoQuiz(); input.rounds = [getDefaultRound('amountle')];
  const f = await fixture(t, input); await f.action('START'); await f.active();
  const roundId = f.version.rounds[0].id; const principal = f.members[0].principal;
  const packet = { roundId, clientMutationId: key(), revision: 8, payload: { count: 56 } };
  await f.engine.submit(principal, f.room.sessionId, packet);
  await assert.rejects(f.engine.submit(principal, f.room.sessionId, { ...packet, clientMutationId: key(), revision: 7, payload: { count: 54 } }), isCode('STALE_SUBMISSION'));
  await f.action('PAUSE');
  await assert.rejects(f.engine.submit(principal, f.room.sessionId, { ...packet, clientMutationId: key(), revision: 9 }), isCode('ROUND_NOT_ACTIVE'));
  f.advance(600000); await f.action('RESUME');
  for (let i = 0; i < 3; i++) await f.action('EXTEND', { seconds: 1 });
  await assert.rejects(f.action('EXTEND', { seconds: 1 }), isCode('EXTENSION_LIMIT'));
  await f.engine.submit(principal, f.room.sessionId, { ...packet, clientMutationId: key(), revision: 10, payload: { count: 56, locked: true } });
  await assert.rejects(f.engine.submit(principal, f.room.sessionId, { ...packet, clientMutationId: key(), revision: 11 }), isCode('ANSWER_LOCKED'));
  f.advance(1000000);
  await assert.rejects(f.engine.submit(f.members[1].principal, f.room.sessionId, { ...packet, clientMutationId: key(), revision: 1 }), isCode('ANSWER_LATE'));
  const original = await f.engine.submit(principal, f.room.sessionId, packet);
  assert.equal(original.serverRevision, 8, 'retry gets its original receipt even after newer revisions/deadline');
  await f.restart(); await f.engine.reconcile(); await f.action('REVEAL');
  const snapshot = await f.engine.snapshot(principal, f.room.sessionId);
  assert.equal(snapshot.ownSubmission?.payload.count, 56);
  assert.equal(snapshot.ownPoints, 1000);
});

test('rare unknowns remain private and unresolved across restart, then alias decisions recompute all frequencies', async t => {
  const input = getDemoQuiz(); const round = getDefaultRound('rare_answers');
  if (round.mode !== 'rare_answers') throw new Error('fixture');
  round.publicConfig.adjudication = 'host_review';
  round.secretConfig.answers = [{ canonical: 'United Kingdom', aliases: ['UK'] }, { canonical: 'United States', aliases: ['USA'] }];
  input.rounds = [round];
  const f = await fixture(t, input, 3); await f.action('START'); await f.active();
  for (let i = 0; i < 3; i++) await f.engine.submit(f.members[i].principal, f.room.sessionId, { roundId: round.id, clientMutationId: key(), revision: 1, payload: { text: ['UK', 'England', 'USA'][i] } });
  await f.action('LOCK'); await f.engine.reconcile();
  assert.equal((await f.engine.snapshot(f.hostPrincipal, f.room.sessionId)).review?.[0].text, 'England');
  const player = await f.engine.snapshot(f.members[0].principal, f.room.sessionId);
  assert.equal(player.review, undefined); assert.equal(player.reveal, undefined);
  assert.equal(JSON.stringify(player).includes('England'), false);
  await assert.rejects(f.action('REVEAL'), isCode('INVALID_TRANSITION'));
  await f.restart();
  const hostSnapshot = await f.engine.snapshot(f.hostPrincipal, f.room.sessionId);
  assert.equal(hostSnapshot.state, 'REVIEW_REQUIRED');
  await f.engine.review(f.host.id, f.room.sessionId, { roundId: round.id, answerKey: hostSnapshot.review![0].answerKey, decision: 'accept', canonical: 'United Kingdom', expectedStateVersion: hostSnapshot.stateVersion }, key());
  await f.action('REVEAL');
  const result = await f.engine.snapshot(f.members[0].principal, f.room.sessionId);
  assert.equal(result.leaderboard.find(row => row.participantId === f.members[0].principal.id)?.roundPoints, 500);
  assert.equal(result.leaderboard.find(row => row.participantId === f.members[1].principal.id)?.roundPoints, 500);
  assert.equal(result.leaderboard.find(row => row.participantId === f.members[2].principal.id)?.roundPoints, 1000);
});

test('word duplicate IDs/words and racing final attempts never exceed a durable attempt budget', async t => {
  const input = getDemoQuiz(); const round = getDefaultRound('word_puzzle'); if (round.mode !== 'word_puzzle') throw new Error('fixture');
  round.publicConfig.maxAttempts = 3; input.rounds = [round];
  const f = await fixture(t, input); await f.action('START'); await f.active();
  const player = f.members[0].principal;
  const guess = { roundId: round.id, clientMutationId: key(), guess: 'ROBOT' };
  const ack = await f.engine.wordGuess(player, f.room.sessionId, guess);
  assert.deepEqual(await f.engine.wordGuess(player, f.room.sessionId, guess), ack);
  assert.deepEqual(ack.feedback, ['present', 'present', 'exact', 'absent', 'exact']);
  await assert.rejects(f.engine.wordGuess(player, f.room.sessionId, { ...guess, clientMutationId: key() }), isCode('DUPLICATE_GUESS'));
  const results = await Promise.allSettled(['APPLE', 'PEARS', 'BREAD'].map(word => f.engine.wordGuess(player, f.room.sessionId, { ...guess, clientMutationId: key(), guess: word })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 2);
  assert.equal((await f.engine.snapshot(player, f.room.sessionId)).ownAttempts.length, 3);
  await assert.rejects(f.engine.wordGuess(player, f.room.sessionId, { ...guess, clientMutationId: key(), guess: 'ORBIT' }), isCode('ATTEMPTS_EXHAUSTED'));
});

test('skipping a scored unrevealed round creates a new zero revision without erasing prior ledger history', async t => {
  const input = getDemoQuiz(); input.rounds = input.rounds.slice(0, 1);
  const f = await fixture(t, input); await f.action('START'); await f.active();
  await f.engine.submit(f.members[0].principal, f.room.sessionId, { roundId: input.rounds[0].id, clientMutationId: key(), revision: 1, payload: { value: 144 } });
  await f.action('LOCK'); await f.engine.reconcile();
  await f.action('SKIP');
  const result = await f.engine.snapshot(f.members[0].principal, f.room.sessionId);
  assert.equal(result.reveal?.skipped, true); assert.equal(result.ownPoints, 0);
  const runs = await f.db.query<{ scoring_revision: number }>('SELECT scoring_revision FROM scoring_runs ORDER BY scoring_revision');
  assert.deepEqual(runs.rows.map(row => row.scoring_revision), [1, 2]);
});

test('HTTP enforces CSRF, creator identity, player scoping, revoked displays and private quiz ownership', async t => {
  const f = await fixture(t); const other = await f.store.ensureUser('other-host', 'Other');
  const base = 'https://game.example/api/v1';
  const context = { store: f.store, user: f.host, pinSecret: PIN_SECRET, cookieSecure: true, clientIp: '192.0.2.1' };
  const cookie = `mg_player_${f.room.sessionId}=${f.members[0].token}`;
  const request = (path: string, method = 'GET', body?: object, extra: Record<string, string> = {}) => new Request(`${base}/${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json', Origin: 'https://game.example', 'Idempotency-Key': key() } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await handleApi(request(`quizzes/${f.quiz.id}`), { ...context, user: null })).status, 401);
  assert.equal((await handleApi(request(`quizzes/${f.quiz.id}`), { ...context, user: other })).status, 404);
  const actionBody = { action: 'START', expectedStateVersion: (await f.store.getSession(f.room.sessionId)).session.stateVersion };
  assert.equal((await handleApi(request(`sessions/${f.room.sessionId}/host-actions`, 'POST', actionBody, { Cookie: cookie }), { ...context, user: null })).status, 403);
  assert.equal((await handleApi(request(`sessions/${f.room.sessionId}/host-actions`, 'POST', actionBody, { Origin: 'https://attacker.example' }), context)).status, 403);
  const forged = await handleApi(request(`quizzes/${f.quiz.id}`, 'GET', undefined, { 'X-User-Id': f.host.id, 'X-Role': 'host' }), { ...context, user: null });
  assert.equal(forged.status, 401);
  const ownPlayer = await handleApi(request(`sessions/${f.room.sessionId}/snapshot?role=player`, 'GET', undefined, { Cookie: cookie }), context);
  const projected = await ownPlayer.json() as { data: { role: string; pin?: string } };
  assert.equal(projected.data.role, 'player'); assert.equal(projected.data.pin, undefined);
  const display = await f.engine.pairDisplay(f.host.id, f.room.sessionId);
  assert.equal((await handleApi(request(`display/${display.token}/snapshot`), { ...context, user: null })).status, 200);
  await f.engine.revokeDisplays(f.host.id, f.room.sessionId);
  assert.equal((await handleApi(request(`display/${display.token}/snapshot`), { ...context, user: null })).status, 401);
  await f.action('KICK', { participantId: f.members[0].principal.id });
  assert.equal((await handleApi(request(`sessions/${f.room.sessionId}/snapshot?role=player`, 'GET', undefined, { Cookie: cookie }), context)).status, 401);
});

test('API quiz publication and session creation are durable-idempotent and published content is immutable', async t => {
  const f = await fixture(t); const context = { store: f.store, user: f.host, pinSecret: PIN_SECRET, clientIp: '192.0.2.2' };
  const request = (path: string, body: unknown, actionKey: string) => new Request(`https://game.example/api/v1/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://game.example', 'Idempotency-Key': actionKey }, body: JSON.stringify(body) });
  const input = getDemoQuiz(); const creationKey = key();
  const response = await handleApi(request('quizzes', input, creationKey), context); assert.equal(response.status, 201);
  const created = (await response.json() as { data: { id: string; revision: number } }).data;
  assert.deepEqual((await (await handleApi(request('quizzes', input, creationKey), context)).json() as { data: unknown }).data, created);
  const publishKey = key(); const publishBody = { expectedRevision: created.revision };
  const publishedResponse = await handleApi(request(`quizzes/${created.id}/publish`, publishBody, publishKey), context); assert.equal(publishedResponse.status, 201);
  const published = (await publishedResponse.json() as { data: { id: string } }).data;
  const repeated = await handleApi(request(`quizzes/${created.id}/publish`, publishBody, publishKey), context);
  assert.equal(repeated.status, 201); assert.deepEqual((await repeated.json() as { data: unknown }).data, published);
  const sessionKey = key();
  const createdRoom = (await (await handleApi(request('sessions', { quizVersionId: published.id }, sessionKey), context)).json() as { data: { sessionId: string } }).data;
  assert.deepEqual((await (await handleApi(request('sessions', { quizVersionId: published.id }, sessionKey), context)).json() as { data: unknown }).data, createdRoom);
  const currentDraft = await f.store.getQuiz(created.id, f.host.id);
  await f.store.saveQuiz(created.id, f.host.id, currentDraft.revision, { ...input, title: 'Later changes' });
  assert.equal((await f.store.getSession(createdRoom.sessionId)).quiz.title, input.title);
});

test('concurrent creation returns one room and its committed PIN; concurrent players cannot exceed capacity', async t => {
  const f = await fixture(t, getDemoQuiz(), 0);
  const actionKey = key();
  const creates = await Promise.all(Array.from({ length: 8 }, () => f.engine.createSession(f.host.id, f.version.id, actionKey)));
  assert.ok(creates.every(room => room.sessionId === creates[0].sessionId && room.pin === creates[0].pin));
  // Small waves avoid making machine-local lock contention look like a network load test.
  const joins = [];
  for (let wave = 0; wave < 6; wave++) joins.push(...await Promise.allSettled(Array.from({ length: 5 }, (_, index) => f.engine.join(creates[0].pin, `Guest ${wave * 5 + index}`))));
  assert.equal(joins.filter(result => result.status === 'fulfilled').length, 25);
  assert.equal((await f.store.getSession(creates[0].sessionId)).members.length, 25);
  assert.ok(joins.filter(result => result.status === 'rejected').every(result => result.reason instanceof DomainError && result.reason.code === 'ROOM_FULL'));
});

test('simultaneous distinct participant answers retry CAS safely and produce one accepted revision each', async t => {
  const input = getDemoQuiz(); input.rounds = [input.rounds[0]];
  const f = await fixture(t, input, 25); await f.action('START'); await f.active();
  const responses = await Promise.all(f.members.map(member => f.engine.submit(member.principal, f.room.sessionId, { roundId: input.rounds[0].id, clientMutationId: key(), revision: 1, payload: { value: 144 } })));
  assert.ok(responses.every(response => response.accepted));
  assert.equal((await f.store.getSession(f.room.sessionId)).submissions.length, 25);
});

test('malformed bodies, oversized input, publishing errors and replay conflicts fail without partial mutations', async t => {
  const f = await fixture(t); const context = { store: f.store, user: f.host, pinSecret: PIN_SECRET, clientIp: '192.0.2.3' };
  const url = 'https://game.example/api/v1/quizzes';
  const headers = { Origin: 'https://game.example', 'Content-Type': 'application/json', 'Idempotency-Key': key() };
  assert.equal((await handleApi(new Request(url, { method: 'POST', headers, body: '{broken' }), context)).status, 400);
  assert.equal((await handleApi(new Request(url, { method: 'POST', headers: { Origin: 'https://game.example' }, body: '{}' }), context)).status, 400);
  assert.equal((await handleApi(new Request(url, { method: 'POST', headers, body: JSON.stringify({ title: 'x'.repeat(270000) }) }), context)).status, 413);
  const input = getDemoQuiz(); input.rounds = [getDefaultRound('fermi')];
  if (input.rounds[0].mode !== 'fermi') throw new Error('fixture');
  input.rounds[0].secretConfig.answer = 0;
  const invalidQuiz = await f.store.createQuiz(f.host.id, input);
  const publish = await handleApi(new Request(`${url}/${invalidQuiz.id}/publish`, { method: 'POST', headers, body: JSON.stringify({ expectedRevision: invalidQuiz.revision }) }), context);
  assert.equal(publish.status, 422);
  const unchanged = await f.store.getQuiz(invalidQuiz.id, f.host.id);
  assert.equal(unchanged.publishedVersionId, undefined); assert.equal(unchanged.revision, 1);
  const actionKey = key(); const create = (title: string) => new Request(url, { method: 'POST', headers: { ...headers, 'Idempotency-Key': actionKey }, body: JSON.stringify({ title, rounds: [] }) });
  assert.equal((await handleApi(create('First title'), context)).status, 201);
  assert.equal((await handleApi(create('Different title'), context)).status, 409);
  assert.equal((await f.store.listQuizzes(f.host.id)).filter(quiz => quiz.title === 'Different title').length, 0);
  await assert.rejects(f.engine.join(f.room.pin, '<img src=x>'), isCode('INVALID_NICKNAME'));
  await f.action('START'); await f.active();
  const roundId = f.version.rounds[0].id;
  const base = { roundId, clientMutationId: key(), revision: 1 };
  await assert.rejects(f.engine.submit(f.members[0].principal, f.room.sessionId, { ...base, payload: { value: Number.POSITIVE_INFINITY } }));
  await assert.rejects(f.engine.submit(f.members[0].principal, f.room.sessionId, { ...base, payload: { value: 144, secretConfig: { answer: 999 } } }));
  await assert.rejects(f.engine.submit(f.members[0].principal, f.room.sessionId, { ...base, roundId: key(), payload: { value: 144 } }), isCode('ROUND_CHANGED'));
  assert.equal((await f.store.getSession(f.room.sessionId)).submissions.length, 0);
});

test('host state conflicts do not commit, but an identical action retry returns its durable receipt', async t => {
  const f = await fixture(t); const before = await f.store.getSession(f.room.sessionId);
  const action = { action: 'START' as const, expectedStateVersion: before.session.stateVersion };
  const actionKey = key();
  const ack = await f.engine.hostAction(f.host.id, f.room.sessionId, action, actionKey);
  assert.deepEqual(await f.engine.hostAction(f.host.id, f.room.sessionId, action, actionKey), ack);
  await assert.rejects(f.engine.hostAction(f.host.id, f.room.sessionId, { action: 'LOCK_JOIN', expectedStateVersion: before.session.stateVersion }, key()), isCode('VERSION_CONFLICT'));
  const after = await f.store.getSession(f.room.sessionId);
  assert.equal(after.session.stateVersion, before.session.stateVersion + 1);
  assert.equal(after.session.joinLocked, false);
});

test('working-version routes validate ownership, ordering and immutable publications through the HTTP controller', async t => {
  const f = await fixture(t); const context = { store: f.store, user: f.host, pinSecret: PIN_SECRET, clientIp: '192.0.2.4' };
  async function request(path: string, method = 'POST', body: object = {}) {
    const response = await handleApi(new Request(`https://game.example/api/v1/${path}`, { method, headers: { Origin: 'https://game.example', 'Content-Type': 'application/json', 'Idempotency-Key': key() }, ...(method === 'DELETE' ? {} : { body: JSON.stringify(body) }) }), context);
    return { status: response.status, json: await response.json() as { data: { id: string; revision: number; versionId: string; rounds: { id: string }[]; valid: boolean }; error?: { code: string } } };
  }
  const created = await request(`quizzes/${f.quiz.id}/versions`); assert.equal(created.status, 201); assert.equal(created.json.data.versionId, f.quiz.id);
  const newRound = getDefaultRound('fermi');
  const appended = await request(`versions/${f.quiz.id}/rounds`, 'POST', { round: newRound, expectedRevision: created.json.data.revision }); assert.equal(appended.status, 201);
  const wrongOrder = await request(`versions/${f.quiz.id}/reorder`, 'POST', { roundIds: [newRound.id] }); assert.equal(wrongOrder.status, 422);
  const quiz = await f.store.getQuiz(f.quiz.id, f.host.id);
  const order = quiz.rounds.map(round => round.id).reverse();
  const reordered = await request(`versions/${f.quiz.id}/reorder`, 'POST', { roundIds: order, expectedRevision: quiz.revision });
  assert.equal(reordered.status, 200); assert.deepEqual(reordered.json.data.rounds.map(round => round.id), order);
  const edited = await request(`rounds/${newRound.id}`, 'PATCH', { quizId: quiz.id, round: { ...newRound, timerSeconds: 60 }, expectedRevision: reordered.json.data.revision }); assert.equal(edited.status, 200);
  const validated = await request(`versions/${f.quiz.id}/validate`); assert.equal(validated.json.data.valid, true);
  const published = await request(`versions/${f.quiz.id}/publish`, 'POST', { expectedRevision: edited.json.data.revision }); assert.equal(published.status, 201);
  assert.equal((await request(`versions/${published.json.data.id}/rounds`, 'POST', { round: getDefaultRound('fermi') })).status, 409);
  assert.equal((await f.store.getVersion(f.version.id, f.host.id)).rounds.length, 5, 'old publication is unchanged');
  const current = await f.store.getQuiz(f.quiz.id, f.host.id);
  assert.equal((await request(`rounds/${newRound.id}?quizId=${f.quiz.id}&expectedRevision=${current.revision}`, 'DELETE')).status, 200);
  assert.equal((await f.store.getQuiz(f.quiz.id, f.host.id)).rounds.length, 5);
});

test('join returns only an HttpOnly scoped cookie, reports and verified privacy requests persist, and brute force is bounded', async t => {
  const f = await fixture(t); const context = { store: f.store, user: null, pinSecret: PIN_SECRET, cookieSecure: true, clientIp: '192.0.2.5' };
  const request = (path: string, body: object) => new Request(`https://game.example/api/v1/${path}`, { method: 'POST', headers: { Origin: 'https://game.example', 'Content-Type': 'application/json', 'Idempotency-Key': key() }, body: JSON.stringify(body) });
  const joinResponse = await handleApi(request('sessions/join', { pin: f.room.pin, nickname: 'Guest' }), context);
  assert.equal(joinResponse.status, 201);
  const cookie = joinResponse.headers.get('set-cookie'); assert.ok(cookie); assert.ok(cookie.includes('HttpOnly')); assert.ok(cookie.includes('Secure')); assert.ok(cookie.includes('SameSite=Lax'));
  const joined = await joinResponse.json() as { data: { token?: string; participantId: string } }; assert.equal(joined.data.token, undefined);
  const stored = await f.db.query<{ token_digest: string }>('SELECT token_digest FROM participants WHERE id = ?', [joined.data.participantId]);
  assert.equal(cookie.includes(stored.rows[0].token_digest), false);
  const reportResponse = await handleApi(request('reports', { category: 'bug', context: 'A sample report from the integration suite.' }), context); assert.equal(reportResponse.status, 201);
  assert.equal(Number((await f.db.query<{ n: number }>('SELECT COUNT(*) AS n FROM abuse_reports')).rows[0].n), 1);
  assert.equal((await handleApi(request('privacy/requests', { type: 'delete' }), context)).status, 401);
  const privacyResponse = await handleApi(request('privacy/requests', { type: 'export' }), { ...context, user: f.host }); assert.equal(privacyResponse.status, 201);
  assert.equal(Number((await f.db.query<{ n: number }>('SELECT COUNT(*) AS n FROM privacy_requests')).rows[0].n), 1);
  const unknownPin = f.room.pin === '000000' ? '000001' : '000000';
  for (let i = 0; i < 20; i++) assert.equal((await handleApi(request('sessions/join', { pin: unknownPin, nickname: 'Guest' }), context)).status, 404);
  const throttled = await handleApi(request('sessions/join', { pin: unknownPin, nickname: 'Guest' }), context);
  assert.equal(throttled.status, 429); assert.ok(Number(throttled.headers.get('retry-after')) > 0);
});

test('generated API contracts include all five strict mode inputs and omit secret fields in PublicRound', async () => {
  const spec = JSON.parse(await readFile(new URL('../../docs/api/openapi.json', import.meta.url), 'utf8'));
  assert.equal(spec.openapi, '3.1.0');
  assert.equal(spec.components.schemas.Round.oneOf.length, 5);
  for (const schema of spec.components.schemas.PublicRound.oneOf) {
    assert.equal(schema.properties.secretConfig, undefined);
    assert.equal(schema.properties.sourceUrl, undefined);
    assert.equal(schema.additionalProperties, false);
  }
  assert.equal(spec.components.schemas.SubmissionInput.properties.payload.additionalProperties, false);
  assert.ok(spec.paths['/sessions/{id}/rare-review'].post);
  assert.ok(spec.paths['/sessions/{id}/word-guesses'].post);
  assert.ok(spec.paths['/privacy/requests'].post);
});

test('twenty-five valid guests sharing a party Wi-Fi can join without consuming the failed-PIN budget', async t => {
  const f = await fixture(t, getDemoQuiz(), 0);
  const context = { store: f.store, user: null, pinSecret: PIN_SECRET, clientIp: '192.0.2.99' };
  for (let i = 0; i < 25; i++) {
    const response = await handleApi(new Request('https://game.example/api/v1/sessions/join', { method: 'POST', headers: { Origin: 'https://game.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: f.room.pin, nickname: `Guest ${i + 1}` }) }), context);
    assert.equal(response.status, 201);
  }
  assert.equal((await f.store.getSession(f.room.sessionId)).members.length, 25);
  assert.equal(Number((await f.db.query<{ n: number }>("SELECT COUNT(*) AS n FROM rate_limits WHERE key LIKE 'pin-failures:%'")).rows[0].n), 0);
});

test('moderation cannot retroactively change a revealed rarity calculation or hide previously revealed totals when ending', async t => {
  const input = getDemoQuiz(); input.rounds = [getDefaultRound('rare_answers')];
  const f = await fixture(t, input, 3); await f.action('START'); await f.active();
  const roundId = input.rounds[0].id;
  for (let i = 0; i < 3; i++) await f.engine.submit(f.members[i].principal, f.room.sessionId, { roundId, clientMutationId: key(), revision: 1, payload: { text: ['Coral', 'Coral', 'Mint'][i] } });
  await f.action('LOCK'); await f.engine.reconcile();
  await f.action('KICK', { participantId: f.members[1].principal.id, reason: 'Host moderation.' });
  await f.action('REVEAL');
  const shown = await f.engine.snapshot(f.members[0].principal, f.room.sessionId);
  assert.equal(shown.ownPoints, 500);
  assert.equal(shown.reveal?.groups?.find(group => group.answer.toLowerCase() === 'coral')?.points, 500);
  assert.equal(shown.reveal?.groups?.find(group => group.answer.toLowerCase() === 'coral')?.count, 2);
  await f.action('END', { reason: 'Party ended after the reveal.' });
  const ended = await f.engine.snapshot(f.members[0].principal, f.room.sessionId);
  assert.equal(ended.ownPoints, 500); assert.equal(ended.reveal?.groups?.[0].points, shown.reveal?.groups?.[0].points);
  const audit = await f.db.query<{ detail: string }>("SELECT detail FROM audit_logs WHERE session_id=? AND action='host.end'", [f.room.sessionId]);
  assert.equal(JSON.parse(audit.rows[0].detail).reason, 'Party ended after the reveal.');
});

test('removing the sole unresolved rare response finalizes review instead of leaving an empty blocked queue', async t => {
  const input = getDemoQuiz(); const round = getDefaultRound('rare_answers'); if (round.mode !== 'rare_answers') throw new Error('fixture');
  round.publicConfig.adjudication = 'host_review'; input.rounds = [round];
  const f = await fixture(t, input); await f.action('START'); await f.active();
  await f.engine.submit(f.members[0].principal, f.room.sessionId, { roundId: round.id, clientMutationId: key(), revision: 1, payload: { text: 'Coral' } });
  await f.engine.submit(f.members[1].principal, f.room.sessionId, { roundId: round.id, clientMutationId: key(), revision: 1, payload: { text: 'Unexpected' } });
  await f.action('LOCK'); await f.engine.reconcile();
  assert.equal((await f.store.getSession(f.room.sessionId)).session.state, 'REVIEW_REQUIRED');
  await f.action('KICK', { participantId: f.members[1].principal.id });
  assert.equal((await f.store.getSession(f.room.sessionId)).session.state, 'ROUND_SCORED');
  await f.action('REVEAL');
  assert.equal((await f.engine.snapshot(f.members[0].principal, f.room.sessionId)).ownPoints, 1000);
});

for(const playerCount of [2,3,5,10])test(`${playerCount} players: five-mode round podium evidence, tied winners and cumulative standings survive recovery`,async t=>{
 const f=await fixture(t,getDemoQuiz(),playerCount);await f.action('START');await f.active();
 for(let i=0;i<5;i++){
  const round=f.version.rounds[i];const before=await f.engine.snapshot(f.members[0].principal,f.room.sessionId);assert.equal(before.roundAwards,undefined);assert.equal(before.revealStartedAt,undefined);
  for(let j=0;j<playerCount;j++){
   const p=f.members[j].principal;
   if(round.mode==='word_puzzle')await f.engine.wordGuess(p,f.room.sessionId,{roundId:round.id,clientMutationId:key(),guess:round.secretConfig.answer});
   else {const payload=round.mode==='fermi'?{value:round.secretConfig.answer}:round.mode==='rare_answers'?{text:round.secretConfig.answers[j%5].canonical}:round.mode==='size_it_up'?{ratio:round.secretConfig.targetSize/round.publicConfig.referenceSize}:{count:round.secretConfig.answer};await f.engine.submit(p,f.room.sessionId,{roundId:round.id,clientMutationId:key(),revision:1,payload});}
  }
  if(round.mode==='amountle'){f.advance(round.timerSeconds*1000+1);await f.engine.reconcile(f.room.sessionId)}else await f.action('LOCK');
  await f.engine.reconcile(f.room.sessionId);assert.equal((await f.engine.snapshot(f.hostPrincipal,f.room.sessionId)).roundAwards,undefined);
  await f.action('REVEAL');const revealed=await f.engine.snapshot(f.members[0].principal,f.room.sessionId);assert.equal(revealed.roundAwards?.length,playerCount);assert.ok(revealed.revealStartedAt);assert.equal(revealed.leaderboard.length,playerCount);
  if(round.mode==='rare_answers')assert.ok(revealed.roundAwards!.every(a=>a.points===revealed.roundAwards![0].points),'equally frequent answers must tie');
  await f.restart();const recovered=await f.engine.snapshot(f.members[0].principal,f.room.sessionId);assert.deepEqual(recovered.roundAwards,revealed.roundAwards);assert.equal(recovered.revealStartedAt,revealed.revealStartedAt);assert.deepEqual(recovered.leaderboard,revealed.leaderboard);
  await f.action('NEXT');if(i<4)await f.active();else{f.advance(1000);await f.engine.reconcile(f.room.sessionId)}
 }
 assert.equal((await f.engine.snapshot(f.hostPrincipal,f.room.sessionId)).state,'SESSION_COMPLETED');
});

test('Fill is monotonic even for legacy remove-enabled configs and locks at server expiry',async t=>{
 const quiz=getDemoQuiz();const round=getDefaultRound('amountle');if(round.mode!=='amountle')throw new Error();round.publicConfig.allowRemove=true;round.allowRevision=false;quiz.rounds=[round];const f=await fixture(t,quiz,2);await f.action('START');await f.active();
 const p=f.members[0].principal;const send=(count:number,revision:number)=>f.engine.submit(p,f.room.sessionId,{roundId:round.id,clientMutationId:key(),revision,payload:{count,locked:false}});
 await send(1,1);await send(7,2);await assert.rejects(send(6,3),isCode('REMOVAL_DISABLED'));await send(8,4);f.advance(round.timerSeconds*1000+1);await f.engine.reconcile(f.room.sessionId);await assert.rejects(send(9,5));await f.action('REVEAL');const s=await f.engine.snapshot(p,f.room.sessionId);assert.equal(s.ownSubmission?.payload.count,8);assert.equal(s.round?.fillTarget,round.secretConfig.answer);
});

test('anonymous creation and hosting are rejected before any persistent ownership is assigned',async t=>{
 const f=await fixture(t);const context={store:f.store,user:null,pinSecret:PIN_SECRET};const request=(path:string,body:unknown)=>new Request('http://localhost/api/v1/'+path,{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json','Idempotency-Key':key()},body:JSON.stringify(body)});
 assert.equal((await handleApi(request('quizzes',getDemoQuiz()),context)).status,401);assert.equal((await handleApi(request('sessions',{quizVersionId:f.version.id}),context)).status,401);
});

test('Amountle accepts deadline minus 1 ms, rejects the exact deadline, and replays the accepted count',async t=>{
 const quiz=getDemoQuiz();quiz.rounds=[getDefaultRound('amountle')];
 const f=await fixture(t,quiz,3);await f.action('START');await f.active();
 const state=await f.engine.snapshot(f.members[0].principal,f.room.sessionId);
 f.advance(Date.parse(state.deadlineAt!)-Date.parse(state.serverTime)-1);
 const input={roundId:quiz.rounds[0].id,clientMutationId:key(),revision:1,payload:{count:56,locked:false}};
 const ack=await f.engine.submit(f.members[0].principal,f.room.sessionId,input);
 assert.equal(ack.acceptedCount,56);
 f.advance(1);
 await assert.rejects(f.engine.submit(f.members[0].principal,f.room.sessionId,{...input,clientMutationId:key(),revision:2,payload:{count:57,locked:false}}),isCode('ANSWER_LATE'));
 assert.deepEqual(await f.engine.submit(f.members[0].principal,f.room.sessionId,input),ack);
 const restored=await f.engine.snapshot(f.members[0].principal,f.room.sessionId);
 assert.equal(restored.ownSubmission?.payload.count,56);
});

test('host result-stage controls persist for players and display without leaking into the next round',async t=>{
 const f=await fixture(t,getDemoQuiz(),3);await f.action('START');await f.active();
 await assert.rejects(f.action('RESULT_STAGE',{stage:'podium'}),isCode('INVALID_TRANSITION'));
 await f.action('SKIP');await f.action('RESULT_STAGE',{stage:'podium'});
 assert.equal((await f.engine.snapshot(f.members[0].principal,f.room.sessionId)).resultStage,'podium');
 await f.restart();assert.equal((await f.engine.snapshot(f.members[1].principal,f.room.sessionId)).resultStage,'podium');
 await f.action('RESULT_STAGE',{stage:'standings'});
 assert.equal((await f.engine.snapshot(f.hostPrincipal,f.room.sessionId)).resultStage,'standings');
 await f.action('RESULT_STAGE',{stage:'auto'});
 assert.equal((await f.engine.snapshot(f.members[0].principal,f.room.sessionId)).resultStage,undefined);
 await f.action('NEXT');await f.active();await f.action('SKIP');
 assert.equal((await f.engine.snapshot(f.members[0].principal,f.room.sessionId)).resultStage,undefined);
});
