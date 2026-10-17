# Pixel-art recovery — 18 October 2026

This release supersedes the illustrated-world direction documented in EMERGENCY-REBUILD.md.

## Recovered artwork

Git history and the supplied screenshots identify the original repository SVGs as the preferred artwork: workshop, factory, stars, library and reef. These exact assets are reused, not regenerated approximations. Each of the eleven games uses a distinct 480px-grid SVG stage. Illustrated WebP overrides and fallbacks are removed from application CSS; historical image files remain recoverable. Background creatures, paper, gears, conveyor motion and restrained lights use CSS transforms or opacity, with reduced-motion support. No new image generation or AI requests were made.

## Controls and creation

- Claw has continuous held keyboard/on-screen arrows, immediate stopping, and Space/Enter to drop. Grabbing measures the actual capsule and chute geometry; the carried capsule retains its color. Descent, grip, lift, carry and release stay visible before the reveal. Keyboard input is scoped away from other creator controls.
- Drop preserves intentional True/False selection while showing continuous deterministic gravity and peg collisions. Sling measures the real target centers so its projected trajectory and assisted shot agree.
- Stack uses magnitude-based denominations plus unit blocks, rejecting new recommendations that need more than 32 placements. Tests cover 5, 12, 40, 400, 4,000 and 100,000. Older published rounds with impractical denominations receive repaired presentation values without mutating their stored answer, published version or accepted numerical step.
- Draw has a clear Read / Redraw / Confirm & submit path and locked acknowledgement. Recognized values are read-only. Uncertain recognized digits can be reviewed explicitly; out-of-range readings explain why submission is unavailable. Actual strokes remain in the reveal and personal standings comparison. The technical retention paragraph is removed from gameplay; privacy documentation retains the storage disclosure.
- Size starts with a readable reference and a camera that stays fixed during resizing. Explicit zoom controls handle unusually broad scales. Numeric scoring still uses calibrated dimensions.
- The creator shows one suggested-game panel and a Change action with compatible games only. Unsupported word formats no longer suggest the internal setup record. Existing explicit multiple-choice/multiple-selection semantics remain preserved; ordinary Fish questions have exactly one correct fish.

## Verification and boundaries

Automated checks cover server scoring, private projections, bounded handwriting, reconnect/replay, expiry and all eleven games. Browser checks physically used Claw keys, Sling drag, Stack drag/key placement, Draw strokes/recognition/redraw/submission, moving Fish, safe wheels, Count hold/release, Guess and calibrated Size. All eleven loaded controls fit at 320, 390 and 1280px without horizontal document overflow.

A browser-created local quiz was saved, privately published, hosted and joined in another tab. Stack 4,000 and Drop were accepted; Fish expired while other checks ran. Final score was 1,500, correctly including the unanswered round. Separately, the independent HTTP/WebSocket verification plays all eleven rounds and verifies totals, privacy, reloads and session completion.

Mobile checks use browser viewport/pointer controls, not physical phones or native touch/stylus hardware. The local lightweight digit recognizer is best-effort; connected or unusual handwriting may require redraw or the separate keyboard accessibility option. No independent human playtest is claimed. No database migration, new service, paid-plan change, or Gemini usage was needed.

Source is checkpointed in Git. Deployment IDs, final production status and non-secret release evidence are stored in the local recovery release report.
