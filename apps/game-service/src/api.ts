import { z } from 'zod';
import {AvatarSchema} from '../../../packages/contracts/src/avatar';
import { DomainError, HostActionSchema, QuizInputSchema, RoundSchema, SubmitSchema, WordGuessSchema } from '../../../packages/contracts/src/index';
import type { Features, Principal, Quiz, QuizInput, Profile } from '../../../packages/contracts/src/index';
import type { Store } from '../../../packages/db/src/types';
import { getDemoQuiz, validateQuiz } from '../../../packages/game-modes/src/index';
import { GameEngine } from './engine';
import { assertRateBudget, assertSameOrigin, cookieValue, digestToken, idempotentId, mutationKey, participantCookie, rateLimit } from './security';

export type ApiUser = { id: string; displayName: string };
export type ApiContext = { store: Store; user: ApiUser | null; features?: Features; cookieSecure?: boolean; pinSecret?: string; maxPlayers?: number; automatic?:boolean; clientIp?: string };
const DEFAULT_FEATURES: Features = { ai: false, billing: false, ads: false, stage: 'private_alpha', transport: 'polling' };
const uuid = z.string().uuid();
const revision = z.number().int().positive();
const reviewSchema = z.object({ roundId: uuid, answerKey: z.string().min(1).max(100).optional(), answer: z.string().min(1).max(100).optional(), decision: z.enum(['accept', 'reject']), canonical: z.string().max(100).optional(), canonicalValue: z.string().max(100).optional(), expectedStateVersion: z.number().int().nonnegative() });

type CachedResult = { fingerprint: string; value: unknown };
async function readJson(request: Request, maximum = 262144): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maximum) throw new DomainError('PAYLOAD_TOO_LARGE', 'This request is too large.', 413);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new DomainError('JSON_REQUIRED', 'Send this request as application/json.', 400);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  if (reader) {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maximum) { await reader.cancel(); throw new DomainError('PAYLOAD_TOO_LARGE', 'This request is too large.', 413); }
      chunks.push(part.value);
    }
  }
  const raw = new Uint8Array(bytes); let position = 0;
  for (const chunk of chunks) { raw.set(chunk, position); position += chunk.byteLength; }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(raw);
  try {
    const data: unknown = text ? JSON.parse(text) : {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('object required');
    return data as Record<string, unknown>;
  } catch { throw new DomainError('INVALID_JSON', 'Send a valid JSON object.', 400); }
}
function requireUser(user: ApiUser | null): ApiUser {
  if (!user) throw new DomainError('UNAUTHENTICATED', 'Sign in to create or host a game.', 401);
  return user;
}
function validationDetails(input: QuizInput) {
  const issues = validateQuiz(input);
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues, estimatedDurationSeconds: input.rounds.reduce((total, round) => total + round.timerSeconds + 15, 0) };
}
function assertPublishable(input: QuizInput): void {
  const result = validationDetails(input);
  if (!result.valid) throw new DomainError('INVALID_QUIZ', 'Fix the highlighted rounds before publishing.', 422, result.issues);
}
function draftInput(quiz: Quiz): QuizInput {
  return { title: quiz.title, description: quiz.description, language: quiz.language, audienceContext: quiz.audienceContext, theme: quiz.theme, rounds: quiz.rounds };
}
async function durableAction<T>(store: Store, owner: string, key: string, body: unknown, action: () => Promise<T>): Promise<T> {
  const fingerprint = await digestToken(JSON.stringify(body));
  const cached = await store.db.query<{ result_json: string }>('SELECT result_json FROM api_receipts WHERE principal_id = ? AND idempotency_key = ?', [owner, key]);
  if (cached.rows[0]) {
    const parsed: CachedResult = JSON.parse(cached.rows[0].result_json);
    if (parsed.fingerprint !== fingerprint) throw new DomainError('IDEMPOTENCY_CONFLICT', 'This action key was already used for different input.', 409);
    return parsed.value as T;
  }
  const value = await action();
  await store.db.query('INSERT INTO api_receipts (principal_id, idempotency_key, result_json, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(principal_id, idempotency_key) DO NOTHING', [owner, key, JSON.stringify({ fingerprint, value }), new Date().toISOString()]);
  return value;
}
async function editableVersion(store: Store, id: string, ownerId: string): Promise<Quiz> {
  try { return await store.getQuiz(id, ownerId); }
  catch (error) {
    if (!(error instanceof DomainError) || error.status !== 404) throw error;
    try { await store.getVersion(id, ownerId); }
    catch { throw new DomainError('NOT_FOUND', 'This editable version is unavailable.', 404); }
    throw new DomainError('IMMUTABLE_VERSION', 'Published versions cannot be edited. Create an editable copy first.', 409);
  }
}

