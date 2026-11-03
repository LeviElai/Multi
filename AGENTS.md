<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## MULTIGAME product invariants

- Preserve existing handmade pixel artwork and palette. Use scoped shared components, not additional global override layers.
- Mobile first: essential gameplay fits the visible dynamic viewport without hiding controls. Inspect actual rendered mobile and desktop screens before accepting design work.
- One primary navigation: Home, Daily, Join, Quizzes (public community library), Profile. Personal quizzes are secondary within Quizzes/Profile.
- Casual play requires no account. Guest Daily completion is officially ranked under a server-issued temporary identity; do not claim cross-device guest uniqueness.
- Daily contains five actual minigames. No general response-speed multiplier or speed ranking tie-breaker. Regular multiplayer retains speed scoring.
- Global registered identity uses unique username plus avatar; multiplayer uses display name. Stable internal IDs own scores and quizzes.
- Preserve historical challenges/scores. Version scoring changes; never silently rescore historical attempts.
- Temporary backend failures must not destroy authentication. Bound loading and offer recovery.
- Protect ELIX. No destructive database changes or new paid infrastructure without approval; prepare rollback and integrity checks.
- Completion requires actual user-journey QA, independent visual review, and verification of deployed production commit. Failed/missing checks remain open.

Current rescue specification and verification: docs/rescue/.
