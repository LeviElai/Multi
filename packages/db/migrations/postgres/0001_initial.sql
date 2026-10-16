-- PostgreSQL canonical schema. SQLite/D1 is the private evaluation adapter.

-- Forward migration; rollback strategy: restore a pre-migration backup to a new database.

CREATE TABLE "abuse_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reporter_id" text,
	"category" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"context" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamptz NOT NULL
);

CREATE INDEX "abuse_reports_status_created" ON "abuse_reports" ("status","created_at");

CREATE TABLE "aggregate_metrics" (
	"day" text NOT NULL,
	"metric" text NOT NULL,
	"dimension" text DEFAULT 'all' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"total" real DEFAULT 0 NOT NULL,
	PRIMARY KEY("day", "metric", "dimension")
);

CREATE TABLE "api_receipts" (
	"principal_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"result_json" jsonb NOT NULL,
	"created_at" timestamptz NOT NULL,
	PRIMARY KEY("principal_id", "idempotency_key")
);

CREATE TABLE "billing_webhook_events" (
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"processed_at" timestamptz NOT NULL,
	"event_type" text NOT NULL,
	"subscription_id" text,
	"payload_digest" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"processing_token" text,
	PRIMARY KEY("provider", "provider_event_id")
);

CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamptz NOT NULL
);

CREATE TABLE "runtime_secrets" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamptz NOT NULL
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL
);

CREATE UNIQUE INDEX "users_external_id_unique" ON "users" ("external_id");

CREATE TABLE "ai_usage_periods" (
	"owner_id" uuid NOT NULL,
	"period" text NOT NULL,
	"allowance" integer NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"consumed" integer DEFAULT 0 NOT NULL,
	"mutation_token" text,
	PRIMARY KEY("owner_id", "period"),
	FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_usage_periods_nonnegative" CHECK("ai_usage_periods"."allowance">=0 AND "ai_usage_periods"."reserved">=0 AND "ai_usage_periods"."consumed">=0)
);

CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"processing_status" text NOT NULL,
	"license_attestation" text,
	"calibration" jsonb,
	"created_at" timestamptz NOT NULL,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "assets_storage_key_unique" ON "assets" ("storage_key");

CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamptz NOT NULL,
	FOREIGN KEY ("id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "auth_accounts_email_unique" ON "auth_accounts" ("email");

CREATE TABLE "auth_sessions" (
	"token_digest" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"created_at" timestamptz NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);

CREATE INDEX "auth_sessions_user" ON "auth_sessions" ("user_id");

CREATE TABLE "billing_customers" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"provider_customer_id" text NOT NULL,
	"created_at" timestamptz NOT NULL,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "billing_customers_provider_customer_id_unique" ON "billing_customers" ("provider_customer_id");

CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"report_id" uuid,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamptz NOT NULL,
	FOREIGN KEY ("report_id") REFERENCES "abuse_reports"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "privacy_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"request_type" text NOT NULL,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"created_at" timestamptz NOT NULL,
	"completed_at" timestamptz,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "privacy_requests_type" CHECK("privacy_requests"."request_type" IN ('export','delete'))
);

CREATE INDEX "privacy_requests_owner" ON "privacy_requests" ("owner_id");

CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"audience_context" text DEFAULT 'adult_private' NOT NULL,
	"theme" text DEFAULT 'studio' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_version_id" uuid,
	"last_mutation_id" uuid NOT NULL,
	"created_at" timestamptz NOT NULL,
	"updated_at" timestamptz NOT NULL,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quizzes_revision_positive" CHECK("quizzes"."revision">0),
	CONSTRAINT "quizzes_status" CHECK("quizzes"."status" IN ('draft','published','archived'))
);

CREATE INDEX "quizzes_owner_updated" ON "quizzes" ("owner_id","updated_at");

CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"provider_customer_id" text NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamptz,
	"updated_at" timestamptz NOT NULL,
	"provider_confirmed_at" timestamptz,
	"reconciliation_token" text,
	"reconciliation_expires_at" timestamptz,
	"cancel_at_period_end" integer DEFAULT 0 NOT NULL,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "subscriptions_provider_subscription_id_unique" ON "subscriptions" ("provider_subscription_id");

CREATE INDEX "subscriptions_owner_status" ON "subscriptions" ("owner_id","status");

