import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index, foreignKey, check } from 'drizzle-orm/sqlite-core';

// Canonical gameplay is relational. JSON is reserved for versioned configs,
// answer payloads, event/receipt bodies and score explanation payloads.
export const users=sqliteTable('users',{
  id:text('id').primaryKey(),externalId:text('external_id').notNull().unique(),displayName:text('display_name').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
});
export const quizzes=sqliteTable('quizzes',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>users.id),title:text('title').notNull(),description:text('description').notNull().default(''),language:text('language').notNull().default('en'),audienceContext:text('audience_context').notNull().default('adult_private'),theme:text('theme').notNull().default('studio'),revision:integer('revision').notNull().default(1),status:text('status').notNull().default('draft'),publishedVersionId:text('published_version_id'),lastMutationId:text('last_mutation_id').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('quizzes_owner_updated').on(t.ownerId,t.updatedAt),check('quizzes_revision_positive',sql`${t.revision}>0`),check('quizzes_status',sql`${t.status} IN ('draft','published','archived')`)]);
const roundColumns=()=>({
  id:text('id').notNull(),ordinal:integer('ordinal').notNull(),mode:text('mode').notNull(),schemaVersion:integer('schema_version').notNull().default(1),question:text('question').notNull(),timerSeconds:integer('timer_seconds').notNull(),maxPoints:integer('max_points').notNull().default(1000),provenance:text('provenance').notNull(),sourceUrl:text('source_url'),explanation:text('explanation'),allowRevision:integer('allow_revision').notNull().default(1),publicConfig:text('public_config').notNull(),secretConfig:text('secret_config').notNull(),scoringVersion:text('scoring_version').notNull().default('v3-1'),
});
export const draftRounds=sqliteTable('draft_rounds',{
  quizId:text('quiz_id').notNull().references(()=>quizzes.id,{onDelete:'cascade'}),...roundColumns(),
},t=>[primaryKey({columns:[t.quizId,t.id]}),uniqueIndex('draft_rounds_order').on(t.quizId,t.ordinal),check('draft_rounds_ordinal',sql`${t.ordinal}>=0`),check('draft_rounds_timer',sql`${t.timerSeconds} BETWEEN 10 AND 300`),check('draft_rounds_points',sql`${t.maxPoints}=1000`)]);
export const quizVersions=sqliteTable('quiz_versions',{
  id:text('id').primaryKey(),quizId:text('quiz_id').notNull().references(()=>quizzes.id),versionNum:integer('version_num').notNull(),title:text('title').notNull(),theme:text('theme').notNull(),status:text('status').notNull().default('published'),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('quiz_versions_number').on(t.quizId,t.versionNum),check('quiz_versions_number_positive',sql`${t.versionNum}>0`)]);
