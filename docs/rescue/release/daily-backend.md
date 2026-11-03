# Daily v3 release contract

New rules: five distinct existing minigames, skill-only score, score/correctness ranking ties (no elapsed-time tie-breaker), 10-minute stale-round expiry. Fishing keeps its actual moving target timing. Guest official identities use the server session; account names and avatar resolve through stable IDs. Anonymous users can clear storage/change devices; this does not establish one-human-one-attempt.

API adds `scoringVersion` on overview and attempt snapshots. Board `avatar` is parsed JSON or null. Guest own-score queries include the guest cookie identity. Existing v1/v2 attempts keep their scoring policy and exact question data through `challenge_snapshot`.

## Safe release order

1. Back up the current challenges, attempts, function definition and migration list. Apply additive `20261103000002_daily_skill_scoring.sql`. This backfills snapshots and updates the scheduler for future/unpublished dates; published events remain unchanged. Existing backend ignores the new nullable column safely.
2. Deploy the snapshot-aware backend and frontend. Verify v3 through an isolated fixture before changing today's event. Do not publish v3 while the older backend is running: old code ignores scoring_version.
3. Recheck today's ranked-attempt count. The inspected Nov3 production event has four practice attempts and zero ranked attempts. This is a point-in-time observation, not permission to overwrite later scores.
4. Generate cutover SQL using `node --import tsx scripts/prepare-daily-skill-cutover.ts YYYY-MM-DD`. Review and apply only after backend rollout. It locks challenge/attempt writes, refuses a stale date or any ranked attempt, snapshots any legacy practice starts, and replaces only today's event. If any ranked attempt exists, do not cut over; publish v3 at next UTC reset.
5. Confirm five distinct modes, skill-v3 policy, old practice resumes ten original questions, new guest completion enters official board, archive replay cannot change rankings, and equal performance gives equal score/rank at different response delays.

## Rollback

Before any v3 ranked attempt: restore today's challenge row from the database backup and retain attempt snapshots. Restore the prior scheduler function from migration `20261103000001_daily_arcade_fallback.sql` if necessary. Do not drop snapshots or delete attempts.

After any v3 ranked attempt: do not roll back to a backend that ignores snapshots/scoring_version. Roll forward a correction or disable new starts temporarily; preserve v3 score interpretation and existing records. Restoring historical rows after v3 play would mix incompatible events.

## Evidence and limits

Six focused Daily tests pass, including legacy 8775-point regression, identical skill runs at 1s/20s receiving 4800 points and tied ranks, guest duplicate-start reuse, guest board identity, renamed registered identity/avatar, archive immutability, backfilled legacy practice resume after cutover, and stale start rejection during a simulated challenge switch. The selector test covers 28 days and all 11 modes. These are backend tests, not browser playtesting or proof of enjoyment. No live mutation was performed by this workstream.

Server-authoritative answer validation does not make all physical interactions cheat-proof: Claw and Sling still submit choices rather than replay-verifiable action traces. Guest session limits are per server-issued identity and existing IP creation throttles, not cross-device person identification. Preserve this disclosure in security findings.
