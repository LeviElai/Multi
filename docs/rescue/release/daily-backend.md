# Daily v3 release contract

New rules: five distinct existing minigames, correctness/accuracy/skill base followed by a server-time speed modifier, score/correctness ranking ties (no additional elapsed-time tie-breaker), 26/35-second mode deadlines. Fishing keeps its actual moving target timing. Guest official identities use the server session; account names and avatar resolve through stable IDs. Anonymous users can clear storage/change devices; this does not establish one-human-one-attempt.

API adds `scoringVersion` on overview and attempt snapshots. Board `avatar` is parsed JSON or null. Guest own-score queries include the guest cookie identity. Existing v1/v2 attempts keep their scoring policy and exact question data through `challenge_snapshot`.

## Safe release order

1. Back up the current challenges, attempts, function definition and migration list. Apply additive `20261103000002_daily_skill_scoring.sql`. This backfills snapshots and updates the scheduler for future/unpublished dates; published events remain unchanged. Existing backend ignores the new nullable column safely.
2. Deploy the snapshot-aware backend and frontend. Verify v3 through an isolated fixture before changing today's event. Do not publish v3 while the older backend is running: old code ignores scoring_version.
3. Recheck today's ranked-attempt count. The Nov14 10:21 UTC production event has five games and zero attempts of either kind. This is a point-in-time observation, not permission to overwrite later scores.
4. Keep today's published v2 event unchanged. The current service permits official guest attempts for all five-game versions (v2+), using each event's stored scoring policy. No published-content cutover is required; the old guarded cutover SQL is not part of this release. Future approved events become v3 through the migration/worker.
5. Confirm five distinct modes, preserved current-day question data, guest completion on the official board, refresh identity reuse, archive isolation, and faster correct performance earning more points.

## Rollback

Before any v3 ranked attempt: restore today's challenge row from the database backup and retain attempt snapshots. Restore the prior scheduler function from migration `20261103000001_daily_arcade_fallback.sql` if necessary. Do not drop snapshots or delete attempts.

After any v3 ranked attempt: do not roll back to a backend that ignores snapshots/scoring_version. Roll forward a correction or disable new starts temporarily; preserve v3 score interpretation and existing records. Restoring historical rows after v3 play would mix incompatible events.

## Evidence and limits

Seven focused Daily tests pass, including legacy 8775-point regression, identical correct runs at 1s/20s receiving 4732/3623 points and ranks 1/2, with Crack mistakes reducing the base before the speed modifier, guest duplicate-start reuse, guest board identity, renamed registered identity/avatar, archive immutability, backfilled legacy practice resume after cutover, and stale start rejection during a simulated challenge switch. The selector test covers 28 days and all 11 modes. These are backend tests, not browser playtesting or proof of enjoyment. A private recovery checkpoint was created Nov3; no application data or schema was mutated by this workstream. The user changed the earlier no-speed requirement; the current identifier is `daily-speed-v3`. Existing migration filename is retained because it has not been applied. Normal multiplayer speed is verified by the existing engine test covering pause, restart and delayed answers plus the hosted-rules persistence test.

Server-authoritative answer validation does not make all physical interactions cheat-proof: Claw and Sling still submit choices rather than replay-verifiable action traces. Guest session limits are per server-issued identity and existing IP creation throttles, not cross-device person identification. Preserve this disclosure in security findings.

## Owner runner and live readiness (read-only, 2026-11-14 10:21 UTC)

- Live owner of daily tables and publication function: `multigame_server`. `postgres` membership has SET=false and INHERIT=false; the connector cannot assume the owner role or run the application migration. `challenge_snapshot` is absent; migration must precede snapshot-aware requests.
- Current Nov14 event has zero attempts; Nov15–16 are prepared five-game v2 events. Approved inventory has 422 reviewed game/question pairs. Publication cron job 2 is active every five minutes, calling `multigame.publish_daily_challenges()`.
- Existing application migrations are tracked in `multigame._schema_migrations`, independently of `supabase_migrations.schema_migrations`. Last applied application migration is `20261103000001_daily_arcade_fallback`.
- Canonical runner: `node --import tsx apps/worker/src/main.ts --migrate`, with existing production `DATABASE_URL`, `DATABASE_SCHEMA=multigame`, and TLS settings. `apps/game-service/src/runtime.ts` reads `supabase/migrations` lexically; `PostgresDatabase.migrate` transactionally takes advisory lock 586471239, checks SHA-256 and records the migration. Server startup also uses this runner when `AUTO_MIGRATE=1`. Verify actual production env; blueprint says 1 but is evaluation-only, not live evidence.
- New v3 SQL SHA-256: `3369af41e5b32bfb162ea98f689e62782deb3a645209c5e1731b794ec6410213`. Applying raw SQL via connector without recording the exact application migration checksum is not equivalent to the canonical runner.
- `daily-backup.sql` prepares a fresh private postgres-owned Nov14 recovery bundle using a single-statement snapshot of daily challenges, attempts, migration ledger and publication function. It never alters source tables or role privileges, refuses an existing checkpoint and denies browser-role access. This fresh checkpoint was executed Nov14 10:23:11 UTC:27 challenges and6 attempts; JSON array counts and live-row comparisons matched with zero differences and both browser roles denied access. The successful Nov3 bundle remains present:16 challenges/6 attempts versus22/6 live on Nov14; both browser roles lack access. Do not reuse the old checkpoint as current release evidence.

The generated cutover SQL is retained only as a contingency artifact and must not be executed for this release. All9 focused Daily/speed tests passed on Nov14 after the guest policy refinement. No ELIX data was read or written.

Nov14 policy refinement: current v2 guest runs are officially ranked, with one attempt per server identity/day and the existing v2 score/rank rules unchanged. Tests cover both v2 and v3, published-row byte-for-byte preservation, duplicate starts, and archive isolation. No live published row needs mutation.
