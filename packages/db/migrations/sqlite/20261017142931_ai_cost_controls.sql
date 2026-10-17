-- Keep only compact usage counters permanently; transient bodies are compacted by the service.
ALTER TABLE creator_generations ADD COLUMN input_tokens integer NOT NULL DEFAULT 0 CHECK(input_tokens>=0);
ALTER TABLE creator_generations ADD COLUMN output_tokens integer NOT NULL DEFAULT 0 CHECK(output_tokens>=0);
ALTER TABLE creator_generations ADD COLUMN model_id text;
CREATE INDEX creator_generations_retention ON creator_generations(status,updated_at);
CREATE INDEX ad_reward_expiry ON ad_reward_tickets(expires_at);
