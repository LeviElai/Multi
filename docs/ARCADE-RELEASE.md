# Eleven-game arcade release

## Product changes

Question-first creation offers Single Answer, Multiple Answers and True or False, then asks for question and answer data. Local deterministic recommendations distinguish years/codes, exact numbers, estimates, calibrated size, words and choices. Overrides are restricted to compatible interactions. Distractors can be entered manually or explicitly suggested with one AI question credit; they still require review.

Count, Estimate, Guess and Size retain their established controls and timing. Draw, Claw, Drop, Sling, Fish, Stack and Crack use original pixel-grid artwork, shared audio and independent server validation. The official catalogue contains exactly eleven games. Multiple selections use Fish with exact-set scoring. Unsupported text/list questions remain incomplete drafts and cannot be previewed, published or newly hosted. No generic Answer game is offered.

The removed rarity format is not automatically reinterpreted. The editor preserves its question/answer catalogue and asks the creator to choose the new relationship explicitly. Publication, sharing and new hosting block unconverted legacy rounds. Historical scoring code remains for stored results and existing recovery; it is not selectable in the creator or AI maker.

## Persistence and compatibility

Question metadata (type, answer structure, answer-provided state and scoring policy) uses a private `__question` envelope in existing secret JSON. The SQL repository reconstructs typed metadata on read and removes the envelope from normal secret config. Player projections explicitly exclude the envelope and answer keys. This adds small bounded metadata per question and requires no table rewrite, migration, new service or public database grant.

Published rows remain immutable. Draft saves never change a running room. New games use the existing answer ledger, idempotency receipts, server clock and reconnect protocol. Choice IDs are independent of correctness: there is no public first-option-ID convention identifying the correct answer.

## Scoring

Exact numeric questions are all-or-nothing, independent of whether players draw, stack or type. Proximity must be explicitly selected. Existing Estimate/Count proximity curves retain their behavior for old versions.

Choice correctness earns `round(1000 × (1 − 1/n))` for n options, zero otherwise. Drop has two outcomes and earns 500 for correct. This transparently lowers the contribution of high-chance questions; it does not assume all trivia has equal difficulty. There are no speed, handwriting, dexterity or physics bonuses. Shared scores remain ties.

## Cost and performance

- No AI during typing, recommendation, handwriting or live scoring.
- Distractor generation uses the existing durable job queue/quota and verifies that the model retained the supplied correct answer. Invalid output refunds through the existing failure path. No automatic paid retries.
- Draw sends at most 32 strokes × 64 bounded points for the actual handwriting reveal. Both submissions and scored presentation remove ink after 24 hours in hourly maintenance, while numerical answers and points remain. Recognition is local and best-effort, with read-only confirmation, redraw and a separate accessibility input. Connected digits and all handwriting styles are not guaranteed.
- Fish uses forward-only swim passes, separate lanes and a stationary equivalent under the system reduced-motion preference. Other graphics use SVG/CSS/canvas and shared audio. New controls load dynamically.
- Count's bounded physics and mobile frame limit remain. Stack renders at most eighteen top blocks, with lower represented value compacted.
- The Supabase private schema, RLS posture, pool size, ownership and existing retention remain. Ads and payment flags stay closed.

## Verification and recovery

Run the commands in README. `scripts/verify-arcade.mts` exercises real HTTP and WebSocket flows for all eleven games with three independent cookie identities. Matching players tie at 9,501 for the sampler. It checks replay receipts, answer privacy, pause/resume, scoring, reveal and completion. Browser QA checks actual controls and responsive layouts separately.

This is automated QA, not human playtesting. Broader handwriting examples and real-world playability feedback remain valuable. Advertising activation and paid premium products are outside this release.

Do not roll back the database or rewrite published quizzes to roll back code. The metadata is optional. Use a compatible application commit and retain private configuration. Never commit `.sites-runtime/`, cookies, QA passwords or provider keys.

Verified locally: 152 unit/integration tests, 3 HTTP/Socket.IO E2E tests, optimized Next build with TypeScript, and all eleven active game controls at 320, 360, 375, 390, 430, 768 and 1280 pixels (77 cases; no horizontal overflow). A cold-load browser check exposed a parent Suspense reset, fixed with a local loading boundary and intro-time preload. The eleven-game three-client smoke test also passes after a fresh backend start with persisted exact scoring.
