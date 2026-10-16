import { DomainError } from '../../contracts/src/index';
import type { SqlDatabase, SqlStatement } from '../../db/src/types';
import { AI_PROMPT_VERSION, AI_SCHEMA_VERSION, AiRequestSchema, validateAiConfig } from './ai-draft';
import type { AiConfig, AiDraft, AiPrices, AiRequest, AiUsage } from './ai-draft';
import { requireEntitlement } from './policy';
import { sha256 } from './crypto';

export type AiJobStatus = 'queued' | 'running' | 'retry' | 'succeeded' | 'failed' | 'reconciliation_required';
export type AiJob = {
  id: string; ownerId: string; status: AiJobStatus; attempts: number; model: string;
  inputTokens: number; outputTokens: number; estimatedCostMicros: number;
  lastErrorCode: string | null; createdAt: string; updatedAt: string; draft?: AiDraft;
};
export type ClaimedAiJob = AiJob & {
  request: AiRequest; prices: AiPrices; quotaPeriod: string; leaseToken: string;
};
type Row = Record<string, unknown>;
const parseJson = <T>(value: unknown): T => (typeof value === 'string' ? JSON.parse(value) : value) as T;
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : String(value);
function view(row: Row): AiJob {
  return {
    id: String(row.id), ownerId: String(row.owner_id), status: row.status as AiJobStatus,
    attempts: Number(row.attempts), model: String(row.model_id), inputTokens: Number(row.input_tokens), outputTokens: Number(row.output_tokens),
    estimatedCostMicros: Number(row.estimated_cost_micros), lastErrorCode: row.last_error_code == null ? null : String(row.last_error_code),
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), ...(row.result_json ? { draft: parseJson<AiDraft>(row.result_json) } : {}),
  };
}

export async function getAiJob(db: SqlDatabase, id: string, ownerId: string): Promise<AiJob> {
  const row = (await db.query('SELECT * FROM ai_jobs WHERE id=? AND owner_id=?', [id, ownerId])).rows[0];
  if (!row) throw new DomainError('NOT_FOUND', 'The AI job is unavailable.', 404);
  return view(row);
}

