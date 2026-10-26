import { writeFile, mkdir } from 'node:fs/promises';
import { z } from 'zod';
import { getDemoQuiz } from '../packages/game-modes/src/index';
import { FermiSchema, RareSchema, WordSchema, SizeSchema, AmountSchema, QuizInputSchema, HostActionSchema, SubmitSchema, WordGuessSchema, STATES } from '../packages/contracts/src/index';

type Schema = Record<string, unknown>;
/** Use the public Zod converter; private schema internals change across releases. */
export function jsonSchema(schema:z.ZodType):Schema {
  const { $schema: dialect, ...result }=z.toJSONSchema(schema,{target:'draft-2020-12',io:'input'});
  return result;
}
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const object = (properties: Record<string, unknown>, required = Object.keys(properties)): Schema => ({ type: 'object', properties, required });
const string = { type: 'string' };
const identifier = { type: 'string', format: 'uuid' };
const integer = { type: 'integer', minimum: 0 };
const iso = { type: 'string', format: 'date-time' };
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] });
const array = (items: Schema): Schema => ({ type: 'array', items });
const envelope = (schema: Schema): Schema => object({ data: schema, meta: object({ requestId: identifier, serverTime: iso }) });
const schemas: Record<string, Schema> = {
  FermiRound: jsonSchema(FermiSchema), RareRound: jsonSchema(RareSchema), WordRound: jsonSchema(WordSchema), SizeRound: jsonSchema(SizeSchema), AmountRound: jsonSchema(AmountSchema),
  Round: { oneOf: ['FermiRound', 'RareRound', 'WordRound', 'SizeRound', 'AmountRound'].map(ref), discriminator: { propertyName: 'mode' }, description: 'Creator-only full round configuration. secretConfig is never included in player/display snapshots.' },
  QuizInput: jsonSchema(QuizInputSchema), HostAction: jsonSchema(HostActionSchema), SubmissionInput: jsonSchema(SubmitSchema), WordGuessInput: jsonSchema(WordGuessSchema),
  Error: object({ error: object({ code: string, message: string, requestId: identifier, details: {} }, ['code', 'message', 'requestId']) }),
  Quiz: { allOf: [ref('QuizInput'), object({ id: identifier, ownerId: identifier, revision: integer, status: { enum: ['draft', 'published', 'archived'] }, publishedVersionId: identifier, createdAt: iso, updatedAt: iso }, ['id', 'ownerId', 'revision', 'status', 'createdAt', 'updatedAt'])] },
  QuizVersion: object({ id: identifier, quizId: identifier, version: integer, title: string, theme: string, rounds: array(ref('Round')), createdAt: iso }),
  Member: object({ id: identifier, nickname: string, status: { enum: ['active', 'kicked'] }, joinedAt: iso }),
  Leader: object({ participantId: identifier, nickname: string, points: integer, rank: integer, roundPoints: integer }),
  Ack: object({ clientMutationId: identifier, accepted: { const: true }, serverRevision: integer, acceptedAt: iso, feedback: array({ enum: ['exact', 'present', 'absent'] }), solved: { type: 'boolean' }, attempt: integer }, ['clientMutationId', 'accepted', 'serverRevision', 'acceptedAt']),
  StateReceipt: object({ state: { enum: STATES }, stateVersion: integer }),
  Validation: object({ valid: { type: 'boolean' }, issues: array(object({ roundId: identifier, field: string, message: string, severity: { enum: ['error', 'warning'] } }, ['field', 'message', 'severity'])), estimatedDurationSeconds: integer }),
  Features: object({ ai: { const: false }, billing: { const: false }, ads: { const: false }, stage: { enum: ['development', 'private_alpha', 'beta', 'public'] }, transport: { enum: ['polling', 'socket'] } }),
  Profile: object({ id: identifier, displayName: string, features: ref('Features'), plan: { const: 'free' }, quotaRemaining: { const: 0 } }),
};
schemas.CreateQuizInput = { ...schemas.QuizInput, required: ['title'] };
schemas.PatchQuizInput = { ...schemas.QuizInput, properties: { ...(schemas.QuizInput.properties as Schema), expectedRevision: { type: 'integer', minimum: 1 } }, required: ['expectedRevision'] };
const modes = [FermiSchema, RareSchema, WordSchema, SizeSchema, AmountSchema];
schemas.PublicRound = { oneOf: modes.map(schema => {
  const full = jsonSchema(schema); const properties = { ...(full.properties as Record<string, unknown>) };
  for (const key of ['secretConfig', 'provenance', 'sourceUrl', 'explanation']) delete properties[key];
  return { type: 'object', properties, required: [...new Set([...(full.required as string[]).filter(key => key in properties), 'allowRevision'])], additionalProperties: false };
}), discriminator: { propertyName: 'mode' } };
schemas.Submission = object({ id: identifier, roundId: identifier, participantId: identifier, clientMutationId: identifier, revision: integer, payload: (jsonSchema(SubmitSchema).properties as Record<string, Schema>).payload, acceptedAt: iso });
schemas.WordAttempt = object({ id: identifier, roundId: identifier, participantId: identifier, clientMutationId: identifier, attempt: integer, guess: string, feedback: array({ enum: ['exact', 'present', 'absent'] }), solved: { type: 'boolean' }, acceptedAt: iso });
schemas.Reveal = object({ answer: { type: ['string', 'number'] }, unit: string, explanation: string, sourceUrl: string, provenance: { enum: ['verified_factual', 'creator_confirmed', 'host_judged', 'needs_review'] }, skipped: { type: 'boolean' }, distribution: array(object({ label: string, value: { type: 'number' }, points: integer })), groups: array(object({ answer: string, count: integer, points: integer })), trueRatio: { type: 'number' } }, ['answer', 'provenance', 'skipped']);
schemas.Snapshot = object({ id: identifier, title: string, theme: string, role: { enum: ['host', 'player', 'display'] }, state: { enum: STATES }, stateVersion: integer, serverTime: iso, latestSeq: integer, deadlineAt: nullable(iso), pausedRemainingMs: nullable(integer), roundIndex: { type: 'integer', minimum: -1 }, roundCount: integer, round: nullable(ref('PublicRound')), pin: { type: 'string', pattern: '^\\d{6}$', description: 'Present only for the authenticated host.' }, joinLocked: { type: 'boolean' }, members: array(ref('Member')), participantId: identifier, ownSubmission: ref('Submission'), ownAttempts: array(ref('WordAttempt')), ownPoints: integer, answerCount: integer, solvedCount: integer, leaderboard: array(ref('Leader')), reveal: { ...ref('Reveal'), description: 'Only included once the host has revealed this round; completed and aborted views preserve an already published reveal.' }, review: array(object({ answerKey: string, text: string, count: integer })), maxPlayers: integer }, ['id', 'title', 'theme', 'role', 'state', 'stateVersion', 'serverTime', 'latestSeq', 'deadlineAt', 'pausedRemainingMs', 'roundIndex', 'roundCount', 'round', 'joinLocked', 'members', 'ownAttempts', 'answerCount', 'solvedCount', 'leaderboard', 'maxPlayers']);
const paths: Record<string, Record<string, unknown>> = {};
function route(path: string, method: string, summary: string, response: Schema, options: { body?: Schema; created?: boolean; auth?: 'creator' | 'scoped' | 'public'; key?: boolean; description?: string; query?: object[] } = {}) {
  const parameters: object[] = [...path.matchAll(/\{([^}]+)\}/g)].map(match => ({ in: 'path', name: match[1], required: true, schema: match[1] === 'pairToken' ? string : identifier }));
  if (options.key) parameters.push({ in: 'header', name: 'Idempotency-Key', required: true, schema: { type: 'string', minLength: 8, maxLength: 128, pattern: '^[A-Za-z0-9._:-]+$' } });
  if (method !== 'get') parameters.push({ in: 'header', name: 'Origin', required: true, schema: { type: 'string', format: 'uri' }, description: 'Browser cookie-authenticated mutations require the exact origin serving the application.' });
  parameters.push(...options.query ?? []);
  const security = options.auth === 'public' ? [] : options.auth === 'scoped' ? [{ CreatorCookie: [] }, { ParticipantCookie: [] }, { DisplayToken: [] }] : [{ CreatorCookie: [] }];
  const responses: Record<string, unknown> = { [options.created ? '201' : '200']: { description: 'Committed response', content: { 'application/json': { schema: envelope(response) } } } };
  for (const status of [400, 401, 403, 404, 409, 413, 422, 429, 500, 503]) responses[status] = { description: ({ 400: 'Malformed request', 401: 'Missing or expired authentication', 403: 'Forbidden role or origin', 404: 'Unavailable resource', 409: 'State/revision conflict', 413: 'Payload too large', 422: 'Invalid fields or configuration', 429: 'Rate limited', 500: 'Internal failure; retry same key', 503: 'Feature unavailable' } as Record<number, string>)[status], content: { 'application/json': { schema: ref('Error') } } };
  (paths[path] ??= {})[method] = { operationId: `${method}_${path.replace(/[{}]/g, '').replace(/[^a-zA-Z0-9]+/g, '_')}`, summary, ...(options.description ? { description: options.description } : {}), security, parameters, ...(options.body ? { requestBody: { required: true, content: { 'application/json': { schema: options.body } } } } : {}), responses };
}
route('/me', 'get', 'Current verified creator or null', nullable(ref('Profile')), { auth: 'public' });
route('/features', 'get', 'Actual launch flags', ref('Features'), { auth: 'public' });
route('/health', 'get', 'Database readiness', object({ status: string, persistence: string, stage: string }), { auth: 'public' });
route('/demo', 'get', 'Explicitly marked public starter fixture', ref('QuizInput'), { auth: 'public' });
route('/quizzes', 'get', 'Owned private drafts', array(ref('Quiz')));
route('/quizzes', 'post', 'Create a private quiz', ref('Quiz'), { body: ref('CreateQuizInput'), created: true, key: true });
route('/quizzes/{id}', 'get', 'Owner-only full configuration', ref('Quiz'));
route('/quizzes/{id}', 'patch', 'Save a draft with optimistic revision', ref('Quiz'), { key: true, body: ref('PatchQuizInput') });
route('/quizzes/{id}', 'delete', 'Archive a quiz', object({ archived: { const: true }, quizId: identifier }), { key: true });
route('/quizzes/{id}/preview', 'post', 'Validate and estimate play duration', ref('Validation'), { body: object({}) });
route('/quizzes/{id}/duplicate', 'post', 'Duplicate a private quiz', ref('Quiz'), { body: object({}), key: true, created: true });
route('/quizzes/{id}/versions', 'post', 'Open the mutable working version', ref('Quiz'), { key: true, created: true, body: object({ sourceVersionId: identifier, expectedRevision: integer }, []), description: 'The mutable draft versionId is the quiz UUID. Published version UUIDs remain immutable. Optionally replace the working draft from an owned historical version.' });
route('/quizzes/{id}/publish', 'post', 'Publish an immutable quiz version', ref('QuizVersion'), { key: true, created: true, body: object({ expectedRevision: integer }, []) });
route('/versions/{id}', 'get', 'Read an owned immutable publication', ref('QuizVersion'));
route('/versions/{id}/rounds', 'post', 'Append to a mutable working version', object({ roundId: identifier, revision: integer, quiz: ref('Quiz') }), { key: true, created: true, body: object({ round: ref('Round'), expectedRevision: integer }, ['round']) });
route('/versions/{id}/reorder', 'post', 'Reorder the exact existing round permutation', ref('Quiz'), { key: true, body: object({ roundIds: array(identifier), expectedRevision: integer }, ['roundIds']) });
route('/versions/{id}/validate', 'post', 'Validate a draft', ref('Validation'), { body: object({}) });
route('/versions/{id}/publish', 'post', 'Publish a mutable working version', ref('QuizVersion'), { key: true, created: true, body: object({ expectedRevision: integer }, []) });
route('/rounds/{id}', 'patch', 'Edit an owned draft round', ref('Quiz'), { key: true, body: object({ quizId: identifier, round: ref('Round'), expectedRevision: integer }, ['round']) });
route('/rounds/{id}', 'delete', 'Delete an owned draft round', ref('Quiz'), { key: true, query: [{ in: 'query', name: 'quizId', schema: identifier }, { in: 'query', name: 'expectedRevision', schema: integer }] });
route('/sessions', 'post', 'Create a session on an immutable version', object({ sessionId: identifier, pin: string, hostUrl: string, joinUrl: string }), { body: object({ quizVersionId: identifier }), key: true, created: true });
route('/sessions/join', 'post', 'Join as a scoped guest', object({ sessionId: identifier, participantId: identifier, playUrl: string }), { body: object({ pin: { type: 'string', pattern: '^\\d{6}$' }, nickname: { type: 'string', minLength: 1, maxLength: 100 } }), created: true, auth: 'public', description: 'Sets HttpOnly SameSite=Lax mg_player_<sessionId> cookie. Nicknames are further constrained to 1–24 visible Unicode graphemes. PIN alone grants no creator authority.' });
for (const suffix of ['snapshot', 'results']) route(`/sessions/{id}/${suffix}`, 'get', 'Role-filtered canonical state', ref('Snapshot'), { auth: 'scoped', query: [{ in: 'query', name: 'role', schema: { enum: ['player', 'host'] } }] });
route('/sessions/{id}/events', 'get', 'Sequential neutral event notices', array(object({ eventId: identifier, sessionId: identifier, seq: integer, type: string, occurredAt: iso, stateVersion: integer, payload: object({ state: string, roundIndex: { type: 'integer' } }, []) })), { auth: 'scoped', query: [{ in: 'query', name: 'after', schema: integer }] });
route('/sessions/{id}/host-actions', 'post', 'Perform one version-checked host action', ref('StateReceipt'), { body: ref('HostAction'), key: true });
for (const suffix of ['submissions', 'answers']) route(`/sessions/{id}/${suffix}`, 'post', 'Submit an absolute, monotonic answer revision', ref('Ack'), { body: ref('SubmissionInput'), auth: 'scoped', description: 'Requires player cookie even for signed-in hosts. clientMutationId is the durable idempotency key. ACK is returned only after SQL commit; explicit locked=true rejects later changes.' });
route('/sessions/{id}/word-guesses', 'post', 'Submit a word attempt', ref('Ack'), { body: ref('WordGuessInput'), auth: 'scoped', description: 'Only own letters/feedback returned. Duplicate IDs replay the first ACK; duplicate words do not consume an attempt.' });
route('/sessions/{id}/rare-review', 'post', 'Adjudicate a pending normalized rare answer', ref('StateReceipt'), { key: true, body: object({ roundId: identifier, answerKey: string, decision: { enum: ['accept', 'reject'] }, canonical: string, expectedStateVersion: integer }, ['roundId', 'answerKey', 'decision', 'expectedStateVersion']) });
route('/sessions/{id}/display-pairing', 'post', 'Create an eight-hour read-only display link', object({ token: string, expiresAt: iso, displayUrl: string }), { body: object({}), key: true, created: true });
route('/sessions/{id}/display-pairing', 'delete', 'Revoke all room display credentials', object({ revoked: { const: true } }));
route('/display/{pairToken}/snapshot', 'get', 'Read a paired display snapshot', ref('Snapshot'), { auth: 'public', description: 'The 256-bit URL token is itself a scoped expiring credential. It grants no host controls and should not be shared publicly.' });
route('/reports', 'post', 'Record an abuse or support report', object({ receiptId: identifier, status: string, createdAt: iso }), { auth: 'public', created: true, body: object({ category: { type: 'string', minLength: 1, maxLength: 40 }, targetType: { type: 'string', maxLength: 30, default: 'general' }, targetId: { type: 'string', maxLength: 100 }, context: { type: 'string', minLength: 1, maxLength: 2000 } }, ['category', 'context']) });
route('/privacy/requests', 'post', 'Record a verified account export/deletion request', object({ receiptId: identifier, type: { enum: ['export', 'delete'] }, status: { const: 'pending' }, createdAt: iso, message: string }), { body: object({ type: { enum: ['export', 'delete'] } }), created: true });
route('/privacy/settings', 'get', 'Read stored privacy preferences', object({ analyticsConsent: { type: 'boolean' }, hideNickname: { type: 'boolean' } }), { description: 'Preferences are stored for future activation. No analytics tracking or nickname filtering is presently activated by these settings; product UI does not expose misleading controls.' });
route('/privacy/settings', 'patch', 'Store future privacy preferences', object({ analyticsConsent: { type: 'boolean' }, hideNickname: { type: 'boolean' } }), { body: object({ analyticsConsent: { type: 'boolean' }, hideNickname: { type: 'boolean' } }), description: 'Preference storage only; no claim of display anonymization is made.' });
route('/account/export', 'get', 'Export owned profile and quiz drafts', object({ account: object({ id: identifier, displayName: string }), quizzes: array(ref('Quiz')), exportedAt: iso, scope: string }));
route('/billing', 'get', 'Read billing availability', object({ enabled: { const: false }, plan: { const: 'free' }, status: { const: 'not_configured' }, message: string }), { auth: 'public' });
for (const [path, method] of [['/ai/generations', 'post'], ['/ai/generations/{id}', 'get'], ['/billing/checkout', 'post'], ['/billing/webhook', 'post']]) {
  route(path, method, 'Disabled launch integration', {}, { ...(method === 'post' ? { body: object({}) } : {}), description: 'Returns FEATURE_DISABLED (503). No provider calls, generation, payment charging, or webhook acceptance occurs.' });
  delete ((paths[path][method] as { responses: Record<string, unknown> }).responses)['200'];
}
const spec = { openapi: '3.1.0', info: { title: 'MULTIGAME API', version: '1.0.0-private-alpha', description: 'Generated from runtime Zod request contracts. Private quizzes, server-authoritative sessions, durable receipts, and explicit unavailable commercial integrations. Standard response envelope: {data,meta}; error envelope: {error}. Polling is always available; Node also provides scoped Socket.IO events.' }, servers: [{ url: '/api/v1' }], paths, components: { schemas, securitySchemes: { CreatorCookie: { type: 'apiKey', in: 'cookie', name: '__Host-mg_host', description: 'Node production cookie; development uses mg_host. Sites obtains creator identity through its verified server adapter instead.' }, ParticipantCookie: { type: 'apiKey', in: 'cookie', name: 'mg_player_<sessionId>', description: 'Actual name substitutes the UUID of the session. HttpOnly, SameSite=Lax, Secure on HTTPS; digest stored in SQL, seven-day expiry.' }, DisplayToken: { type: 'apiKey', in: 'query', name: 'displayToken', description: 'Expiring 256-bit read-only pairing credential; revoked independently by the host.' } } } };
await mkdir('docs/api', { recursive: true });
await writeFile('docs/api/openapi.json', JSON.stringify(spec, null, 2) + '\n');
const fixture = getDemoQuiz();
fixture.rounds = fixture.rounds.map((round, index) => ({ ...round, id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` }));
await mkdir('tests/fixtures', { recursive: true });
await writeFile('tests/fixtures/quiz-five-modes.json', JSON.stringify(fixture, null, 2) + '\n');
process.stdout.write(`Generated ${Object.keys(paths).length} paths and ${Object.keys(schemas).length} schemas.\n`);
