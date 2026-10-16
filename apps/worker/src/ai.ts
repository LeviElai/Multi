import { DomainError } from '../../../packages/contracts/src/index';
import type { SqlDatabase } from '../../../packages/db/src/types';
import { AiProviderError, generateAiDraft, validateAiConfig } from '../../../packages/commercial/src/ai-draft';
import type { AiConfig } from '../../../packages/commercial/src/ai-draft';
import { claimAiJob, finishAiAttempt } from '../../../packages/commercial/src/ai-jobs';
import { requireEntitlement } from '../../../packages/commercial/src/policy';

/** Run in a separate worker loop so provider latency cannot delay game deadlines. */
export async function runAiWorkerTick(
  db: SqlDatabase, config: AiConfig,
  dependencies: { fetch?: typeof fetch; now?: () => number; metric?: (value: { event: 'ai_job_attempt'; jobId: string; status: string; latencyMs: number; costMicros: number | null }) => void } = {},
): Promise<{ processed: boolean; jobId?: string; status?: string }> {
  if (!config.policy.aiEnabled || !config.policy.aiProcessingApproved) return { processed: false };
  validateAiConfig(config);
  const now = dependencies.now ?? Date.now;
  const job = await claimAiJob(db, config, now());
  if (!job) return { processed: false };
  const started = now();
  let status: string;
  let costMicros: number | null = null;
  try {
    await requireEntitlement(db, job.ownerId, 'ai', config.policy, now());
    if (job.attempts > config.maxAttempts) throw new DomainError('AI_RETRY_LIMIT', 'The AI retry budget is exhausted.', 422);
    const result = await generateAiDraft(job.request, { ...config, model: job.model, prices: job.prices }, dependencies);
    costMicros = result.usage.costMicros;
    const committed = await finishAiAttempt(db, job, { status: 'succeeded', ...result }, now());
    status = committed ? 'succeeded' : 'reconciliation_required';
  } catch (error) {
    const failure = error instanceof AiProviderError ? error
      : error instanceof DomainError ? new AiProviderError(error.code, error.message, 'failed')
        : new AiProviderError('AI_WORKER_OUTCOME_UNKNOWN', 'The job outcome needs reconciliation.', 'reconciliation_required');
    status = failure.outcome === 'retry' && job.attempts >= config.maxAttempts ? 'failed' : failure.outcome;
    costMicros = failure.usage?.costMicros ?? null;
    await finishAiAttempt(db, job, { status: status as 'failed' | 'retry' | 'reconciliation_required', errorCode: failure.code, usage: failure.usage, retryAfterMs: failure.retryAfterMs }, now());
  }
  dependencies.metric?.({ event: 'ai_job_attempt', jobId: job.id, status, latencyMs: Math.max(0, now() - started), costMicros });
  return { processed: true, jobId: job.id, status };
}
