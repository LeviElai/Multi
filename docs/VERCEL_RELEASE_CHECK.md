# Vercel release verification — 17 October 2026

The existing GitHub repository is https://github.com/LeviElai/Multi and the production branch is main. The prior production baseline was 2563df6702658e3c60d9b7e8895b36296d19ef7c. It already included the site-wide pixel themes, creator workshop, renamed games, automatic rounds and placement lists. This release preserves that newer work; it does not replace it with the older Sites checkout.

Vercel project: multigame (prj_PHcrdooYVeUsJqrN7atsZGh5751x). Public production origin: https://multigame-ten.vercel.app. The chatgpt.site deployment is separate and is not the Vercel production domain.

Changes in this release:
- Automatic results explicitly name the actual highest-scoring player or tied round winners, including round points. The player's score ticket also states their overall place.
- Backend proxy requests have a 12-second cancellation deadline, preserve client cancellation and return safe, uncached JSON on connection failure. Credentials and upstream diagnostics are not disclosed.
- Production verification scripts bound individual HTTP requests to 45 seconds.
- Regression tests cover automatic tied-winner presentation and proxy failure responses.

Verification before release:
- 102 unit/integration tests passed.
- Two HTTP/Socket.IO end-to-end tests passed.
- TypeScript passed.
- Optimized Next.js production build passed using webpack. The local Turbopack build could not follow the reused dependency directory outside the checkout; this was an environment limitation, not a TypeScript or application build failure.
- Production HTTP verification exercised registration, saving/publishing, hosting, three isolated guest cookie sessions, read-only display, unauthorized host-action rejection, hidden answer keys, five games, authoritative scores, pause/resume, placement updates, reconnection, final results and logout.
- The actual production homepage opened without Vercel protection. Create redirected unauthenticated users to the creator sign-in form. Browser console inspection on these pages found only extension-origin metadata errors, no application errors.

Limits: HTTP sessions are not independent browser sessions. An authenticated creator browser journey and physical-device tests remain incomplete. Render resource inspection requires explicit workspace selection through the connector. Vercel has GAME_SERVICE_URL configured for production/preview; the deployed feature response advertises polling and credential authentication. No claim is made that Vercel hosts a persistent WebSocket server. No application auth, quiz privacy or host controls were disabled.

Release commit/deployment confirmation and post-release checks are reported in the delivery message.
