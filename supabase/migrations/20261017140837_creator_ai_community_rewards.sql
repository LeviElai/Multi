-- Additive migration: existing quizzes remain private, existing game ledgers unchanged.
CREATE TABLE creator_generations (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), request_hash text NOT NULL,
 request_json text NOT NULL, requested integer NOT NULL CHECK(requested BETWEEN 1 AND 20), period text NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','queued','processing','generated','done','failed','rejected')),
 result_json text, quiz_id uuid REFERENCES quizzes(id), lease_token text, created_at text NOT NULL, updated_at text NOT NULL
);
CREATE INDEX creator_generations_queue ON creator_generations(status,created_at);
CREATE INDEX creator_generations_owner ON creator_generations(owner_id,created_at);
CREATE TABLE community_quizzes (
 quiz_id uuid PRIMARY KEY REFERENCES quizzes(id), version_id uuid NOT NULL REFERENCES quiz_versions(id),
 owner_id uuid NOT NULL REFERENCES users(id), description text NOT NULL, category text NOT NULL,
 published_at text NOT NULL, visible integer NOT NULL DEFAULT 1 CHECK(visible IN (0,1))
);
CREATE INDEX community_quizzes_browse ON community_quizzes(visible,published_at);
CREATE TABLE ad_reward_tickets (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), period text NOT NULL, day text NOT NULL,
 status text NOT NULL CHECK(status IN ('issued','claimed')), created_at text NOT NULL, expires_at text NOT NULL, claim_token text
);
CREATE INDEX ad_reward_owner_day ON ad_reward_tickets(owner_id,day);
ALTER TABLE creator_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_reward_tickets ENABLE ROW LEVEL SECURITY;
