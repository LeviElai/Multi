# Authentication review — 3 November 2026

Scope: inspected custom credential/session handling, profile and appearance ownership, HTTP origin/rate controls, and account database constraints. This is not a completed ASVS audit or a claim that production is secure.

## Reproduced and repaired

- `GET /api/auth/profile` shared the 12/minute credential-attempt budget with login, registration and password changes. Routine profile reads could therefore reject both profile loading and later login. Reads now use the coarse HTTP budget; profile edits have a separate 30/minute budget. Credential mutations retain 12/minute throttling.
- Guest identities now receive a server-generated `Player NNNN` label stored against the existing stable user ID. Reusing the guest cookie retains the identity. Legacy `Daily guest` labels are upgraded on guest-session resume. Labels are not unique identifiers; collisions are permitted and records remain ID-keyed.

## Executed evidence

`node --import tsx --test tests/integration/auth-recovery.test.ts tests/integration/registration.test.ts` — 2 tests pass. `tests/unit/room-display-name.test.ts` additionally covers compact long-name labels. The HTTP recovery test starts the actual service against a fresh SQLite database and verifies:

- Twenty consecutive authenticated profile reads do not prevent login.
- An injected database outage returns an error without clearing the session cookie; the same cookie works after recovery.
- The persisted cookie authenticates after stopping and restarting the service against the same database.
- Twelve incorrect credential attempts trigger throttling on the next attempt; an already-authenticated profile remains accessible.

Registration integration checks cover password validation, immediate session creation, case-insensitive username collision rejection, reserved usernames, profile updates, account isolation, password change revocation of other sessions, guest identity separation and stable labels, and logout.

## Inspected architecture

- Authentication uses custom opaque seven-day sessions stored as SHA-256 token digests. It does not use Supabase Auth refresh tokens. There is no rolling refresh mechanism.
- Password hashes use salted scrypt. Cookies are HttpOnly, SameSite=Strict and Secure with a `__Host-` prefix under HTTPS. Server errors do not intentionally erase them.
- Profile mutations derive ownership from the session, not a submitted user ID. Username uniqueness is database-enforced. Appearance GET/PATCH `/api/v1/account/appearance` uses the same stable owner ID and validates the complete avatar schema.
- The HTTP service requires allowed Origin headers for mutations; Socket.IO has an origin allowlist. Production proxy configuration must preserve these assumptions.

## Open limitations and release checks

- The reproduced throttle defect is a concrete contributor, not proof of the sole cause of every reported returning-user failure. Real persistent mobile Safari/Chrome sessions, cross-tab behavior, deployed proxy/cookie forwarding and multi-hour returns still require browser evidence.
- Auth rate limits remain process-local and IP-based. Restarting or scaling the backend resets/splits those budgets. Shared networks may also share a credential budget. Durable account-aware failed-login limits would improve this.
- Password screening is a small local common-password set, not a comprehensive compromised-password database. Scrypt cost policy deserves a separate measured review.
- No email ownership verification or recovery flow was found in this custom auth handler. Immediate ordinary account use must not be described as email ownership verification. Do not introduce email-based recovery without verified possession.
- Registered display names are compacted to a 24-grapheme room label with an explicit ellipsis; the full profile name remains unchanged. The helper normalizes text, rejects controls/markup and avoids splitting graphemes. Unit regression verifies this path; full rendered room review remains required.
- No production database policies, ELIX isolation, hosted secrets, migration rollback, production dependency audit, broad injection testing or destructive tests were performed in this workstream. Other workstreams must supply that evidence.

Review references: [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). These guide review; passing local tests is not certification.

## Independent live database review (read-only, 21:29–21:32 UTC)

Project `wceqphhlgnqhlcxijtsg` was identified as MULTIGAME. Catalog queries verified all 45 tables in `multigame` have RLS enabled; both `anon` and `authenticated` lack schema USAGE and table SELECT/INSERT/UPDATE/DELETE grants. This includes auth accounts/sessions, runtime secrets, challenges and attempts. Live indexes enforce case-insensitive username uniqueness and one ranked attempt per `(day, owner_id)`; archive and ranking indexes exist.

The security advisor returned only informational `rls_enabled_no_policy` findings across server-only schemas and the backup. No-policy is intentional deny-by-default for this access model; adding broad policies would weaken it. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

`multigame.publish_daily_challenges` is SECURITY DEFINER with an empty search path and no EXECUTE privilege for anon/authenticated. The public `rls_auto_enable` function has EXECUTE grants but is an event-trigger function, not an ordinary callable application RPC; its inspected definition enables RLS on newly created public tables. No production rows or secrets were read, and no live writes were performed. ELIX objects were not modified. These catalog checks do not establish the privileges of the backend's deployed database login.

## Independent Daily/source integrity review

- API attempt routes derive the owner from authenticated or separate guest sessions and reject client-supplied identity fields via strict input schemas. Attempt reads and updates filter on both attempt ID and owner ID.
- Ranked attempt uniqueness is backed by the live partial unique index. Submission updates use revision checks, enforce the current index/server deadline, and bind idempotency keys to payloads. Current answers and explanations are omitted from active snapshots; previous-round answers become visible only after advancement.
- Current-day practice requires completion of the official run for new guest/registered scoring rules. Separate guest identities across browsers remain an acknowledged evasion path.
- Remaining competitive-integrity limitation: physical choice modes such as Claw/Slingshot/Plinko submit a selected answer directly. The server validates the answer and its receipt time, but cannot attest that the client performed the displayed physical interaction. Fishing has a server-time catch-window check; Stack validates submitted support geometry. Do not claim all physical gameplay is cheat-proof or that client interaction is fully server-simulated.
- Latest product instruction restores Daily speed scoring; the Daily workstream owns that scoring change and its validation. This review does not assert a no-speed invariant.