export const rounds=sqliteTable('rounds',{
  versionId:text('version_id').notNull().references(()=>quizVersions.id),...roundColumns(),
},t=>[primaryKey({columns:[t.versionId,t.id]}),uniqueIndex('rounds_order').on(t.versionId,t.ordinal),check('rounds_ordinal',sql`${t.ordinal}>=0`),check('rounds_timer',sql`${t.timerSeconds} BETWEEN 10 AND 300`),check('rounds_points',sql`${t.maxPoints}=1000`)]);
export const sessions=sqliteTable('sessions',{
  id:text('id').primaryKey(),versionId:text('version_id').notNull().references(()=>quizVersions.id),hostId:text('host_id').notNull().references(()=>users.id),pinDigest:text('pin_digest').notNull().unique(),pin:text('pin').notNull(),state:text('state').notNull(),stateVersion:integer('state_version').notNull(),roundIndex:integer('round_index').notNull(),deadlineAt:text('deadline_at'),pausedRemainingMs:integer('paused_remaining_ms'),extensionCount:integer('extension_count').notNull().default(0),joinLocked:integer('join_locked').notNull().default(0),createdAt:text('created_at').notNull(),completedAt:text('completed_at'),lastMutationId:text('last_mutation_id').notNull(),latestSeq:integer('latest_seq').notNull().default(0),maxPlayers:integer('max_players').notNull().default(100),
},t=>[uniqueIndex('sessions_id_version').on(t.id,t.versionId),index('sessions_due').on(t.state,t.deadlineAt),index('sessions_host_created').on(t.hostId,t.createdAt),check('sessions_state_version',sql`${t.stateVersion}>=0`),check('sessions_latest_seq',sql`${t.latestSeq}>=0`),check('sessions_player_cap',sql`${t.maxPlayers} BETWEEN 1 AND 1000`),check('sessions_state',sql`${t.state} IN ('LOBBY','ROUND_PREPARE','ROUND_COUNTDOWN','ROUND_ACTIVE','PAUSED','ROUND_LOCKED','ROUND_EVALUATING','REVIEW_REQUIRED','ROUND_SCORED','ROUND_REVEAL','INTERMISSION','SESSION_COMPLETED','SESSION_ABORTED')`)]);
export const sessionRounds=sqliteTable('session_rounds',{
  sessionId:text('session_id').notNull().references(()=>sessions.id),roundId:text('round_id').notNull(),versionId:text('version_id').notNull(),ordinal:integer('ordinal').notNull(),voided:integer('voided').notNull().default(0),
},t=>[primaryKey({columns:[t.sessionId,t.roundId]}),uniqueIndex('session_rounds_order').on(t.sessionId,t.ordinal),foreignKey({columns:[t.sessionId,t.versionId],foreignColumns:[sessions.id,sessions.versionId]}),foreignKey({columns:[t.versionId,t.roundId],foreignColumns:[rounds.versionId,rounds.id]})]);
export const participants=sqliteTable('participants',{
  id:text('id').primaryKey(),sessionId:text('session_id').notNull().references(()=>sessions.id),nickname:text('nickname').notNull(),displayNameNorm:text('display_name_norm').notNull(),tokenDigest:text('token_digest').notNull().unique(),tokenExpiresAt:text('token_expires_at').notNull(),status:text('status').notNull().default('active'),joinedAt:text('joined_at').notNull(),lastSeenAt:text('last_seen_at').notNull(),kickedAt:text('kicked_at'),
},t=>[uniqueIndex('participants_session_id').on(t.sessionId,t.id),index('participants_session_status').on(t.sessionId,t.status),check('participants_status',sql`${t.status} IN ('active','kicked')`)]);
export const displayPairings=sqliteTable('display_pairings',{
  id:text('id').primaryKey(),sessionId:text('session_id').notNull().references(()=>sessions.id),tokenDigest:text('token_digest').notNull().unique(),expiresAt:text('expires_at').notNull(),createdAt:text('created_at').notNull(),revokedAt:text('revoked_at'),
},t=>[index('display_pairings_session').on(t.sessionId)]);
export const submissions=sqliteTable('submissions',{
  id:text('id').primaryKey(),sessionId:text('session_id').notNull(),roundId:text('round_id').notNull(),participantId:text('participant_id').notNull(),clientMutationId:text('client_mutation_id').notNull(),revision:integer('revision').notNull(),payload:text('payload').notNull(),acceptedAt:text('accepted_at').notNull(),
},t=>[uniqueIndex('submissions_mutation').on(t.sessionId,t.participantId,t.roundId,t.clientMutationId),uniqueIndex('submissions_revision').on(t.sessionId,t.participantId,t.roundId,t.revision),foreignKey({columns:[t.sessionId,t.roundId],foreignColumns:[sessionRounds.sessionId,sessionRounds.roundId]}),foreignKey({columns:[t.sessionId,t.participantId],foreignColumns:[participants.sessionId,participants.id]}),check('submissions_revision_positive',sql`${t.revision}>0`)]);
export const wordAttempts=sqliteTable('word_attempts',{
  id:text('id').primaryKey(),sessionId:text('session_id').notNull(),roundId:text('round_id').notNull(),participantId:text('participant_id').notNull(),clientMutationId:text('client_mutation_id').notNull(),attempt:integer('attempt').notNull(),guess:text('guess').notNull(),feedback:text('feedback').notNull(),solved:integer('solved').notNull(),acceptedAt:text('accepted_at').notNull(),
},t=>[uniqueIndex('word_attempts_number').on(t.sessionId,t.roundId,t.participantId,t.attempt),uniqueIndex('word_attempts_mutation').on(t.sessionId,t.participantId,t.clientMutationId),foreignKey({columns:[t.sessionId,t.roundId],foreignColumns:[sessionRounds.sessionId,sessionRounds.roundId]}),foreignKey({columns:[t.sessionId,t.participantId],foreignColumns:[participants.sessionId,participants.id]}),check('word_attempts_positive',sql`${t.attempt}>0`)]);
export const adjudications=sqliteTable('adjudications',{
  id:text('id').primaryKey(),sessionId:text('session_id').notNull(),roundId:text('round_id').notNull(),answerKey:text('answer_key').notNull(),decision:text('decision').notNull(),canonical:text('canonical').notNull(),actorId:text('actor_id').notNull().references(()=>users.id),adjudicationRevision:integer('adjudication_revision').notNull(),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('adjudications_revision').on(t.sessionId,t.roundId,t.answerKey,t.adjudicationRevision),foreignKey({columns:[t.sessionId,t.roundId],foreignColumns:[sessionRounds.sessionId,sessionRounds.roundId]}),check('adjudications_decision',sql`${t.decision} IN ('accept','reject')`)]);