CREATE TABLE "user_privacy_settings" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"analytics_consent" integer DEFAULT 0 NOT NULL,
	"hide_nickname" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamptz NOT NULL,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "ai_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"quiz_id" uuid,
	"prompt_version" text NOT NULL,
	"model_id" text NOT NULL,
	"status" text NOT NULL,
	"response_schema_version" integer NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_micros" integer DEFAULT 0 NOT NULL,
	"moderation_state" text NOT NULL,
	"created_at" timestamptz NOT NULL,
	"request_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"request_json" jsonb NOT NULL,
	"result_json" jsonb,
	"quota_period" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamptz NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamptz,
	"last_error_code" text,
	"updated_at" timestamptz NOT NULL,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_jobs_attempts" CHECK("ai_jobs"."attempts">=0)
);

CREATE UNIQUE INDEX "ai_jobs_request" ON "ai_jobs" ("owner_id","request_key");

CREATE INDEX "ai_jobs_available" ON "ai_jobs" ("status","available_at");

CREATE TABLE "draft_rounds" (
	"quiz_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"mode" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"question" text NOT NULL,
	"timer_seconds" integer NOT NULL,
	"max_points" integer DEFAULT 1000 NOT NULL,
	"provenance" text NOT NULL,
	"source_url" text,
	"explanation" text,
	"allow_revision" integer DEFAULT 1 NOT NULL,
	"public_config" jsonb NOT NULL,
	"secret_config" jsonb NOT NULL,
	"scoring_version" text DEFAULT 'v3-1' NOT NULL,
	PRIMARY KEY("quiz_id", "id"),
	FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "draft_rounds_ordinal" CHECK("draft_rounds"."ordinal">=0),
	CONSTRAINT "draft_rounds_timer" CHECK("draft_rounds"."timer_seconds" BETWEEN 10 AND 300),
	CONSTRAINT "draft_rounds_points" CHECK("draft_rounds"."max_points"=1000)
);

CREATE UNIQUE INDEX "draft_rounds_order" ON "draft_rounds" ("quiz_id","ordinal");

CREATE TABLE "quiz_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quiz_id" uuid NOT NULL,
	"version_num" integer NOT NULL,
	"title" text NOT NULL,
	"theme" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamptz NOT NULL,
	FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quiz_versions_number_positive" CHECK("quiz_versions"."version_num">0)
);

CREATE UNIQUE INDEX "quiz_versions_number" ON "quiz_versions" ("quiz_id","version_num");

CREATE TABLE "rounds" (
	"version_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"mode" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"question" text NOT NULL,
	"timer_seconds" integer NOT NULL,
	"max_points" integer DEFAULT 1000 NOT NULL,
	"provenance" text NOT NULL,
	"source_url" text,
	"explanation" text,
	"allow_revision" integer DEFAULT 1 NOT NULL,
	"public_config" jsonb NOT NULL,
	"secret_config" jsonb NOT NULL,
	"scoring_version" text DEFAULT 'v3-1' NOT NULL,
	PRIMARY KEY("version_id", "id"),
	FOREIGN KEY ("version_id") REFERENCES "quiz_versions"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "rounds_ordinal" CHECK("rounds"."ordinal">=0),
	CONSTRAINT "rounds_timer" CHECK("rounds"."timer_seconds" BETWEEN 10 AND 300),
	CONSTRAINT "rounds_points" CHECK("rounds"."max_points"=1000)
);

CREATE UNIQUE INDEX "rounds_order" ON "rounds" ("version_id","ordinal");

CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"host_id" uuid NOT NULL,
	"pin_digest" text NOT NULL,
	"pin" text NOT NULL,
	"state" text NOT NULL,
	"state_version" integer NOT NULL,
	"round_index" integer NOT NULL,
	"deadline_at" timestamptz,
	"paused_remaining_ms" integer,
	"extension_count" integer DEFAULT 0 NOT NULL,
	"join_locked" integer DEFAULT 0 NOT NULL,
	"created_at" timestamptz NOT NULL,
	"completed_at" timestamptz,
	"last_mutation_id" uuid NOT NULL,
	"latest_seq" integer DEFAULT 0 NOT NULL,
	"max_players" integer DEFAULT 100 NOT NULL,
	FOREIGN KEY ("version_id") REFERENCES "quiz_versions"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("host_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sessions_state_version" CHECK("sessions"."state_version">=0),
	CONSTRAINT "sessions_latest_seq" CHECK("sessions"."latest_seq">=0),
	CONSTRAINT "sessions_player_cap" CHECK("sessions"."max_players" BETWEEN 1 AND 1000),
	CONSTRAINT "sessions_state" CHECK("sessions"."state" IN ('LOBBY','ROUND_PREPARE','ROUND_COUNTDOWN','ROUND_ACTIVE','PAUSED','ROUND_LOCKED','ROUND_EVALUATING','REVIEW_REQUIRED','ROUND_SCORED','ROUND_REVEAL','INTERMISSION','SESSION_COMPLETED','SESSION_ABORTED'))
);

CREATE UNIQUE INDEX "sessions_pin_digest_unique" ON "sessions" ("pin_digest");

CREATE UNIQUE INDEX "sessions_id_version" ON "sessions" ("id","version_id");

CREATE INDEX "sessions_due" ON "sessions" ("state","deadline_at");

CREATE INDEX "sessions_host_created" ON "sessions" ("host_id","created_at");

