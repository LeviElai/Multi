-- Reviewed recovery checkpoint; run once before applying the v3 migration.
-- Deliberately fails if the checkpoint already exists. Never replace a backup.
BEGIN;
-- Connect as postgres for CREATE SCHEMA; the application role has no database CREATE privilege.
CREATE SCHEMA multigame_backup_20261103_rescue AUTHORIZATION multigame_server;
SET LOCAL ROLE multigame_server;
LOCK TABLE multigame.daily_challenges, multigame.daily_attempts IN SHARE MODE;
REVOKE ALL ON SCHEMA multigame_backup_20261103_rescue FROM PUBLIC,anon,authenticated;
CREATE TABLE multigame_backup_20261103_rescue.daily_challenges AS TABLE multigame.daily_challenges;
CREATE TABLE multigame_backup_20261103_rescue.daily_attempts AS TABLE multigame.daily_attempts;
CREATE TABLE multigame_backup_20261103_rescue.application_migrations AS TABLE multigame._schema_migrations;
CREATE TABLE multigame_backup_20261103_rescue.publication_function AS
 SELECT now() AS captured_at,pg_get_functiondef('multigame.publish_daily_challenges()'::regprocedure) AS definition;
REVOKE ALL ON ALL TABLES IN SCHEMA multigame_backup_20261103_rescue FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM multigame.daily_challenges)<>(SELECT count(*) FROM multigame_backup_20261103_rescue.daily_challenges)
 OR (SELECT count(*) FROM multigame.daily_attempts)<>(SELECT count(*) FROM multigame_backup_20261103_rescue.daily_attempts)
 OR EXISTS(SELECT * FROM multigame.daily_challenges EXCEPT SELECT * FROM multigame_backup_20261103_rescue.daily_challenges)
 OR EXISTS(SELECT * FROM multigame.daily_attempts EXCEPT SELECT * FROM multigame_backup_20261103_rescue.daily_attempts)
 THEN RAISE EXCEPTION 'Recovery checkpoint mismatch'; END IF;
END $$;
COMMIT;