export const scoringRuns=sqliteTable('scoring_runs',{
  id:text('id').primaryKey(),sessionId:text('session_id').notNull(),roundId:text('round_id').notNull(),scoringRevision:integer('scoring_revision').notNull(),scorerVersion:text('scorer_version').notNull(),completedAt:text('completed_at').notNull(),
},t=>[uniqueIndex('scoring_runs_revision').on(t.sessionId,t.roundId,t.scoringRevision),uniqueIndex('scoring_runs_scope').on(t.sessionId,t.roundId,t.id),uniqueIndex('scoring_runs_session_id').on(t.sessionId,t.id),foreignKey({columns:[t.sessionId,t.roundId],foreignColumns:[sessionRounds.sessionId,sessionRounds.roundId]}),check('scoring_runs_revision_positive',sql`${t.scoringRevision}>0`)]);
export const roundScores=sqliteTable('round_scores',{
  scoringRunId:text('scoring_run_id').notNull(),sessionId:text('session_id').notNull(),participantId:text('participant_id').notNull(),points:integer('points').notNull(),reason:text('reason').notNull(),detail:text('detail').notNull(),
},t=>[primaryKey({columns:[t.scoringRunId,t.participantId]}),foreignKey({columns:[t.sessionId,t.scoringRunId],foreignColumns:[scoringRuns.sessionId,scoringRuns.id]}),foreignKey({columns:[t.sessionId,t.participantId],foreignColumns:[participants.sessionId,participants.id]}),check('round_scores_points',sql`${t.points} BETWEEN 0 AND 1000`)]);
export const roundScoreCurrent=sqliteTable('round_score_current',{
  sessionId:text('session_id').notNull(),roundId:text('round_id').notNull(),scoringRunId:text('scoring_run_id').notNull(),
},t=>[primaryKey({columns:[t.sessionId,t.roundId]}),foreignKey({columns:[t.sessionId,t.roundId,t.scoringRunId],foreignColumns:[scoringRuns.sessionId,scoringRuns.roundId,scoringRuns.id]})]);
export const sessionEvents=sqliteTable('session_events',{
  sessionId:text('session_id').notNull().references(()=>sessions.id),seq:integer('seq').notNull(),eventId:text('event_id').notNull().unique(),stateVersion:integer('state_version').notNull(),type:text('type').notNull(),roleScope:text('role_scope').notNull().default('all'),payload:text('payload').notNull(),occurredAt:text('occurred_at').notNull(),
},t=>[primaryKey({columns:[t.sessionId,t.seq]}),check('session_events_seq_positive',sql`${t.seq}>0`)]);
export const outbox=sqliteTable('outbox',{
  id:text('id').primaryKey(),sessionId:text('session_id').notNull().references(()=>sessions.id),eventId:text('event_id').notNull().unique().references(()=>sessionEvents.eventId),deliveryStatus:text('delivery_status').notNull().default('pending'),attempts:integer('attempts').notNull().default(0),createdAt:text('created_at').notNull(),deliveredAt:text('delivered_at'),
},t=>[index('outbox_pending').on(t.deliveryStatus,t.createdAt)]);
export const mutationReceipts=sqliteTable('mutation_receipts',{
  sessionId:text('session_id').notNull().references(()=>sessions.id),principalId:text('principal_id').notNull(),idempotencyKey:text('idempotency_key').notNull(),resultJson:text('result_json').notNull(),createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.sessionId,t.principalId,t.idempotencyKey]})]);
