-- Applied Nov14 10:23 UTC. Previous Nov3 checkpoint remains untouched.
-- Source reads use one statement snapshot; no app ownership changes or SET ROLE.
-- Refuses existing checkpoint. Same-database rollback aid, not disaster recovery.
BEGIN;
CREATE SCHEMA multigame_backup_20261114_rescue AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA multigame_backup_20261114_rescue FROM PUBLIC,anon,authenticated;
CREATE TABLE multigame_backup_20261114_rescue.daily_recovery_bundle AS
 SELECT now() AS captured_at,jsonb_build_object(
 'daily_challenges',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.day) FROM multigame.daily_challenges c),
 'daily_attempts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM multigame.daily_attempts a),
 'application_migrations',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.migration_id) FROM multigame._schema_migrations m),
 'publication_function',pg_get_functiondef('multigame.publish_daily_challenges()'::regprocedure),
 'challenge_count',(SELECT count(*) FROM multigame.daily_challenges),
 'attempt_count',(SELECT count(*) FROM multigame.daily_attempts)) AS data;
REVOKE ALL ON ALL TABLES IN SCHEMA multigame_backup_20261114_rescue FROM PUBLIC,anon,authenticated;
ALTER TABLE multigame_backup_20261114_rescue.daily_recovery_bundle ENABLE ROW LEVEL SECURITY;
COMMIT;