/** Reserve allowance and create the job in one transaction, keyed by the creator's idempotency key. */
export async function enqueueAiDraft(
  db: SqlDatabase, ownerId: string, value: unknown, config: AiConfig, nowMs = Date.now(),
): Promise<AiJob> {
  validateAiConfig(config);
  const request = AiRequestSchema.parse(value);
  await requireEntitlement(db, ownerId, 'ai', config.policy, nowMs);
  if (request.quizId) {
    const quiz = (await db.query('SELECT owner_id,revision,status FROM quizzes WHERE id=? AND owner_id=?', [request.quizId, ownerId])).rows[0];
    if (!quiz) throw new DomainError('NOT_FOUND', 'The quiz is unavailable.', 404);
    if (quiz.status === 'archived' || request.quizRevision !== Number(quiz.revision)) throw new DomainError('VERSION_CONFLICT', 'Refresh the quiz before requesting an AI draft.', 409);
  }
  const hash = await sha256(JSON.stringify({ ...request, requestKey: undefined }));
  const prior = async () => (await db.query('SELECT * FROM ai_jobs WHERE owner_id=? AND request_key=?', [ownerId, request.requestKey])).rows[0];
  const existing = await prior();
  if (existing) {
    if (existing.request_hash !== hash) throw new DomainError('IDEMPOTENCY_CONFLICT', 'This request key was already used with different content.', 409);
    return view(existing);
  }
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const instant = new Date(nowMs).toISOString();
  const period = instant.slice(0, 7);
  const guard = 'EXISTS (SELECT 1 FROM ai_usage_periods WHERE owner_id=? AND period=? AND mutation_token=?)';
  const statements: SqlStatement[] = [
    { sql: 'INSERT INTO ai_usage_periods (owner_id,period,allowance,reserved,consumed) VALUES (?,?,?,0,0) ON CONFLICT(owner_id,period) DO UPDATE SET allowance=excluded.allowance', params: [ownerId, period, config.policy.monthlyAiAllowance] },
    { sql: 'UPDATE ai_usage_periods SET reserved=reserved+1,mutation_token=? WHERE owner_id=? AND period=? AND reserved+consumed<allowance', params: [token, ownerId, period] },
    { sql: `INSERT INTO ai_jobs (id,owner_id,quiz_id,prompt_version,model_id,status,response_schema_version,moderation_state,created_at,request_key,request_hash,request_json,quota_period,available_at,updated_at) SELECT ?,?,?,?,?,'queued',?,'needs_review',?,?,?,?,?,?,? WHERE ${guard}`, params: [id, ownerId, request.quizId ?? null, AI_PROMPT_VERSION, config.model!, AI_SCHEMA_VERSION, instant, request.requestKey, hash, JSON.stringify({ request, prices: config.prices }), period, instant, instant, ownerId, period, token] },
    { sql: "INSERT INTO usage_ledger (id,owner_id,job_id,kind,quantity,cost_micros,created_at) SELECT ?,?,?,'ai_reserve',1,0,? WHERE EXISTS (SELECT 1 FROM ai_jobs WHERE id=?)", params: [crypto.randomUUID(), ownerId, id, instant, id] },
  ];
  let reserved: boolean;
  try { reserved = Boolean((await db.batch(statements))[2].changes); }
  catch (error) {
    // A concurrent identical request may win the unique owner/request constraint.
    // Its losing transaction rolls back the allowance increment as well.
    const winner = await prior();
    if (winner) {
      if (winner.request_hash !== hash) throw new DomainError('IDEMPOTENCY_CONFLICT', 'This request key was already used with different content.', 409);
      return view(winner);
    }
    throw error;
  }
  if (!reserved) {
    const winner = await prior();
    if (winner && winner.request_hash === hash) return view(winner);
    if (winner) throw new DomainError('IDEMPOTENCY_CONFLICT', 'This request key was already used with different content.', 409);
    throw new DomainError('AI_QUOTA_EXCEEDED', 'Your AI generation allowance for this period is fully reserved or used.', 429);
  }
  return getAiJob(db, id, ownerId);
}

export async function aiQuota(db: SqlDatabase, ownerId: string, nowMs = Date.now()): Promise<{ allowance: number; reserved: number; consumed: number; remaining: number }> {
  const row = (await db.query('SELECT allowance,reserved,consumed FROM ai_usage_periods WHERE owner_id=? AND period=?', [ownerId, new Date(nowMs).toISOString().slice(0, 7)])).rows[0];
  const allowance = Number(row?.allowance ?? 0), reserved = Number(row?.reserved ?? 0), consumed = Number(row?.consumed ?? 0);
  return { allowance, reserved, consumed, remaining: Math.max(0, allowance - reserved - consumed) };
}

/** Expired provider work is ambiguous, so it must never be silently reissued. */
export async function claimAiJob(db: SqlDatabase, config: AiConfig, nowMs = Date.now()): Promise<ClaimedAiJob | null> {
  const instant = new Date(nowMs).toISOString();
  await db.query("UPDATE ai_jobs SET status='reconciliation_required',last_error_code='AI_WORKER_LEASE_EXPIRED',lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE status='running' AND lease_expires_at<=?", [instant, instant]);
  const candidates = (await db.query("SELECT * FROM ai_jobs WHERE status IN ('queued','retry') AND available_at<=? ORDER BY available_at,created_at,id LIMIT 10", [instant])).rows;
  for (const candidate of candidates) {
    const token = crypto.randomUUID();
    const lease = new Date(nowMs + config.timeoutMs + 30000).toISOString();
    const claimed = await db.query("UPDATE ai_jobs SET status='running',attempts=attempts+1,lease_token=?,lease_expires_at=?,updated_at=? WHERE id=? AND status IN ('queued','retry') AND available_at<=?", [token, lease, instant, String(candidate.id), instant]);
    if (!claimed.changes) continue;
    const stored = parseJson<{ request: AiRequest; prices: AiPrices }>(candidate.request_json);
    return { ...view(candidate), status: 'running', attempts: Number(candidate.attempts) + 1, request: stored.request, prices: stored.prices, quotaPeriod: String(candidate.quota_period), leaseToken: token };
  }
  return null;
}

