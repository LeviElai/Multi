# Emergency gameplay recovery — 18 October 2026

## Recovery and schema

Baseline: `bcaec1f881e9da9ce10ff08a4b50ecf368718b8b`, preserved in local branch `recovery/pre-emergency-rebuild` and the existing GitHub history. The initial working tree was clean. Source remains LeviElai/Multi, frontend Vercel project `multigame`, persistent Render service `multigame-service`, private Supabase schema `multigame`.

The baseline contracts store eleven official modes, plus historical `rare_answers` and an internal `answer` record. Question metadata stays in the private `secret_config.__question` envelope. Published versions, server receive-time deadlines, authentication, ownership, immutable versions and numeric scoring remain intact. No table migration, public grant, new service or paid upgrade was required.

The internal setup record now preserves unsupported authoring choices, but cannot become a playable preview, publication or newly hosted game. It is never offered as an Answer minigame. Multiple-answer choice questions use Fish with exact-set scoring. Free-form lists and more than six choices require rewriting; their data remains saved rather than silently discarded. Recommendations distinguish a historical year from a quantity measured in years and route long labels to Fish.

## Physical controls and presentation

- Claw: deterministic targeting; 3.2-second descend, close, attach, lift, carry and release sequence. The carried object remains attached to the carriage. A failed request does not count as an accepted answer.
- Drop: locally precomputed gravity, circular peg collisions, bounce and side-wall response. A center barrier preserves the chosen True/False outcome. No speed selector. Browser traces contain both downward motion and upward collision responses.
- Sling: direct pull backward from the pebble, elastic snap, continuous assisted trajectory and target impact. Targets aim without auto-submitting; keyboard launching is a separate accessible control.
- Fish: original illustrated species with tails, fins, layered colors and forward-only exit/re-entry passes. System reduced motion supplies stationary targets. No prominent keep-still button. Fish start in readable positions, pause under a pointer press/hover and capture that pointer so a moving hit target cannot slip out before release. The multiple-catch regression was reproduced and retested in the creator.
- Stack: drag the hanging block and release to place it. Moving and placed blocks share their physical size. Lower blocks compact after six visible placements; represented totals remain exact. Denomination buttons prepare the next block rather than adding to the total. No collapse penalty.
- Crack: digit wheels and a safe handle; no editable code textbox. Correct-result presentation opens a hinged safe door.
- Draw: bounded strokes, local recognition, read-only recognition, explicit confirmation and redraw. Actual original paths appear in results. A separately labeled accessibility input uses identical numerical scoring, with no handwriting-quality or speed bonus.
- Count: accepted-pour queue retained; rotating shaded geometric sweets, rim depth and bounded collision physics. Automatic pacing replaces the speed selector. Numeric authority never comes from rendered bodies.
- Estimate: Scratchpad and the parsing/range paragraph removed. Guess has tile-turn feedback. Size has illustrated calibrated silhouettes and larger scene labels while retaining a fixed reference camera and alternate controls.

Two animation-skipping causes were fixed: the global locked CSS rule hid arcade scenes, and practice transitioned after only 700 ms. Live presentation now finishes the local action while room scoring continues immediately. Aborting a session still interrupts play.

## Data and cost

Draw accepts at most 32 strokes × 64 bounded integer points. Before reveal, only the submitting player receives their drawing. At reveal, players receive their own ink; host/shared display receive the gallery. Other players' drawings are excluded from player snapshots to avoid quadratic stroke traffic. Original strokes are stripped from submission and scored-presentation JSON after 24 hours during hourly maintenance; accepted values, score totals and replay receipts remain. Maintenance needs the service to be running.

No AI calls occur during answering, handwriting, recommendations or scoring. Existing Gemini quotas, ads approval gates, database permissions and connection pool remain. Three original illustrated backgrounds total approximately 854 KiB as WebP. New motion uses imperative bounded animation, without a React render every animation frame. Count remains capped at 128 physics bodies with the existing mobile frame limit and idle stop.

## Verification

- 168 unit/integration tests and three service E2E tests passed.
- Eleven real HTTP rounds, three independent cookie identities, WebSocket updates, replay receipts, persistence and a completed 9,501-point tied match passed locally, including original-ink persistence through the server reveal.
- All eleven games were manually operated through browser automation. Claw phase traces, Plinko trajectories, backward Sling release, caught fish, spatial Stack placement, safe wheels, Count tap/hold, Estimate entry, Guess submission, Size dragging, Draw/redraw/recognition/confirmation and original-stroke reveal were observed.
- All eleven active layouts passed at 320, 390, 768 and 1280 pixels: 44 cases with no horizontal clipping.
- Creator browser flow covered Single Answer, Multiple Answers and True/False, playable previews, saving and a real host lobby.
- A Node-only benchmark measured approximately 2.8 ms per settled 128-body physics frame and 1.4 ms per Plinko precomputation on this workstation. These are not phone FPS claims.

Screenshots and machine-readable checks are in the task's `outputs` folder, outside the source repository. Deployment IDs and final production verification are recorded there after release.

## Limits that remain

This is automated browser and protocol QA, not independent human playtesting. Physical touchscreen hardware, stylus input and low-end phone performance were not available for verification. The local recognizer cannot guarantee every handwriting style or connected digits; visible recognition and redraw are essential. The detailed original drawn strokes are resampled to the bounded point budget before transmission. No claim of perfect gameplay or universal recognition is made.

Artwork generation and saved asset paths are recorded in `ARTWORK-PROMPTS.md`. Ads and paid subscriptions remain disabled pending their separate setup.