CREATE TABLE "usage_ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"job_id" uuid,
	"kind" text NOT NULL,
	"quantity" integer NOT NULL,
	"cost_micros" integer NOT NULL,
	"created_at" timestamptz NOT NULL,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("job_id") REFERENCES "ai_jobs"("id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "usage_ledger_job_kind" ON "usage_ledger" ("job_id","kind");

CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" text,
	"session_id" uuid,
	"action" text NOT NULL,
	"target_id" text,
	"detail" jsonb NOT NULL,
	"created_at" timestamptz NOT NULL,
	FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "display_pairings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"token_digest" text NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"created_at" timestamptz NOT NULL,
	"revoked_at" timestamptz,
	FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "display_pairings_token_digest_unique" ON "display_pairings" ("token_digest");

CREATE INDEX "display_pairings_session" ON "display_pairings" ("session_id");

CREATE TABLE "mutation_receipts" (
	"session_id" uuid NOT NULL,
	"principal_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"result_json" jsonb NOT NULL,
	"created_at" timestamptz NOT NULL,
	PRIMARY KEY("session_id", "principal_id", "idempotency_key"),
	FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"nickname" text NOT NULL,
	"display_name_norm" text NOT NULL,
	"token_digest" text NOT NULL,
	"token_expires_at" timestamptz NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamptz NOT NULL,
	"last_seen_at" timestamptz NOT NULL,
	"kicked_at" timestamptz,
	FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "participants_status" CHECK("participants"."status" IN ('active','kicked'))
);

CREATE UNIQUE INDEX "participants_token_digest_unique" ON "participants" ("token_digest");

CREATE UNIQUE INDEX "participants_session_id" ON "participants" ("session_id","id");

CREATE INDEX "participants_session_status" ON "participants" ("session_id","status");

CREATE TABLE "session_events" (
	"session_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"event_id" uuid NOT NULL,
	"state_version" integer NOT NULL,
	"type" text NOT NULL,
	"role_scope" text DEFAULT 'all' NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamptz NOT NULL,
	PRIMARY KEY("session_id", "seq"),
	FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "session_events_seq_positive" CHECK("session_events"."seq">0)
);

CREATE UNIQUE INDEX "session_events_event_id_unique" ON "session_events" ("event_id");

CREATE TABLE "session_rounds" (
	"session_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"voided" integer DEFAULT 0 NOT NULL,
	PRIMARY KEY("session_id", "round_id"),
	FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("session_id","version_id") REFERENCES "sessions"("id","version_id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("version_id","round_id") REFERENCES "rounds"("version_id","id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "session_rounds_order" ON "session_rounds" ("session_id","ordinal");

CREATE TABLE "adjudications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"answer_key" text NOT NULL,
	"decision" text NOT NULL,
	"canonical" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"adjudication_revision" integer NOT NULL,
	"created_at" timestamptz NOT NULL,
	FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("session_id","round_id") REFERENCES "session_rounds"("session_id","round_id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "adjudications_decision" CHECK("adjudications"."decision" IN ('accept','reject'))
);

CREATE UNIQUE INDEX "adjudications_revision" ON "adjudications" ("session_id","round_id","answer_key","adjudication_revision");

CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"delivery_status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamptz NOT NULL,
	"delivered_at" timestamptz,
	FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("event_id") REFERENCES "session_events"("event_id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "outbox_event_id_unique" ON "outbox" ("event_id");

CREATE INDEX "outbox_pending" ON "outbox" ("delivery_status","created_at");

CREATE TABLE "scoring_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"scoring_revision" integer NOT NULL,
	"scorer_version" text NOT NULL,
	"completed_at" timestamptz NOT NULL,
	FOREIGN KEY ("session_id","round_id") REFERENCES "session_rounds"("session_id","round_id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "scoring_runs_revision_positive" CHECK("scoring_runs"."scoring_revision">0)
);

CREATE UNIQUE INDEX "scoring_runs_revision" ON "scoring_runs" ("session_id","round_id","scoring_revision");

CREATE UNIQUE INDEX "scoring_runs_scope" ON "scoring_runs" ("session_id","round_id","id");

CREATE UNIQUE INDEX "scoring_runs_session_id" ON "scoring_runs" ("session_id","id");

CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"client_mutation_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"accepted_at" timestamptz NOT NULL,
	FOREIGN KEY ("session_id","round_id") REFERENCES "session_rounds"("session_id","round_id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("session_id","participant_id") REFERENCES "participants"("session_id","id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "submissions_revision_positive" CHECK("submissions"."revision">0)
);

CREATE UNIQUE INDEX "submissions_mutation" ON "submissions" ("session_id","participant_id","round_id","client_mutation_id");

CREATE UNIQUE INDEX "submissions_revision" ON "submissions" ("session_id","participant_id","round_id","revision");

CREATE TABLE "word_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"client_mutation_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"guess" text NOT NULL,
	"feedback" jsonb NOT NULL,
	"solved" integer NOT NULL,
	"accepted_at" timestamptz NOT NULL,
	FOREIGN KEY ("session_id","round_id") REFERENCES "session_rounds"("session_id","round_id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("session_id","participant_id") REFERENCES "participants"("session_id","id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "word_attempts_positive" CHECK("word_attempts"."attempt">0)
);

CREATE UNIQUE INDEX "word_attempts_number" ON "word_attempts" ("session_id","round_id","participant_id","attempt");

CREATE UNIQUE INDEX "word_attempts_mutation" ON "word_attempts" ("session_id","participant_id","client_mutation_id");

CREATE TABLE "round_score_current" (
	"session_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"scoring_run_id" uuid NOT NULL,
	PRIMARY KEY("session_id", "round_id"),
	FOREIGN KEY ("session_id","round_id","scoring_run_id") REFERENCES "scoring_runs"("session_id","round_id","id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "round_scores" (
	"scoring_run_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"detail" jsonb NOT NULL,
	PRIMARY KEY("scoring_run_id", "participant_id"),
	FOREIGN KEY ("session_id","scoring_run_id") REFERENCES "scoring_runs"("session_id","id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("session_id","participant_id") REFERENCES "participants"("session_id","id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "round_scores_points" CHECK("round_scores"."points" BETWEEN 0 AND 1000)
);


CREATE FUNCTION prevent_published_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='published' THEN RAISE EXCEPTION 'Published quiz versions are immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER quiz_versions_immutable BEFORE UPDATE OR DELETE ON quiz_versions
FOR EACH ROW EXECUTE FUNCTION prevent_published_version_mutation();
CREATE FUNCTION prevent_published_round_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF EXISTS (SELECT 1 FROM quiz_versions WHERE id=NEW.version_id AND status='published') THEN
      RAISE EXCEPTION 'Published rounds are immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM quiz_versions WHERE id=OLD.version_id AND status='published') THEN
    RAISE EXCEPTION 'Published rounds are immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF EXISTS (SELECT 1 FROM quiz_versions WHERE id=NEW.version_id AND status='published') THEN
    RAISE EXCEPTION 'Published rounds are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER rounds_immutable BEFORE INSERT OR UPDATE OR DELETE ON rounds
FOR EACH ROW EXECUTE FUNCTION prevent_published_round_mutation();