export type AiAttemptOutcome =
  | { status: 'succeeded'; draft: AiDraft; usage: AiUsage }
  | { status: 'retry' | 'failed' | 'reconciliation_required'; errorCode: string; usage?: AiUsage; retryAfterMs?: number };

/** The job's lease fences all ledger and quota writes; repeated completion has no effect. */
export async function finishAiAttempt(db: SqlDatabase, job: ClaimedAiJob, outcome: AiAttemptOutcome, nowMs = Date.now()): Promise<boolean> {
  const instant = new Date(nowMs).toISOString();
  const terminal = outcome.status === 'succeeded' || outcome.status === 'failed';
  const usage = outcome.usage;
  const delay = outcome.status === 'retry' ? outcome.retryAfterMs ?? Math.min(60000, 1000 * 2 ** (job.attempts - 1)) : 0;
  const guard = 'EXISTS (SELECT 1 FROM ai_jobs WHERE id=? AND lease_token=?)';
  const statements: SqlStatement[] = [{
    sql: 'UPDATE ai_jobs SET status=?,result_json=?,input_tokens=input_tokens+?,output_tokens=output_tokens+?,estimated_cost_micros=estimated_cost_micros+?,last_error_code=?,available_at=?,updated_at=? WHERE id=? AND lease_token=? AND status=\'running\'',
    params: [outcome.status, outcome.status === 'succeeded' ? JSON.stringify(outcome.draft) : null, usage?.inputTokens ?? 0, usage?.outputTokens ?? 0, usage?.costMicros ?? 0,
      outcome.status === 'succeeded' ? null : outcome.errorCode, new Date(nowMs + delay).toISOString(), instant, job.id, job.leaseToken],
  }];
  if (usage) statements.push({
    sql: `INSERT INTO usage_ledger (id,owner_id,job_id,kind,quantity,cost_micros,created_at) SELECT ?,?,?,?,?,?,? WHERE ${guard} ON CONFLICT(job_id,kind) DO NOTHING`,
    params: [crypto.randomUUID(), job.ownerId, job.id, `ai_provider_attempt_${job.attempts}`, usage.inputTokens + usage.outputTokens, usage.costMicros, instant, job.id, job.leaseToken],
  });
  if (terminal) {
    statements.push({
      sql: `UPDATE ai_usage_periods SET reserved=reserved-1,consumed=consumed+? WHERE owner_id=? AND period=? AND reserved>0 AND ${guard}`,
      params: [Number(outcome.status === 'succeeded'), job.ownerId, job.quotaPeriod, job.id, job.leaseToken],
    }, {
      sql: `INSERT INTO usage_ledger (id,owner_id,job_id,kind,quantity,cost_micros,created_at) SELECT ?,?,?,'ai_settle',?,0,? WHERE ${guard} ON CONFLICT(job_id,kind) DO NOTHING`,
      params: [crypto.randomUUID(), job.ownerId, job.id, Number(outcome.status === 'succeeded'), instant, job.id, job.leaseToken],
    });
  }
  statements.push({ sql: 'UPDATE ai_jobs SET lease_token=NULL,lease_expires_at=NULL WHERE id=? AND lease_token=?', params: [job.id, job.leaseToken] });
  const result = await db.batch(statements);
  return Boolean(result[0].changes);
}