export const apiReceipts=sqliteTable('api_receipts',{
  principalId:text('principal_id').notNull(),idempotencyKey:text('idempotency_key').notNull(),resultJson:text('result_json').notNull(),createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.principalId,t.idempotencyKey]})]);
export const assets=sqliteTable('assets',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>users.id),storageKey:text('storage_key').notNull().unique(),contentType:text('content_type').notNull(),byteSize:integer('byte_size').notNull(),processingStatus:text('processing_status').notNull(),licenseAttestation:text('license_attestation'),calibration:text('calibration'),createdAt:text('created_at').notNull(),
});
export const aiJobs=sqliteTable('ai_jobs',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>users.id),quizId:text('quiz_id').references(()=>quizzes.id),promptVersion:text('prompt_version').notNull(),modelId:text('model_id').notNull(),status:text('status').notNull(),responseSchemaVersion:integer('response_schema_version').notNull(),inputTokens:integer('input_tokens').notNull().default(0),outputTokens:integer('output_tokens').notNull().default(0),estimatedCostMicros:integer('estimated_cost_micros').notNull().default(0),moderationState:text('moderation_state').notNull(),createdAt:text('created_at').notNull(),requestKey:text('request_key').notNull(),requestHash:text('request_hash').notNull(),requestJson:text('request_json').notNull(),resultJson:text('result_json'),quotaPeriod:text('quota_period').notNull(),attempts:integer('attempts').notNull().default(0),availableAt:text('available_at').notNull(),leaseToken:text('lease_token'),leaseExpiresAt:text('lease_expires_at'),lastErrorCode:text('last_error_code'),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('ai_jobs_request').on(t.ownerId,t.requestKey),index('ai_jobs_available').on(t.status,t.availableAt),check('ai_jobs_attempts',sql`${t.attempts}>=0`)]);
export const aiUsagePeriods=sqliteTable('ai_usage_periods',{
  ownerId:text('owner_id').notNull().references(()=>users.id),period:text('period').notNull(),allowance:integer('allowance').notNull(),reserved:integer('reserved').notNull().default(0),consumed:integer('consumed').notNull().default(0),mutationToken:text('mutation_token'),
},t=>[primaryKey({columns:[t.ownerId,t.period]}),check('ai_usage_periods_nonnegative',sql`${t.allowance}>=0 AND ${t.reserved}>=0 AND ${t.consumed}>=0`)]);
export const usageLedger=sqliteTable('usage_ledger',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>users.id),jobId:text('job_id').references(()=>aiJobs.id),kind:text('kind').notNull(),quantity:integer('quantity').notNull(),costMicros:integer('cost_micros').notNull(),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('usage_ledger_job_kind').on(t.jobId,t.kind)]);
export const billingCustomers=sqliteTable('billing_customers',{
  ownerId:text('owner_id').primaryKey().references(()=>users.id),providerCustomerId:text('provider_customer_id').notNull().unique(),createdAt:text('created_at').notNull(),
});
export const subscriptions=sqliteTable('subscriptions',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>users.id),providerCustomerId:text('provider_customer_id').notNull(),providerSubscriptionId:text('provider_subscription_id').notNull().unique(),plan:text('plan').notNull(),status:text('status').notNull(),currentPeriodEnd:text('current_period_end'),updatedAt:text('updated_at').notNull(),providerConfirmedAt:text('provider_confirmed_at'),reconciliationToken:text('reconciliation_token'),reconciliationExpiresAt:text('reconciliation_expires_at'),cancelAtPeriodEnd:integer('cancel_at_period_end').notNull().default(0),
},t=>[index('subscriptions_owner_status').on(t.ownerId,t.status)]);
export const billingWebhookEvents=sqliteTable('billing_webhook_events',{
  provider:text('provider').notNull(),providerEventId:text('provider_event_id').notNull(),processedAt:text('processed_at').notNull(),eventType:text('event_type').notNull(),subscriptionId:text('subscription_id'),payloadDigest:text('payload_digest').notNull(),status:text('status').notNull().default('pending'),processingToken:text('processing_token'),
},t=>[primaryKey({columns:[t.provider,t.providerEventId]})]);
export const abuseReports=sqliteTable('abuse_reports',{
  id:text('id').primaryKey(),reporterId:text('reporter_id'),category:text('category').notNull(),targetType:text('target_type').notNull(),targetId:text('target_id'),context:text('context').notNull(),status:text('status').notNull().default('open'),createdAt:text('created_at').notNull(),
},t=>[index('abuse_reports_status_created').on(t.status,t.createdAt)]);
export const moderationActions=sqliteTable('moderation_actions',{
  id:text('id').primaryKey(),reportId:text('report_id').references(()=>abuseReports.id),actorId:text('actor_id').notNull().references(()=>users.id),action:text('action').notNull(),reason:text('reason').notNull(),createdAt:text('created_at').notNull(),
});
export const auditLogs=sqliteTable('audit_logs',{
  id:text('id').primaryKey(),actorId:text('actor_id'),sessionId:text('session_id').references(()=>sessions.id),action:text('action').notNull(),targetId:text('target_id'),detail:text('detail').notNull(),createdAt:text('created_at').notNull(),
});
export const privacyRequests=sqliteTable('privacy_requests',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>users.id),requestType:text('request_type').notNull(),status:text('status').notNull().default('pending_verification'),createdAt:text('created_at').notNull(),completedAt:text('completed_at'),
},t=>[index('privacy_requests_owner').on(t.ownerId),check('privacy_requests_type',sql`${t.requestType} IN ('export','delete')`)]);
export const userPrivacySettings=sqliteTable('user_privacy_settings',{
  ownerId:text('owner_id').primaryKey().references(()=>users.id),analyticsConsent:integer('analytics_consent').notNull().default(0),hideNickname:integer('hide_nickname').notNull().default(0),updatedAt:text('updated_at').notNull(),
});
export const aggregateMetrics=sqliteTable('aggregate_metrics',{
  day:text('day').notNull(),metric:text('metric').notNull(),dimension:text('dimension').notNull().default('all'),count:integer('count').notNull().default(0),total:real('total').notNull().default(0),
},t=>[primaryKey({columns:[t.day,t.metric,t.dimension]})]);
export const rateLimits=sqliteTable('rate_limits',{
  key:text('key').primaryKey(),count:integer('count').notNull(),resetAt:text('reset_at').notNull(),
});
export const runtimeSecrets=sqliteTable('runtime_secrets',{
  key:text('key').primaryKey(),value:text('value').notNull(),createdAt:text('created_at').notNull(),
});
export const authAccounts=sqliteTable('auth_accounts',{
  id:text('id').primaryKey().references(()=>users.id),email:text('email').notNull().unique(),passwordHash:text('password_hash').notNull(),displayName:text('display_name').notNull(),createdAt:text('created_at').notNull(),
});
export const authSessions=sqliteTable('auth_sessions',{
  tokenDigest:text('token_digest').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),expiresAt:text('expires_at').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('auth_sessions_user').on(t.userId)]);
