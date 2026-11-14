-- Freeze the exact content and scoring policy used by every existing attempt.
ALTER TABLE daily_attempts ADD COLUMN challenge_snapshot TEXT;
UPDATE daily_attempts SET challenge_snapshot=(SELECT json_object('day',c.day,'version',c.version,'title',c.title,'questions',c.questions,'status',c.status,'scoring_version',c.scoring_version) FROM daily_challenges c WHERE c.day=daily_attempts.day) WHERE challenge_snapshot IS NULL;