/** Authentication comes only from a verified server adapter and opaque scoped
 * credentials. In particular, client-supplied user IDs/role headers are ignored. */
export async function resolvePrincipal(request: Request, store: Store, user: ApiUser | null, sessionId: string): Promise<Principal> {
  uuid.parse(sessionId);
  const url = new URL(request.url);
  const role = url.searchParams.get('role');
  const displayToken = url.searchParams.get('displayToken');
  if (displayToken) {
    if (!/^[a-f0-9]{64}$/.test(displayToken)) throw new DomainError('DISPLAY_EXPIRED', 'This display link is unavailable.', 401);
    const display = await store.findDisplay(await digestToken(displayToken));
    if (!display || display.role !== 'display' || display.sessionId !== sessionId) throw new DomainError('DISPLAY_EXPIRED', 'This display link has expired or been revoked.', 401);
    return display;
  }
  if (role !== 'player' && user) {
    const data = await store.getSession(sessionId);
    if (data.session.hostId === user.id) return { role: 'host', id: user.id };
    if (role === 'host') throw new DomainError('FORBIDDEN', 'Only the host can open these controls.', 403);
  }
  if (role === 'host') throw new DomainError('UNAUTHENTICATED', 'Sign in as the host to open these controls.', 401);
  const token = cookieValue(request, `mg_player_${sessionId}`);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const player = await store.findPlayer(sessionId, await digestToken(token));
    if (player) return player;
  }
  throw new DomainError('UNAUTHENTICATED', 'Join this room to continue.', 401);
}

/** Framework-neutral controller, used by both the Sites HTTP adapter and the
 * Node/Socket.IO deployment. Responses always contain committed domain data. */
