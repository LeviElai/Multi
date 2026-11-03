-- MULTIGAME only. Existing account IDs and scores remain stable.
ALTER TABLE multigame.auth_accounts ADD COLUMN IF NOT EXISTS username text;
UPDATE multigame.auth_accounts SET username = 'player_' || substr(replace(id::text, '-', ''), 1, 16) WHERE username IS NULL;
ALTER TABLE multigame.auth_accounts ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_username_ci ON multigame.auth_accounts (lower(username));
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='auth_accounts_username_format' AND conrelid='multigame.auth_accounts'::regclass) THEN
  ALTER TABLE multigame.auth_accounts ADD CONSTRAINT auth_accounts_username_format CHECK (username ~ '^[a-z][a-z0-9_]{2,23}$');
 END IF;
END $$;
