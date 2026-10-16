# MULTIGAME security boundary

Private-alpha implementation, not a security certification. No claim is made
that a penetration test, dependency scan, SAST scan, legal review or browser
accessibility audit has passed unless its execution is separately recorded.

## Trust and secrets

The authoritative Node adapter accepts creator identities only from its stored
credential sessions. `oai-authenticated-*`, user-id and role headers cannot
create a host. Sites uses its platform identity adapter behind its platform
boundary; it must never be copied as an unverified public Node header check.
The Node adapter does not implement OIDC or a trusted external proxy identity.

Creator session cookies are random 256-bit opaque values, stored as SHA-256
digests with expirations. Password storage uses per-password random salts and
Node scrypt. Production Secure/HttpOnly/SameSite cookies and exact Origin
checking protect cookie mutations. Password login is operator provisioned,
with eight login attempts per address per minute; shared networks may hit this
limit. Password recovery, account verification and MFA are unimplemented gates
for a wider account service.

Players receive per-session opaque HttpOnly credentials. Player/display
credentials cannot perform host commands. Displays use revocable, expiring,
read-only links. Treat display URLs as credentials: do not include them in
analytics, public embeds, chat previews or proxy logs. The app sets
Referrer-Policy: no-referrer; the supplied nginx log format redacts display paths
and omits query strings. Additional hosting access logs require the same control.

## Enforced protections

| Threat | Implementation |
|---|---|
| Identity header spoofing | Node `CreatorAuth.identify` only resolves stored credential sessions |
| Unauthorized quiz access | Owner checks in controller/store and immutable publication versions |
| Player/host/display escalation | Role and room checks before every mutation and canonical socket update |
| Cross-site mutations | Exact configured Origin allowlist; missing browser mutation origin rejected |
| Cross-site WebSocket hijack | Handshake Origin required, scoped cookie/link auth, per-command checks |
| Secret answer leakage | Role projections; no secret configuration in active snapshots |
| Duplicate/reordered packets | Durable mutation receipts, revisions and optimistic state versions |
| Late submissions | Server clock and canonical deadline; animation and client time have no authority |
| Restart loss | Database state, events and score ledger; snapshot reconciliation after restart |
| PIN enumeration | HMAC-derived PIN lookup and database-backed join throttling |
| Resource exhaustion | HTTP/body/socket limits, local connection/command budgets and bounded visual token pool |
| SQL injection | Parameterized SQL and validated structured inputs |
| Script uploads | Arbitrary uploads absent; scored silhouettes are built-in calibrated vectors |
| Commercial misuse | AI, ads and billing fail closed while integrations/review are absent |

The Node HTTP pre-parser caps bodies at 1 MiB; the shared API caps JSON input at
256 KiB. Socket payloads are limited to 32 KiB. Authentication and network
budgets are local to the one game process; the controller also persists
operation-specific limits. Horizontal scale requires shared login/connection
limits and load tests. Redis is optional and currently unused, never canonical.

## Transport details

The server emits `session.snapshot` with a direct role-filtered Snapshot.
Snapshots are read after commits and carry `stateVersion`/`latestSeq`. It skips
stale snapshots even if concurrent reads finish out of order. Socket commands
reuse the HTTP controller, so ACK `{data}` is sent only after the same durable
mutation path resolves. Errors use `{error}`. `session.resume` always refreshes
canonical state. Built-in Socket.IO recovery is not relied upon for correctness.

Handshake auth is `{sessionId, role?, displayToken?}` with same-origin cookies.
Supplying a role never grants that role. Commands are `host.action`,
`answer.submit`, `word.guess`, `review.decide` and `session.resume`.
Host/review commands need `idempotencyKey`; player commands retain their
`clientMutationId` for retries. Accepted answers cannot be recovered from a
client-side optimistic animation alone.

## Deployment controls still requiring validation

- HTTPS certificates, proxy forwarding and WSS behavior in the chosen host.
- Image digests, dependency advisory results, container/SAST scan results,
  third-party configuration and secret rotation drill.
- A nonce-based production CSP. The supplied proxy CSP still permits inline
  scripts for Next bootstrap; that remains a deliberate public-release gap.
- PostgreSQL pool/load limits, backup availability, restore drill and actual
  monitoring/incident notification routes.
- Public account enrollment/recovery, stronger identity controls and abuse
  operations. The current identity service is for invited, operator-provisioned
  hosts.
- Data inventory, retention periods, full data-subject export/delete completion,
  privacy/cookie notices and target-market legal review. A stored privacy
  request is a receipt, not proof that deletion happened.
- Browser/XSS testing, mobile/accessibility review, real cross-device rooms and
  a formal security review. Local protocol tests do not prove browser safety.

## Report a problem

The in-app report endpoint records an operator-reviewable receipt. No external
security contact or delivery system has been configured. The deployment owner
must publish a monitored contact and triage process before inviting unrelated
users. Do not send credentials or personal content in a public issue.
