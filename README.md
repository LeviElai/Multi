# MULTIGAME

A multiplayer pixel-art quiz arcade. Creators write questions and answers; MULTIGAME recommends an interaction. Guests join with a PIN and nickname.

Live: https://multigame-levi-6fe6.vercel.app/

## Eleven games

Count · Estimate · Guess · Draw · Size · Claw · Drop · Sling · Fish · Stack · Crack

Creation starts with **Single Answer**, **Multiple Answers**, or **True or False**. Local recommendations preserve answer semantics and exactness, and consider question context and quiz variety. Creators can preview and select compatible alternatives. Multiple selections and required lists use conventional inputs. Legacy rarity questions require explicit creator review before publication or new hosting; historical results remain readable.

## Architecture

- Next.js / React frontend: `app/`, `apps/web/`.
- Persistent HTTP + Socket.IO backend: `apps/game-service/`.
- Shared Zod contracts: `packages/contracts/`.
- Server-safe validation, scoring and registry: `packages/game-modes/`.
- Portable SQL persistence: `packages/db/`. Production PostgreSQL runs on Supabase in a private schema; SQLite supports local tests.
- Vercel frontend and Render realtime backend.

The server owns timers, accepted submissions, scores and rankings. Physics never determines correctness. Answer keys stay out of player projections before reveal. Idempotency receipts protect retries. Question metadata is a compact private JSON envelope in existing round records; published versions remain immutable.

## Local development

Node.js >=22.13 is required. Install from the committed lockfile using the repository's normal installation workflow. Export the values in `.env.example` in the appropriate terminal; never commit credentials.

Start the API with `node --import tsx apps/game-service/src/server.ts`, using PORT=4001, HOST=127.0.0.1, PUBLIC_ORIGIN=http://localhost:3005, a random PIN_PEPPER, SQLITE_PATH=.sites-runtime/local.sqlite and AUTO_MIGRATE=1.

In another terminal, set GAME_SERVICE_URL=http://127.0.0.1:4001 and run:

```sh
node node_modules/next/dist/bin/next dev --webpack -p 3005
```

On PowerShell, export with `$env:VARIABLE='value'`. Create a local creator account through sign-in. Guests do not need an account. The original Sites/Vinext scripts remain available; the explicit Next commands match the deployed Vercel application.

## Verification

```sh
npm run typecheck
node --import tsx --test tests/unit/*.test.ts tests/integration/*.test.ts
node --import tsx --test tests/e2e/*.test.ts
node node_modules/next/dist/bin/next build --webpack
```

Stop the dev server before building into the same `.next` directory.

With both local services running, `node --import tsx scripts/verify-arcade.mts` creates a private QA quiz, plays all eleven games with three independent HTTP identities and a real WebSocket, checks privacy, replay receipts, pause/resume, scoring, ties and completion, then archives the quiz. Set QA_ORIGIN and QA_SERVICE explicitly for a deployment. Credentials and cookies stay in ignored `.sites-runtime/`; reports contain no credentials. Automated QA is not human playtesting.

## Gameplay policies

- Exact answers remain exact when changing presentation. Proximity is explicit.
- Count is irreversible. Only accepted pours count; physics is decorative.
- Guess: 1,000 for first-try solve, minus 150 per extra attempt; finite repeated-letter allocation.
- Single choice: correct earns `round(1000 × (1 − 1/number_of_choices))`, incorrect zero. Drop therefore awards 500. No speed or dexterity bonuses.
- Draw: small on-device recognizer for separated non-negative whole-number digits. Recognition is best-effort, read-only and explicitly confirmed. Redraw to correct it. A separate accessibility input uses the same scoring. Bounded strokes are sent for the round reveal and expire after 24 hours during hourly maintenance.
- Stack scores represented units, with bounded rendering. Crack preserves declared digit width.
- Fish offers stationary answers; Claw/Sling offer keyboard controls; Drop has explicit aiming. Reduced motion and mute are respected.

## Costs and commercial features

Manual authoring, recommendations, live scoring and handwriting use no AI tokens. Gemini runs only for explicit creator requests. The 20-question monthly allowance, atomic reservations/refunds and request caps remain. Optional distractor suggestions use one credit and require review. Temporary-job maintenance does not delete saved quizzes.

No paid plan, hosting upgrade, extra cloud service or ad account is provisioned. Rewarded ads remain disabled pending publisher approval, ad demand, consent and final public policies. See `docs/MONETIZATION.md`. Free capacity and cold starts remain provider limits.

See `docs/ARCADE-RELEASE.md` and `docs/DECISIONS.md` for implementation and recovery details.
