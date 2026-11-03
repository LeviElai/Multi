# Verification matrix

Latest candidate: local 1aefdb6, remote f3afefd3d18c7fb29943db5bd8700975ca748840. Production is not updated by this rescue pass.

| Gate | Observed evidence | Status |
|---|---|---|
| Navigation/community | Desktop primary Quizzes opens /community; public cards and Details & host visible | Desktop verified; mobile open |
| Home/Daily composition | Fresh full-page desktop screenshots independently accepted after globe/alignment/proportion corrections | Captured states accepted; mobile open |
| Archive/community composition | Fresh desktop captures independently accepted | Captured desktop states accepted |
| Games | Browser exercised Fishing miss/one-attempt lock, Stack drop/disabled falling controls, Crack higher hint then correct unlock, Count lock, Estimate lock, Claw correct collection, Draw keyboard submission, Drop True lock, Sling Mars lock | Partial desktop interaction coverage; not full playtest |
| Size/Guess | Size submission locked, but requested slider value was not reflected; Guess submission result was not captured | Follow-up required |
| Daily sequence/scoring | 220 unit/integration checks pass, including five-mode v3 and equal-correct runs at 1s versus 20s: 4732 versus 3623, ranks 1/2 | Automated verified; v3 browser flow not deployed |
| Multiplayer scoring | Engine test confirms faster correct responses earn more, including pause/restart | Automated verified; independent real clients open |
| Guest leaderboard | Server-issued guest official attempt and duplicate protections covered in integration suite | Live v3 browser verification open |
| Auth | Automated outage preserves cookie, recovery/restart, limiter separation, password session revocation checks | Persistent signed-in browser journey open |
| Database/security | Read-only audit: 45 multigame tables RLS enabled; anon/authenticated no schema/CRUD grants; username/attempt uniqueness constraints; publisher EXECUTE restricted | Scoped review done; physical-action anti-cheat and recovery limitations in security report |
| Build | Latest production build and typecheck passed | Passed |
| Deployment | Frontend preview ready; backend/DB remain old production version | Not released |

## Evidence and limitations
- Latest desktop captures: multigame-final-home-desktop.jpg, multigame-final-daily-desktop.jpg, multigame-final-community-desktop.jpg, multigame-final-archive-desktop.jpg in shared scratch. Prior logged-out login/profile captures were independently reviewed.
- Preview still reads production legacy Daily data (10 questions). This is not proof of five-game v3 browser behavior.
- Available cloud browsers do not expose viewport resizing. Playwright browser download failed; TinyFish also could not resize. No mobile pass, physical phone, Mobile Safari, or human enjoyment claim.
- Secure browser sign-in handoff completed; backend rejected the candidate origin with "Origin is not permitted." No incorrect-password conclusion. Signed-in browser QA is blocked until the exact candidate origin is added to ALLOWED_ORIGINS while preserving existing entries. Render connector exposes update but not current environment values; do not overwrite an unknown allowlist. No credentials were entered through general automation.
- Existing lint reports 30 errors and 5 warnings in prior imperative/ref patterns; no clean-lint claim.
- No production database writes or deployment performed in this rescue pass. Safe backup/additive migration/cutover instructions are prepared under release/.
- Latest user amendment: Daily DOES reward response speed, matching regular quizzes; supersedes earlier no-speed instruction. Historical scoring versions remain preserved.
