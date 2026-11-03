# Verification matrix

Baseline 8881c5b. Status reflects this rescue pass only; older tests/screenshots do not certify new changes.

| Gate | Evidence required | Status |
|---|---|---|
| Navigation/community | Same five destinations mobile/desktop, public quizzes accessible in one primary action | Source fixed in scoped navigation; candidate browser check blocked |
| Home and core routes | Normal-zoom mobile/desktop plus full-page before/after screenshots, interaction review | Live desktop baseline inspected; after pending |
| Eleven games | Each played, viewport fit, controls, feedback and scoring verified | Pending |
| Daily | Five distinct actual mechanics; identical server configuration | Pending |
| Daily score | Equal performance at different response times yields equal points/rank | Pending |
| Guests | Official completion/refresh/reconnect/duplicate-attempt protection | Pending |
| Registered identity | Avatar+username leaderboard; display name multiplayer; edits preserve scores | Pending |
| Auth | Returning session, concurrent tabs, expired token, network interruption | Pending |
| Database/security | RLS/grants, safe migration, ownership, answer secrecy, replay/score manipulation | Pending |
| Independent visual review | Separate critique with defects repaired | Blocked: specialist agents out of workspace credits |
| Deployment | Rollback checkpoint, passing candidate, live frontend/backend/database commit verification | Not deployed |

No physical phone or human playtester results have been obtained in this pass.

## Available checks after navigation change
- TypeScript: passed.
- Existing unit/integration suite: 216/216 passed. This suite still tests earlier Daily behavior; it does not certify the new Daily contract.
- Production build: passed (vinext/Vite).
- Managed preview reports http://terminal.local:4173/ running, but browser navigation returns net::ERR_CONNECTION_REFUSED. Do not alter networking or release without rendered QA.
- Production baseline screenshot was captured in the browser, but shared-file synchronization did not make it available in the main workspace. No candidate screenshots exist.