export async function handleApi(request: Request, ctx: ApiContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Request-Id': requestId });
  const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ data, meta: { requestId, serverTime: new Date().toISOString() } }), { status, headers });
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/v1\/?/, '').replace(/\/$/, '');
    const method = request.method.toUpperCase();
    if (!url.pathname.startsWith('/api/v1/')) throw new DomainError('NOT_FOUND', 'This endpoint does not exist.', 404);
    assertSameOrigin(request);
    const engine = new GameEngine(ctx.store, undefined, { pinSecret: ctx.pinSecret, maxPlayers: ctx.maxPlayers, automatic:ctx.automatic });
    const features: Features = { ...DEFAULT_FEATURES, ...ctx.features, ai: false, billing: false, ads: false };
    const body = !['GET', 'HEAD', 'DELETE'].includes(method) ? await readJson(request) : {};
    const user = ctx.user;
    // Trusted adapter supplies clientIp. Never trust arbitrary forwarded headers.
    const ipDigest = await digestToken(ctx.clientIp ?? 'unidentified-client');

    if (method === 'GET' && path === 'me') {
      if (!user) return ok(null);
      const profile: Profile = { ...user, features, plan: 'free', quotaRemaining: 0 };
      return ok(profile);
    }
    if (method === 'GET' && path === 'features') return ok(features);
    if (method === 'GET' && path === 'health') {
      await ctx.store.db.query('SELECT 1 AS ok');
      return ok({ status: 'ok', persistence: 'available', stage: features.stage });
    }
    if (method === 'GET' && path === 'demo') return ok({ ...getDemoQuiz(), isDemo: true });

    if (path === 'quizzes' && method === 'GET') {
      const owner = requireUser(user);
      const quizzes = await ctx.store.listQuizzes(owner.id);
      const query = (url.searchParams.get('q') ?? '').toLocaleLowerCase('en');
      return ok(quizzes.filter((quiz) => !query || quiz.title.toLocaleLowerCase('en').includes(query)));
    }
    if (path === 'quizzes' && method === 'POST') {
      const owner = requireUser(user);
      const key = mutationKey(request);
      const input = QuizInputSchema.parse({ rounds: [], ...body });
      await rateLimit(ctx.store.db, `quiz-create:${owner.id}`, 30, 60 * 60 * 1000);
      return ok(await durableAction(ctx.store, owner.id, `quiz.create:${key}`, input, async () => {
        const id = await idempotentId('quiz', owner.id, key);
        const quiz = await ctx.store.createQuiz(owner.id, input, id, key);
        if (JSON.stringify(draftInput(quiz)) !== JSON.stringify(input)) throw new DomainError('IDEMPOTENCY_CONFLICT', 'This action key was already used for a different quiz.', 409);
        return { ...quiz, quizId: quiz.id };
      }), 201);
    }
    const quizPath = path.match(/^quizzes\/([^/]+)(?:\/(publish|preview|versions|duplicate))?$/);
    if (quizPath) {
      const owner = requireUser(user);
      const id = uuid.parse(quizPath[1]);
      const suffix = quizPath[2];
      const quiz = await ctx.store.getQuiz(id, owner.id);
      if (method === 'GET' && !suffix) return ok(quiz);
      if (method === 'PATCH' && !suffix) {
        const expectedRevision = revision.parse(body.expectedRevision);
        const input = QuizInputSchema.parse({ ...draftInput(quiz), ...body });
        const key = mutationKey(request);
        const result = await durableAction(ctx.store, owner.id, `quiz.save:${id}:${key}`, body, async () => {
          if (quiz.revision === expectedRevision + 1 && JSON.stringify(draftInput(quiz)) === JSON.stringify(input)) return quiz;
          return ctx.store.saveQuiz(id, owner.id, expectedRevision, input);
        });
        return ok(result);
      }
      if (method === 'DELETE' && !suffix) {
        await durableAction(ctx.store, owner.id, `quiz.archive:${id}:${mutationKey(request)}`, { id }, async () => { await ctx.store.archiveQuiz(id, owner.id); return { archived: true, quizId: id }; });
        return ok({ archived: true, quizId: id });
      }
      if (method === 'POST' && suffix === 'preview') return ok(validationDetails(draftInput(quiz)));
      if (method === 'POST' && suffix === 'publish') {
        const expectedRevision = revision.parse(body.expectedRevision ?? quiz.revision);
        const key = mutationKey(request);
        return ok(await durableAction(ctx.store, owner.id, `quiz.publish:${id}:${key}`, { id, expectedRevision }, async () => {
          assertPublishable(draftInput(quiz));
          const version = await ctx.store.publishQuiz(id, owner.id, expectedRevision, key);
          return { ...version, quizVersionId: version.id };
        }), 201);
      }
      if (method === 'POST' && suffix === 'versions') {
        const key = mutationKey(request);
        return ok(await durableAction(ctx.store, owner.id, `quiz.editable:${id}:${key}`, body, async () => {
          let draft = quiz;
          if (body.sourceVersionId) {
            const source = await ctx.store.getVersion(uuid.parse(body.sourceVersionId), owner.id);
            if (source.quizId !== id) throw new DomainError('VERSION_MISMATCH', 'Choose a published version of this quiz.', 422);
            draft = await ctx.store.saveQuiz(id, owner.id, revision.parse(body.expectedRevision ?? quiz.revision), { ...draftInput(quiz), title: source.title, theme: z.enum(['studio', 'midnight']).parse(source.theme), rounds: source.rounds });
          }
          return { ...draft, quizId: id, versionId: id, immutable: false };
        }), 201);
      }
      if (method === 'POST' && suffix === 'duplicate') {
        const key = mutationKey(request);
        return ok(await durableAction(ctx.store, owner.id, `quiz.duplicate:${id}:${key}`, { id }, async () => {
          const copyId = await idempotentId('quiz.duplicate', owner.id, key);
          try { return await ctx.store.getQuiz(copyId, owner.id); } catch { /* create below */ }
          return ctx.store.createQuiz(owner.id, { ...draftInput(quiz), title: `${quiz.title.slice(0, 90)} (copy)`, rounds: quiz.rounds.map((round) => ({ ...round, id: crypto.randomUUID() })) }, copyId);
        }), 201);
      }
    }
    const versionPath = path.match(/^versions\/([^/]+)(?:\/(rounds|reorder|validate|publish))?$/);
    if (versionPath) {
      const owner = requireUser(user);
      const id = uuid.parse(versionPath[1]);
      const suffix = versionPath[2];
      if (method === 'GET' && !suffix) return ok(await ctx.store.getVersion(id, owner.id));
      const quiz = await editableVersion(ctx.store, id, owner.id);
      if (method === 'POST' && suffix === 'validate') return ok(validationDetails(draftInput(quiz)));
      if (method === 'POST' && suffix === 'publish') {
        const expectedRevision = revision.parse(body.expectedRevision ?? quiz.revision);
        const key = mutationKey(request);
        return ok(await durableAction(ctx.store, owner.id, `quiz.publish:${id}:${key}`, { id, expectedRevision }, async () => {
          assertPublishable(draftInput(quiz));
          const published = await ctx.store.publishQuiz(id, owner.id, expectedRevision, key);
          return { ...published, quizVersionId: published.id };
        }), 201);
      }
      if (method === 'POST' && suffix === 'rounds') {
        const round = RoundSchema.parse(body.round ?? body);
        if (quiz.rounds.some((item) => item.id === round.id)) throw new DomainError('DUPLICATE_ROUND', 'This round is already in the quiz.', 409);
        const expectedRevision = revision.parse(body.expectedRevision ?? quiz.revision);
        const result = await durableAction(ctx.store, owner.id, `round.create:${id}:${mutationKey(request)}`, body, async () => ctx.store.saveQuiz(id, owner.id, expectedRevision, { ...draftInput(quiz), rounds: [...quiz.rounds, round] }));
        return ok({ roundId: round.id, revision: result.revision, quiz: result }, 201);
      }
      if (method === 'POST' && suffix === 'reorder') {
        const ids = z.array(uuid).parse(body.roundIds ?? body.orderedRoundIds);
        if (ids.length !== quiz.rounds.length || new Set(ids).size !== ids.length || ids.some((roundId) => !quiz.rounds.some((round) => round.id === roundId))) throw new DomainError('INVALID_ORDER', 'Provide each existing round exactly once.', 422);
        return ok(await durableAction(ctx.store, owner.id, `round.reorder:${id}:${mutationKey(request)}`, body, async () => ctx.store.saveQuiz(id, owner.id, revision.parse(body.expectedRevision ?? quiz.revision), { ...draftInput(quiz), rounds: ids.map((roundId) => quiz.rounds.find((round) => round.id === roundId)!) })));
      }
    }
    const roundPath = path.match(/^rounds\/([^/]+)$/);
    if (roundPath && ['PATCH', 'DELETE'].includes(method)) {
      const owner = requireUser(user); const id = uuid.parse(roundPath[1]);
      const quizId = body.quizId ?? url.searchParams.get('quizId');
      const matches = (quizId ? [await ctx.store.getQuiz(uuid.parse(quizId), owner.id)] : await ctx.store.listQuizzes(owner.id)).filter((quiz) => quiz.rounds.some((round) => round.id === id));
      if (!matches.length) throw new DomainError('NOT_FOUND', 'This round is unavailable.', 404);
      if (matches.length !== 1) throw new DomainError('QUIZ_ID_REQUIRED', 'Specify which quiz to edit.', 422);
      const quiz = matches[0];
      const rounds = method === 'DELETE' ? quiz.rounds.filter((round) => round.id !== id) : quiz.rounds.map((round) => round.id === id ? RoundSchema.parse({ ...round, ...(body.round as object ?? body), id }) : round);
      return ok(await durableAction(ctx.store, owner.id, `round.edit:${id}:${mutationKey(request)}`, { method, body, quizId }, async () => ctx.store.saveQuiz(quiz.id, owner.id, revision.parse(body.expectedRevision ?? (Number(url.searchParams.get('expectedRevision')) || quiz.revision)), { ...draftInput(quiz), rounds })));
    }

    if (method === 'POST' && path === 'sessions') {
      const owner = requireUser(user); const versionId = uuid.parse(body.quizVersionId);
      await rateLimit(ctx.store.db, `session-create:${owner.id}`, 30, 60 * 60 * 1000);
      const result = await engine.createSession(owner.id, versionId, mutationKey(request));
      return ok({ ...result, hostUrl: `/host/${result.sessionId}`, joinUrl: `/join/${result.pin}` }, 201);
    }
    if (method === 'POST' && path === 'sessions/join') {
      await rateLimit(ctx.store.db, `join:${ipDigest}`, 90, 60 * 1000);
      await assertRateBudget(ctx.store.db, `pin-failures:${ipDigest}`, 20);
      const input = z.object({ pin: z.string().max(12), nickname: z.string().max(100) }).parse(body);
      let result: Awaited<ReturnType<GameEngine['join']>>;
      try { result = await engine.join(input.pin, input.nickname); }
      catch (error) {
        if (error instanceof DomainError && error.code === 'ROOM_UNAVAILABLE') await rateLimit(ctx.store.db, `pin-failures:${ipDigest}`, 20, 60 * 1000);
        throw error;
      }
      headers.append('Set-Cookie', participantCookie(result.sessionId, result.token, ctx.cookieSecure ?? url.protocol === 'https:'));
      return ok({ sessionId: result.sessionId, participantId: result.participantId, playUrl: `/play/${result.sessionId}` }, 201);
    }
    const displayPath = path.match(/^display\/([a-f0-9]{64})\/snapshot$/);
    if (method === 'GET' && displayPath) {
      const principal = await ctx.store.findDisplay(await digestToken(displayPath[1]));
      if (!principal || principal.role !== 'display') throw new DomainError('DISPLAY_EXPIRED', 'This display link has expired or been revoked.', 401);
      return ok(await engine.snapshot(principal, principal.sessionId));
    }
    const sessionPath = path.match(/^sessions\/([^/]+)\/(snapshot|host-actions|submissions|answers|word-guesses|rare-review|display-pairing|events|results|appearance)$/);
    if (sessionPath) {
      const id = uuid.parse(sessionPath[1]); const suffix = sessionPath[2];
      const principalRequest = ['submissions', 'answers', 'word-guesses'].includes(suffix) ? new Request((() => { const playerUrl = new URL(request.url); playerUrl.searchParams.set('role', 'player'); return playerUrl; })(), { headers: request.headers }) : request;
      const principal = await resolvePrincipal(principalRequest, ctx.store, user, id);
      if(method==='POST'&&suffix==='appearance'){
        if(principal.role!=='player')throw new DomainError('FORBIDDEN','Only players can edit their own look.',403);
        const avatar=AvatarSchema.parse(z.object({avatar:AvatarSchema}).strict().parse(body).avatar);
        await rateLimit(ctx.store.db,`appearance:${id}:${principal.id}`,30,60000);
        return ok(await engine.updateAppearance(principal,id,avatar,mutationKey(request)));
      }
      if (method === 'GET' && ['snapshot', 'results'].includes(suffix)) return ok(await engine.snapshot(principal, id));
      if (method === 'GET' && suffix === 'events') {
        const after = z.coerce.number().int().nonnegative().parse(url.searchParams.get('after') ?? 0);
        await engine.snapshot(principal, id); // Validate membership and reconcile timers first.
        // Events contain only neutral state metadata, never answer/score payloads.
        const events = (await ctx.store.events(id, after)).map((event) => ({ ...event, payload: { state: event.payload.state, roundIndex: event.payload.roundIndex } }));
        return ok(events);
      }
      if (method === 'POST' && ['submissions', 'answers'].includes(suffix)) {
        if (principal.role !== 'player') throw new DomainError('FORBIDDEN', 'Open the player view to submit an answer.', 403);
        const submission = SubmitSchema.parse(body);
        await rateLimit(ctx.store.db, `answer:${id}:${principal.id}`, 600, 60 * 1000);
        return ok(await engine.submit(principal, id, submission));
      }
      if (method === 'POST' && suffix === 'word-guesses') {
        if (principal.role !== 'player') throw new DomainError('FORBIDDEN', 'Open the player view to submit a word.', 403);
        const guess = WordGuessSchema.parse(body);
        await rateLimit(ctx.store.db, `word:${id}:${principal.id}`, 60, 60 * 1000);
        return ok(await engine.wordGuess(principal, id, guess));
      }
      if (principal.role !== 'host') throw new DomainError('FORBIDDEN', 'Only the host can perform this action.', 403);
      if (method === 'POST' && suffix === 'host-actions') {
        await rateLimit(ctx.store.db, `host:${id}:${principal.id}`, 120, 60 * 1000);
        return ok(await engine.hostAction(principal.id, id, HostActionSchema.parse(body), mutationKey(request)));
      }
      if (method === 'POST' && suffix === 'rare-review') {
        const decision = reviewSchema.parse(body);
        const answerKey = decision.answerKey ?? decision.answer;
        if (!answerKey) throw new DomainError('ANSWER_REQUIRED', 'Choose an answer to review.', 422);
        return ok(await engine.review(principal.id, id, { ...decision, answerKey, canonical: decision.canonical ?? decision.canonicalValue }, mutationKey(request)));
      }
      if (method === 'POST' && suffix === 'display-pairing') {
        const pairing = await durableAction(ctx.store, principal.id, `display:${id}:${mutationKey(request)}`, { id }, () => engine.pairDisplay(principal.id, id));
        return ok({ ...pairing, displayUrl: `/display/${pairing.token}` }, 201);
      }
      if (method === 'DELETE' && suffix === 'display-pairing') {
        await engine.revokeDisplays(principal.id, id); return ok({ revoked: true });
      }
    }

    if (path === 'reports' && method === 'POST') {
      await rateLimit(ctx.store.db, `report:${user?.id ?? ipDigest}`, 6, 60 * 60 * 1000);
      const report = z.object({ category: z.string().trim().min(1).max(40), targetType: z.string().max(30).default('general'), targetId: z.string().max(100).optional(), context: z.string().trim().min(1).max(2000) }).parse(body);
      const id = crypto.randomUUID(); const createdAt = new Date().toISOString();
      await ctx.store.db.query('INSERT INTO abuse_reports (id, reporter_id, category, target_type, target_id, context, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, user?.id ?? null, report.category, report.targetType, report.targetId ?? null, report.context, 'open', createdAt]);
      return ok({ receiptId: id, status: 'open', createdAt }, 201);
    }
    if (path === 'privacy/requests' && method === 'POST') {
      const owner = requireUser(user);
      const kind = z.enum(['export', 'delete']).parse(body.type ?? body.requestType);
      await rateLimit(ctx.store.db, `privacy:${owner.id}`, 5, 24 * 60 * 60 * 1000);
      const id = crypto.randomUUID(); const createdAt = new Date().toISOString();
      await ctx.store.db.query('INSERT INTO privacy_requests (id, owner_id, request_type, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)', [id, owner.id, kind, 'pending', createdAt, null]);
      return ok({ receiptId: id, type: kind, status: 'pending', createdAt, message: 'Your request is recorded for the account administrator. This receipt does not mean deletion is complete.' }, 201);
    }
    if (path === 'privacy/settings') {
      const owner = requireUser(user);
      if (method === 'GET') {
        const result = await ctx.store.db.query<{ analytics_consent: number; hide_nickname: number }>('SELECT analytics_consent, hide_nickname FROM user_privacy_settings WHERE owner_id = ?', [owner.id]);
        return ok({ analyticsConsent: Boolean(result.rows[0]?.analytics_consent), hideNickname: Boolean(result.rows[0]?.hide_nickname) });
      }
      if (method === 'PATCH') {
        const settings = z.object({ analyticsConsent: z.boolean(), hideNickname: z.boolean() }).parse(body);
        await ctx.store.db.query('INSERT INTO user_privacy_settings (owner_id, analytics_consent, hide_nickname, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET analytics_consent = excluded.analytics_consent, hide_nickname = excluded.hide_nickname, updated_at = excluded.updated_at', [owner.id, Number(settings.analyticsConsent), Number(settings.hideNickname), new Date().toISOString()]);
        return ok(settings);
      }
    }
    if (path === 'account/export' && method === 'GET') {
      const owner = requireUser(user);
      return ok({ account: owner, quizzes: await ctx.store.listQuizzes(owner.id), exportedAt: new Date().toISOString(), scope: 'Account profile and owned quiz drafts. Session and moderation records can be requested through privacy requests.' });
    }
    if (path.startsWith('admin')) throw new DomainError('FORBIDDEN', 'Administrative access is not configured for this account.', 403);
    if (path === 'billing' && method === 'GET') return ok({ enabled: false, plan: 'free', status: 'not_configured', message: 'Payments are disabled during private alpha.' });
    if (path.startsWith('ai/') || path.startsWith('billing/')) {
      requireUser(user);
      throw new DomainError('FEATURE_DISABLED', path.startsWith('ai/') ? 'AI creation is disabled until the generation provider and creator review flow are configured.' : 'Payments are disabled until the payment provider and reconciliation flow are configured.', 503);
    }
    throw new DomainError('NOT_FOUND', 'This endpoint does not exist.', 404);
  } catch (error) {
    const domain = error instanceof DomainError ? error : error instanceof z.ZodError ? new DomainError('VALIDATION_FAILED', 'Some fields need attention.', 422, error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))) : new DomainError('INTERNAL_ERROR', 'The action could not be completed. Please retry with the same action key.', 500);
    if (domain.status === 429 && typeof domain.details === 'object' && domain.details && 'retryAfterSeconds' in domain.details) headers.set('Retry-After', String(domain.details.retryAfterSeconds));
    return new Response(JSON.stringify({ error: { code: domain.code, message: domain.message, requestId, ...(domain.details !== undefined ? { details: domain.details } : {}) } }), { status: domain.status, headers });
  }
}
