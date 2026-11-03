ALTER TABLE auth_accounts ADD COLUMN username text;
UPDATE auth_accounts SET username = 'player_' || substr(replace(id, '-', ''), 1, 16) WHERE username IS NULL;
CREATE UNIQUE INDEX auth_accounts_username_ci ON auth_accounts (lower(username));
