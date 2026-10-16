# MULTIGAME product fixes — 16 October 2026

Existing redesign work was preserved in checkpoint commit `9cfacc8527c9a4e1e6908103c735ee44fd2ed072` before these changes. No unrelated work was discarded.

## Implemented

- Amountle now queues absolute counts serially, coalesces pending pours, and renders acknowledged input. Deadline closure drops unsent pours; an accepted in-flight response can still reconcile. Exact-boundary submissions are rejected, while receipt replay preserves an already accepted result. Zero-target rounds submit zero once. Hold rate uses elapsed time, including pointer release, rather than depending on animation/timer frequency.
- Large quantities use explicit weighted pieces (at most 96 simulated bodies) and a proportional remainder. A browser run reached exactly 10,000 with a visible 1,000-per-piece legend and correct scoring. No number-entry, removal or undo shortcut is exposed in Fill gameplay. Rendering uses the existing projected 3D physics on Canvas, not Three.js/WebGL; collision shapes remain approximations.
- Size It Up has readable guides, a stable reference camera, larger artwork, recognizable objects, reference-art selection in both creator editors and visible mobile locking controls.
- Existing podium and standings components were improved. Round winners follow actual points, including ties, with up to three players shown. Automatic reveal/podium durations are now 10/7 seconds. Host phase selection is persisted through the engine event ledger and survives reconnect; hosts can resume automatic progression.
- Creator settings now match Fill gameplay, including removing its answer-revision toggle. Existing authentication and ownership checks remain intact, as does accountless player joining. Labels and question-editor copy were shortened.
- Homepage joining and creation actions were simplified. Styling is organized into a dedicated product stylesheet with deterministic import order, and changed components were reformatted. Original pixel artwork is preserved.
- All five modes received interaction/reveal styling: readable Fermi estimates, Rare frequency/winner cards, Word feedback animation, Size truth comparison and Amount target/actual comparison. Scoring formulas remain unchanged.
- Practice totals now exclude stale or deleted round IDs, fixing a browser-discovered leaderboard issue.

## Verification executed

- 91 unit/integration tests passed, preserving the prior 82-test baseline and adding regressions for queue/count/deadline/zero-target/hold-rate/result-stage/practice behavior.
- Two end-to-end tests passed: ten independent HTTP/Socket.IO players completed a five-mode quiz with authentication and process-recovery coverage; cross-origin WebSocket rejection was also checked.
- TypeScript checking and diff whitespace checking passed.
- A real browser practice session completed all five modes and final results with two simulated opponents. Final totals were You 4,429, Rio 4,056 and Sam 3,632. This is practice coverage, not three independently authenticated browser players.
- Browser checks covered podium/standings, creator sign-in redirect, PIN normalization and nickname step, Size dragging, mobile layouts at 320/390 pixels, large Amountle quantities and final elapsed-time pouring. A 2.5-second hold accepted 24 objects after the timer fix.
- Desktop and responsive screenshots were visually inspected. Responsive tests used a browser iframe; no physical phone testing was performed. Temporary QA routes were removed.
- A Node CPU profile of 96 physics bodies over 600 steps measured median 0.73 ms and p95 2.88 ms per simulation step. This is not a browser FPS measurement.

## Remaining verification limits

The available browser shares one cookie profile across tabs and had no authenticated creator session. Therefore authenticated browser quiz saving/hosting and multiple independent browser-player sessions were not completed. Backend coverage passed, but it does not replace that browser acceptance check. Local joining also reached the managed preview's unavailable-room response because its PIN secret is unavailable. No authentication or deployment-secret bypass was introduced. Physical mobile performance, screen-reader behavior and a formal accessibility audit remain unverified.

Deployment is performed separately after the production build; see the delivery message for its confirmed status. Existing owner-private access is preserved.

## Evidence

- `tests/reports/product-fixes-tests.txt`
- `tests/reports/product-fixes-e2e.txt`
- `tests/reports/product-fixes-physics.json`
- `tests/screenshots/product-fixes/` — homepage, podium, Size mobile, Amount mobile and 10,000-count browser captures

## Source files changed

app/layout.tsx
app/world.css
apps/game-service/src/engine.ts
apps/web/components/Creator.tsx
apps/web/components/Demo.tsx
apps/web/components/Home.tsx
apps/web/components/Join.tsx
apps/web/components/Live.tsx
apps/web/components/ModeArt.tsx
apps/web/components/ModePlayer.tsx
apps/web/components/Preview.tsx
apps/web/components/Reveal.tsx
apps/web/components/Utility.tsx
apps/web/components/creator/SimpleModeEditor.tsx
apps/web/components/game/Competition.tsx
apps/web/components/game/PourControl.tsx
apps/web/components/game/PourScene.tsx
apps/web/components/game/ScaleStage.tsx
apps/web/lib/competition.ts
apps/web/lib/pour-physics.ts
docs/api/openapi.json
packages/contracts/src/index.ts
packages/game-modes/src/fixtures.ts
tests/fixtures/quiz-five-modes.json
tests/integration/engine.test.ts
tests/unit/competition.test.ts
tsconfig.tsbuildinfo

New implementation files: app/product.css; apps/web/components/game/AmountPlayer.tsx; apps/web/lib/pour-state.ts; tests/unit/pour-state.test.ts.
