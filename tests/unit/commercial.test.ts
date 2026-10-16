import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { DomainError, MODES, STATES } from '../../packages/contracts/src/index';
import { NodeSqliteDatabase } from '../../packages/db/src/sqlite';
import { SqlStore } from '../../packages/db/src/store';
import { getDemoQuiz, validateQuiz } from '../../packages/game-modes/src/index';
import {
  adEligibility, aiQuota, bindBillingCustomer, calculateAiCost, claimAiJob, commercialConfig,
  enqueueAiDraft, getAiJob, getEntitlements, prepareAiDraft, processStripeWebhook, requireEntitlement,
  validateAiConfig, verifyStripeSignature,
} from '../../packages/commercial/src/index';
import type { AdContext, AiConfig, AiRequest, StripeConfig } from '../../packages/commercial/src/index';
import { runAiWorkerTick } from '../../apps/worker/src/ai';

const NOW = Date.parse('2026-10-16T12:00:00.000Z');
const SECRET = 'whsec_unit_test_secret_never_live';
const sql = await readFile(new URL('../../packages/db/migrations/sqlite/0001_initial.sql', import.meta.url), 'utf8');
const aiConfig = (allowance = 2): AiConfig => ({
  policy: { aiEnabled: true, aiProcessingApproved: true, monthlyAiAllowance: allowance, maxConfirmationAgeMs: 86400000 },
  endpoint: 'https://api.openai.com/v1/responses', apiKey: 'test-key-not-a-real-credential', model: 'configured-test-model',
  maxOutputTokens: 8000, timeoutMs: 5000, maxAttempts: 3,
  prices: { inputUsdPerMillion: 2, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 8 },
});
const stripeConfig = (): StripeConfig => ({ enabled: true, webhookSecret: SECRET, apiKey: 'sk_test_fixture_only', apiVersion: 'fixture-pinned-version', liveMode: false, approvedPriceIds: ['price_premium'] });
const request = (): AiRequest => ({ requestKey: crypto.randomUUID(), prompt: 'Create five self-contained party puzzle rounds.', modes: [...MODES], roundCount: 5, audienceContext: 'adult_private', processingConsent: true });
const signed = (body: string, time = NOW, secret = SECRET) => {
  const timestamp = Math.floor(time / 1000);
  return `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
};
const event = (id = 'evt_test1', type = 'customer.subscription.updated') => JSON.stringify({ id, type, livemode: false, created: 1, data: { object: { id: 'sub_test1', customer: 'cus_test1', metadata: { ownerId: 'untrusted-metadata' } } } });
const snapshot = (status = 'active', price = 'price_premium') => ({ id: 'sub_test1', customer: 'cus_test1', livemode: false, status, cancel_at_period_end: true, items: { data: [{ price: { id: price }, current_period_end: Math.floor(NOW / 1000) + 86400 }] } });
const modelResponse = (draft: unknown = getDemoQuiz(), status = 'completed') => ({
  id: 'resp_fixture', model: 'configured-test-model', status,
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(draft) }] }],
  usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 20 }, output_tokens: 50 },
});

async function fixture(premium = true) {
  const db = new NodeSqliteDatabase(':memory:');
  await db.migrate(sql);
  const store = new SqlStore(db, () => new Date(NOW));
  const user = await store.ensureUser(`test:${crypto.randomUUID()}`, 'Test creator');
  if (premium) await db.query('INSERT INTO subscriptions (id,owner_id,provider_customer_id,provider_subscription_id,plan,status,current_period_end,provider_confirmed_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)', [crypto.randomUUID(), user.id, 'cus_test1', 'sub_test1', 'premium', 'active', new Date(NOW + 86400000).toISOString(), new Date(NOW).toISOString(), new Date(NOW).toISOString()]);
  return { db, store, ownerId: user.id };
}
const domainCode = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code;

test('commercial configuration defaults closed and requires explicit model, prices and approved endpoint', async () => {
  const defaults = commercialConfig();
  assert.equal(defaults.ai.policy.aiEnabled, false);
  assert.equal(defaults.stripe.enabled, false);
  assert.equal(defaults.adsEnabled, false);
  assert.equal(defaults.ai.model, undefined);
  assert.throws(() => validateAiConfig(defaults.ai), domainCode('FEATURE_DISABLED'));
  assert.throws(() => validateAiConfig({ ...aiConfig(), model: undefined }), domainCode('AI_NOT_CONFIGURED'));
  assert.throws(() => validateAiConfig({ ...aiConfig(), prices: undefined }), domainCode('AI_NOT_CONFIGURED'));
  assert.throws(() => validateAiConfig({ ...aiConfig(), endpoint: 'https://attacker.example/v1/responses' }), domainCode('AI_ENDPOINT_NOT_APPROVED'));
  const { db } = await fixture();
  try { assert.deepEqual(await runAiWorkerTick(db, defaults.ai), { processed: false }); }
  finally { db.close(); }
});

test('entitlements fail closed without fresh provider confirmation, valid state and unexpired period', async () => {
  const { db, ownerId } = await fixture();
  try {
    assert.equal((await getEntitlements(db, ownerId, aiConfig().policy, NOW)).ai, true);
    assert.equal((await getEntitlements(db, ownerId, undefined, NOW)).adFree, true, 'Paid ad-free benefits do not depend on new-sale enablement');
    await assert.rejects(requireEntitlement(db, ownerId, 'ai', undefined, NOW), domainCode('FEATURE_DISABLED'));
    await db.query("UPDATE subscriptions SET status='past_due' WHERE owner_id=?", [ownerId]);
    await assert.rejects(requireEntitlement(db, ownerId, 'ai', aiConfig().policy, NOW), domainCode('ENTITLEMENT_REQUIRED'));
    await db.query("UPDATE subscriptions SET status='active',provider_confirmed_at=NULL WHERE owner_id=?", [ownerId]);
    assert.equal((await getEntitlements(db, ownerId, aiConfig().policy, NOW)).plan, 'free');
    await db.query('UPDATE subscriptions SET provider_confirmed_at=?,current_period_end=? WHERE owner_id=?', [new Date(NOW).toISOString(), new Date(NOW).toISOString(), ownerId]);
    assert.equal((await getEntitlements(db, ownerId, aiConfig().policy, NOW)).plan, 'free');
    await db.query('UPDATE subscriptions SET provider_confirmed_at=?,current_period_end=? WHERE owner_id=?', [new Date(NOW - 86400001).toISOString(), new Date(NOW + 100000).toISOString(), ownerId]);
    assert.equal((await getEntitlements(db, ownerId, aiConfig().policy, NOW)).plan, 'free');
  } finally { db.close(); }
});

test('ad eligibility permits only reviewed consenting adult surfaces and no premium session', () => {
  const eligible: AdContext = { enabled: true, surface: 'lobby', sessionState: 'LOBBY', premiumSession: false, adultAudienceVerified: true, audienceContext: 'adult_private', reviewedEligibility: true, providerApproved: true, geographyApproved: true, consent: 'granted' };
  assert.equal(adEligibility(eligible).eligible, true);
  for (const state of STATES) assert.equal(adEligibility({ ...eligible, surface: 'editor', sessionState: state }).eligible, ['LOBBY', 'SESSION_COMPLETED'].includes(state), state);
  for (const context of [
    { ...eligible, enabled: false }, { ...eligible, premiumSession: true }, { ...eligible, premiumSession: undefined },
    { ...eligible, premiumViewer: true }, { ...eligible, surface: 'player' }, { ...eligible, audienceContext: 'general' as const },
    { ...eligible, consent: 'unknown' as const }, { ...eligible, reviewedEligibility: false }, { ...eligible, geographyApproved: false },
    { ...eligible, providerApproved: false }, { ...eligible, adultAudienceVerified: false },
  ]) assert.equal(adEligibility(context).eligible, false);
  assert.equal(adEligibility({ ...eligible, surface: 'results', sessionState: 'SESSION_COMPLETED' }).eligible, true);
  assert.equal(adEligibility({ ...eligible, surface: 'results' }).eligible, false);
});

test('Stripe verifies untouched bytes, all v1 rotation signatures, bounded timestamps and rejects replay age', async () => {
  const body = event();
  await verifyStripeSignature(body, signed(body), SECRET, NOW);
  await verifyStripeSignature(new TextEncoder().encode(body), `${signed(body)},v1=${'a'.repeat(64)}`, SECRET, NOW);
  for (const [raw, signature, now] of [
    [body + ' ', signed(body), NOW], [body, signed(body, NOW, 'wrong-secret'), NOW],
    [body, signed(body, NOW - 301000), NOW], [body, signed(body, NOW + 301000), NOW],
    [body, `t=${NOW / 1000},v0=${'a'.repeat(64)}`, NOW], [body, `${signed(body)},t=1`, NOW],
  ] as const) await assert.rejects(verifyStripeSignature(raw, signature, SECRET, now), domainCode('INVALID_WEBHOOK_SIGNATURE'));
  await assert.rejects(verifyStripeSignature(body, signed(body), SECRET, NOW, 0), domainCode('INVALID_WEBHOOK_SIGNATURE'));
});

test('Stripe repeated signed event reconciles once and stores one event and one entitlement', async () => {
  const { db, ownerId } = await fixture(false);
  try {
    await bindBillingCustomer(db, ownerId, 'cus_test1', NOW);
    let calls = 0;
    const http: typeof fetch = async () => { calls++; return Response.json(snapshot()); };
    const body = event();
    const first = await processStripeWebhook(db, body, signed(body), stripeConfig(), { fetch: http, now: () => NOW });
    assert.deepEqual(first, { accepted: true, eventId: 'evt_test1', duplicate: false, status: 'processed' });
    for (let i = 0; i < 3; i++) assert.equal((await processStripeWebhook(db, body, signed(body), stripeConfig(), { fetch: http, now: () => NOW })).duplicate, true);
    assert.equal(calls, 1);
    assert.equal((await db.query('SELECT * FROM billing_webhook_events')).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM subscriptions')).rows.length, 1);
    assert.equal((await getEntitlements(db, ownerId, aiConfig().policy, NOW)).plan, 'premium');
    assert.equal((await db.query('SELECT cancel_at_period_end FROM subscriptions')).rows[0].cancel_at_period_end, 1);
  } finally { db.close(); }
});

test('Stripe concurrent duplicate receipts serialize provider reconciliation and preserve customer binding', async () => {
  const { db, ownerId } = await fixture(false);
  try {
    await bindBillingCustomer(db, ownerId, 'cus_test1', NOW);
    let calls = 0;
    const http: typeof fetch = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return Response.json(snapshot()); };
    const body = event();
    await Promise.all(Array.from({ length: 10 }, () => processStripeWebhook(db, body, signed(body), stripeConfig(), { fetch: http, now: () => NOW })));
    assert.equal(calls, 1);
    assert.equal((await db.query('SELECT status FROM billing_webhook_events')).rows[0].status, 'processed');
    await assert.rejects(bindBillingCustomer(db, ownerId, 'cus_other', NOW), domainCode('CUSTOMER_BINDING_CONFLICT'));
  } finally { db.close(); }
});

test('Stripe ignores event order, client owner metadata and unknown prices; unbound customers get no entitlement', async () => {
  const { db, ownerId } = await fixture(false);
  try {
    const body = event();
    let calls = 0;
    const http: typeof fetch = async () => { calls++; return Response.json(snapshot('active', 'price_unapproved')); };
    assert.equal((await processStripeWebhook(db, body, signed(body), stripeConfig(), { fetch: http, now: () => NOW })).status, 'pending');
    assert.equal(calls, 0);
    assert.equal((await db.query('SELECT * FROM subscriptions')).rows.length, 0);
    await bindBillingCustomer(db, ownerId, 'cus_test1', NOW);
    await processStripeWebhook(db, body, signed(body), stripeConfig(), { fetch: http, now: () => NOW });
    assert.equal((await getEntitlements(db, ownerId, aiConfig().policy, NOW)).plan, 'free');
    const older = event('evt_older');
    await processStripeWebhook(db, older, signed(older), stripeConfig(), { fetch: async () => Response.json(snapshot('canceled')), now: () => NOW });
    assert.equal((await db.query('SELECT status FROM subscriptions')).rows[0].status, 'canceled');
  } finally { db.close(); }
});

test('Stripe bad signature, wrong environment and changed body under same ID cannot mutate state', async () => {
  const { db, ownerId } = await fixture(false);
  try {
    await bindBillingCustomer(db, ownerId, 'cus_test1', NOW);
    const body = event();
    const dep = { fetch: (async () => Response.json(snapshot())) as typeof fetch, now: () => NOW };
    await assert.rejects(processStripeWebhook(db, body, signed(body, NOW, 'incorrect'), stripeConfig(), dep), domainCode('INVALID_WEBHOOK_SIGNATURE'));
    assert.equal((await db.query('SELECT * FROM billing_webhook_events')).rows.length, 0);
    await assert.rejects(processStripeWebhook(db, body, signed(body), { ...stripeConfig(), liveMode: true }, dep), domainCode('WEBHOOK_MODE_MISMATCH'));
    await processStripeWebhook(db, body, signed(body), stripeConfig(), dep);
    const changed = JSON.stringify({ ...JSON.parse(body), created: 2 });
    await assert.rejects(processStripeWebhook(db, changed, signed(changed), stripeConfig(), dep), domainCode('WEBHOOK_EVENT_CONFLICT'));
  } finally { db.close(); }
});

test('AI model authority is discarded and model-suggested sources remain unverified review candidates', () => {
  const raw = getDemoQuiz();
  raw.rounds[0].provenance = 'verified_factual';
  raw.rounds[0].sourceUrl = 'https://example.org/unverified-model-claim';
  const draft = prepareAiDraft(raw, request());
  assert.ok(draft.quiz.rounds.every(round => round.provenance === 'needs_review'));
  assert.ok(draft.quiz.rounds.every(round => round.sourceUrl === undefined));
  assert.equal(draft.sourceCandidates[0].status, 'unverified');
  assert.equal(draft.reviewRequired, true);
  assert.ok(validateQuiz(draft.quiz).some(issue => issue.field === 'provenance'));
  const missing = JSON.parse(JSON.stringify(raw));
  delete missing.rounds[0].secretConfig.answer;
  assert.throws(() => prepareAiDraft(missing, request()), domainCode('AI_INVALID_OUTPUT'));
  assert.throws(() => prepareAiDraft(raw, { ...request(), roundCount: 6 }), domainCode('AI_INVALID_OUTPUT'));
});

test('measured cost accounts for cached input separately and rejects missing or impossible usage', () => {
  assert.equal(calculateAiCost({ inputTokens: 100, cachedInputTokens: 20, outputTokens: 50 }, aiConfig().prices!), 570);
  assert.throws(() => calculateAiCost({ inputTokens: 100, cachedInputTokens: 101, outputTokens: 0 }, aiConfig().prices!));
  assert.throws(() => calculateAiCost({ inputTokens: NaN, cachedInputTokens: 0, outputTokens: 0 }, aiConfig().prices!));
});

test('AI concurrent request-key retries reserve exactly one unit and reject changed content', async () => {
  const { db, ownerId } = await fixture();
  try {
    const input = request();
    const jobs = await Promise.all(Array.from({ length: 20 }, () => enqueueAiDraft(db, ownerId, input, aiConfig(1), NOW)));
    assert.equal(new Set(jobs.map(job => job.id)).size, 1);
    assert.deepEqual(await aiQuota(db, ownerId, NOW), { allowance: 1, reserved: 1, consumed: 0, remaining: 0 });
    assert.equal((await db.query('SELECT * FROM usage_ledger')).rows.length, 1);
    await assert.rejects(enqueueAiDraft(db, ownerId, { ...input, prompt: 'Different request content.' }, aiConfig(1), NOW), domainCode('IDEMPOTENCY_CONFLICT'));
    await assert.rejects(enqueueAiDraft(db, ownerId, request(), aiConfig(1), NOW), domainCode('AI_QUOTA_EXCEEDED'));
    await assert.rejects(getAiJob(db, jobs[0].id, crypto.randomUUID()), domainCode('NOT_FOUND'));
  } finally { db.close(); }
});

test('AI quota is an atomic server boundary under competing distinct requests', async () => {
  const { db, ownerId } = await fixture();
  try {
    const jobs = await Promise.allSettled(Array.from({ length: 12 }, () => enqueueAiDraft(db, ownerId, request(), aiConfig(2), NOW)));
    assert.equal(jobs.filter(job => job.status === 'fulfilled').length, 2);
    assert.equal(jobs.filter(job => job.status === 'rejected').length, 10);
    assert.deepEqual(await aiQuota(db, ownerId, NOW), { allowance: 2, reserved: 2, consumed: 0, remaining: 0 });
    assert.equal((await db.query('SELECT * FROM ai_jobs')).rows.length, 2);
  } finally { db.close(); }
});

test('AI worker sends actual structured request, persists review-only result and settles measured cost once', async () => {
  const { db, ownerId } = await fixture();
  try {
    const job = await enqueueAiDraft(db, ownerId, request(), aiConfig(), NOW);
    let calls = 0;
    const http: typeof fetch = async (url, init) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, 'configured-test-model');
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.text.format.type, 'json_schema');
      return Response.json(modelResponse());
    };
    assert.equal((await runAiWorkerTick(db, aiConfig(), { fetch: http, now: () => NOW })).status, 'succeeded');
    assert.equal((await runAiWorkerTick(db, aiConfig(), { fetch: http, now: () => NOW })).processed, false);
    const final = await getAiJob(db, job.id, ownerId);
    assert.equal(calls, 1);
    assert.equal(final.estimatedCostMicros, 570);
    assert.equal(final.inputTokens, 100);
    assert.ok(final.draft?.quiz.rounds.every(round => round.provenance === 'needs_review'));
    assert.deepEqual(await aiQuota(db, ownerId, NOW), { allowance: 2, reserved: 0, consumed: 1, remaining: 1 });
    assert.equal((await db.query('SELECT * FROM usage_ledger')).rows.length, 3);
  } finally { db.close(); }
});

test('AI known rate limit retries durably without duplicate quota consumption', async () => {
  const { db, ownerId } = await fixture();
  try {
    const job = await enqueueAiDraft(db, ownerId, request(), aiConfig(), NOW);
    assert.equal((await runAiWorkerTick(db, aiConfig(), { fetch: async () => new Response('{}', { status: 429, headers: { 'retry-after': '2' } }), now: () => NOW })).status, 'retry');
    assert.equal((await runAiWorkerTick(db, aiConfig(), { now: () => NOW + 1000 })).processed, false);
    assert.equal((await runAiWorkerTick(db, aiConfig(), { fetch: async () => Response.json(modelResponse()), now: () => NOW + 2000 })).status, 'succeeded');
    assert.equal((await getAiJob(db, job.id, ownerId)).attempts, 2);
    assert.equal((await aiQuota(db, ownerId, NOW)).consumed, 1);
    assert.equal((await db.query("SELECT * FROM usage_ledger WHERE kind LIKE 'ai_provider_attempt_%'")).rows.length, 1);
  } finally { db.close(); }
});

test('AI invalid output records observed cost, releases reservation and never creates a fallback quiz', async () => {
  const { db, ownerId } = await fixture();
  try {
    const job = await enqueueAiDraft(db, ownerId, request(), aiConfig(), NOW);
    await runAiWorkerTick(db, aiConfig(), { fetch: async () => Response.json(modelResponse({ title: 'Fabricated', rounds: [] })), now: () => NOW });
    const final = await getAiJob(db, job.id, ownerId);
    assert.equal(final.status, 'failed');
    assert.equal(final.lastErrorCode, 'AI_INVALID_OUTPUT');
    assert.equal(final.estimatedCostMicros, 570);
    assert.equal(final.draft, undefined);
    assert.deepEqual(await aiQuota(db, ownerId, NOW), { allowance: 2, reserved: 0, consumed: 0, remaining: 2 });
    assert.equal((await db.query('SELECT * FROM quizzes')).rows.length, 0);
  } finally { db.close(); }
});

test('AI ambiguous network outcome and crashed lease hold quota without automatic repeat calls', async () => {
  const { db, ownerId } = await fixture();
  try {
    const first = await enqueueAiDraft(db, ownerId, request(), aiConfig(), NOW);
    let calls = 0;
    const http: typeof fetch = async () => { calls++; throw new Error('Connection lost after request write'); };
    await runAiWorkerTick(db, aiConfig(), { fetch: http, now: () => NOW });
    assert.equal((await getAiJob(db, first.id, ownerId)).status, 'reconciliation_required');
    await runAiWorkerTick(db, aiConfig(), { fetch: http, now: () => NOW + 60000 });
    assert.equal(calls, 1);
    const second = await enqueueAiDraft(db, ownerId, request(), aiConfig(), NOW);
    assert.ok(await claimAiJob(db, aiConfig(), NOW));
    await runAiWorkerTick(db, aiConfig(), { fetch: http, now: () => NOW + 60000 });
    assert.equal((await getAiJob(db, second.id, ownerId)).lastErrorCode, 'AI_WORKER_LEASE_EXPIRED');
    assert.equal(calls, 1);
    assert.deepEqual(await aiQuota(db, ownerId, NOW), { allowance: 2, reserved: 2, consumed: 0, remaining: 0 });
  } finally { db.close(); }
});

test('AI revoked entitlement is rechecked at execution before any provider call', async () => {
  const { db, ownerId } = await fixture();
  try {
    const job = await enqueueAiDraft(db, ownerId, request(), aiConfig(), NOW);
    await db.query("UPDATE subscriptions SET status='canceled' WHERE owner_id=?", [ownerId]);
    let calls = 0;
    await runAiWorkerTick(db, aiConfig(), { fetch: async () => { calls++; return Response.json(modelResponse()); }, now: () => NOW });
    assert.equal(calls, 0);
    assert.equal((await getAiJob(db, job.id, ownerId)).lastErrorCode, 'ENTITLEMENT_REQUIRED');
    assert.equal((await aiQuota(db, ownerId, NOW)).reserved, 0);
  } finally { db.close(); }
});
