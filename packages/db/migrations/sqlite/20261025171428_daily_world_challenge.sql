-- Additive and private. Rollback: disable daily routes/jobs; retain historical data.
CREATE TABLE IF NOT EXISTS daily_challenges (
 day text PRIMARY KEY,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 title text NOT NULL,
 questions text NOT NULL,
 scoring_version text NOT NULL DEFAULT 'daily-time-v1',
 prepared_at text NOT NULL,
 published_at text,
 status text NOT NULL CHECK(status IN ('approved','published'))
);
CREATE TABLE IF NOT EXISTS daily_attempts (
 id text PRIMARY KEY,
 day text NOT NULL REFERENCES daily_challenges(day),
 owner_id text NOT NULL REFERENCES users(id),
 display_name text NOT NULL,
 ranked integer NOT NULL CHECK(ranked IN (0,1)),
 question_index integer NOT NULL DEFAULT 0 CHECK(question_index>=0),
 question_started_at text NOT NULL,
 score integer NOT NULL DEFAULT 0 CHECK(score BETWEEN 0 AND 10000),
 correct integer NOT NULL DEFAULT 0 CHECK(correct BETWEEN 0 AND 10),
 response_ms integer NOT NULL DEFAULT 0 CHECK(response_ms>=0),
 responses text NOT NULL DEFAULT '[]',
 revision integer NOT NULL DEFAULT 0,
 completed_at text,
 created_at text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_one_ranked_attempt ON daily_attempts(day,owner_id) WHERE ranked=1;
CREATE INDEX IF NOT EXISTS daily_rankings ON daily_attempts(day,ranked,score DESC,correct DESC,response_ms,id) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS daily_owner_archive ON daily_attempts(owner_id,day DESC);
