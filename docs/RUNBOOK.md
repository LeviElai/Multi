# MULTIGAME operations

This source supports a private alpha. The production-shaped path is the shared
Next UI, a long-lived Node/Socket.IO game service, a reconciliation worker and
PostgreSQL 17. The separate Sites deployment uses the same controller/domain
logic with D1 and polling; it is an evaluation adapter and not proof that the
Node/PostgreSQL stack has been deployed.

## Local Node service

Prerequisites: Node 24.19.0 and pnpm 11.25.0. From the repository root:

```sh
pnpm install --frozen-lockfile
export NODE_ENV=development
export PUBLIC_ORIGIN=http://localhost:4001
export PIN_PEPPER="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
export AUTH_BOOTSTRAP_EMAIL=host@example.test
export AUTH_BOOTSTRAP_NAME=Host
# Set AUTH_BOOTSTRAP_PASSWORD through your secret store or local shell, 16+ characters.
node --import tsx apps/game-service/src/server.ts
```

The service listens on port 4001. It exposes API and Socket.IO routes; a separate
Next UI is required for pages. SQLite is a real persistent local test database
only. Production startup refuses SQLite and requires HTTPS `PUBLIC_ORIGIN`,
`DATABASE_URL`, and a 32-character-or-longer `PIN_PEPPER`.

`GET /health/live` checks process lifecycle. `GET /health/ready` checks database
access. `GET /api/v1/features` reports integrations and transport. AI, billing,
and ads remain disabled. A missing bootstrap account cannot create a creator
identity. Existing stored accounts remain valid without bootstrap variables.

## Same-origin containers

`infra/compose.yaml` starts PostgreSQL, baseline migration, web, game, worker,
and nginx. Both the web and game use one HTTPS origin so scoped cookies work on
HTTP and WSS. Provide a real certificate as `fullchain.pem` / `privkey.pem` in
`TLS_CERT_DIR`. Never commit the private key or environment secrets.

Required environment values:

| Variable | Meaning |
|---|---|
| `PUBLIC_ORIGIN` | Exact HTTPS origin, without path or trailing slash |
| `POSTGRES_PASSWORD` | Database secret; use URL-safe characters or an encoded URL in custom deployments |
| `PIN_PEPPER` | Stable random secret, at least 32 characters |
| `AUTH_BOOTSTRAP_EMAIL` | Initial operator-provisioned creator email |
| `AUTH_BOOTSTRAP_PASSWORD` | Initial strong password, at least 16 characters |
| `TLS_CERT_DIR` | Absolute directory containing the certificate and private key |
| `AUTH_BOOTSTRAP_NAME` | Optional display name |

```sh
docker compose -f infra/compose.yaml config --quiet
docker compose -f infra/compose.yaml up --build -d
docker compose -f infra/compose.yaml ps
```

No database or game port is published outside the container network. nginx
overwrites forwarded client addresses; `TRUST_PROXY=1` is safe only under this
condition. Do not expose the game port publicly with this option unless the
network admits only a proxy that overwrites `X-Forwarded-For`. Keep the default
off for a directly exposed Node instance. Render evaluation should keep it off
until the trusted proxy chain is verified.

`infra/compose.redis.yaml` is an optional supporting-only overlay. The current
single-instance release does not consume Redis and does not depend on it for
correctness. Do not add instances until sticky routing, a compatible adapter,
distributed limits, and concurrency/load tests are accepted.

The Dockerfile validates TypeScript and runs the TypeScript service through
the pinned `tsx` runtime. The web target performs a real Next build. Lock image
digests after a successful registry pull/build, then run image advisory checks
before a release. Source configuration alone is not evidence of either check.

## Creator credentials

`POST /api/auth/login` accepts JSON `{email,password}` and issues an opaque
HttpOnly session cookie. HTTPS uses the `__Host-` cookie prefix, Secure,
SameSite=Strict, Path=/ and a seven-day expiry. Passwords are salted scrypt
hashes, and only token hashes are stored. `POST /api/auth/logout` revokes the
specific session. Authentication is checked again for every socket command and
every canonical update; revoked connections lose access on their next check.

Bootstrap inserts an account only if its email is absent; changing the bootstrap
password never silently overwrites an existing credential. Account creation is
operator-provisioned in this release. Public registration, email verification,
MFA and password recovery are not implemented.

To rotate an existing account, put the new password in a tightly permissioned
secret file, set `AUTH_ACCOUNT_EMAIL` and `AUTH_PASSWORD_FILE`, then execute:

```sh
node --import tsx apps/game-service/src/credentials.ts rotate
```

This atomically replaces the password hash and revokes all existing sessions.
Remove the temporary secret file after rotation. Never send passwords as CLI
arguments or paste them into logs. Rotating `PIN_PEPPER` invalidates lookup of
existing room PINs; schedule that rotation between events. Existing scoped
participant credentials are independent of the PIN pepper.

## Database migration, backup and recovery

The initial migration is checksummed. PostgreSQL migrations use advisory
locking; SQLite migration metadata prevents replaying an altered migration.
Run `node --import tsx apps/worker/src/main.ts --migrate` before starting the
new version. `AUTO_MIGRATE=1` is provided for the free evaluation blueprint;
production uses the separate migration job. Future schema changes must be new,
reviewed migrations and compatible with the previous application during rollout.

Use managed PostgreSQL backups and point-in-time recovery where the selected
plan supports them. A backup setting is not a completed restore drill. Before
production, restore into a separate database, run migrations, verify private
quiz ownership and immutable publications, resume an active room, and compare
score totals against the pre-restore sample. Record duration, recovery point
and any lost transactions. Never test restore over the only production copy.

For operator-controlled exports, keep connection credentials in a secret file
or a protected environment rather than command history:

```sh
pg_dump --format=custom --file=multigame.backup "$DATABASE_URL"
pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner multigame.backup
```

Restrict access to backups: they contain answer keys, host account data,
pseudonyms and credential hashes. Retention durations and verified deletion
procedures remain a legal/operations release gate. The worker deletes expired
creator sessions only; it does not claim to implement the full retention policy.

## Deploy and rollback

1. Run type checking, deterministic tests, persistence/authorization tests,
   network lifecycle tests, Next build, dependency audit and container checks.
2. Back up PostgreSQL and verify migration compatibility. Deploy one game
   instance for the current alpha. Configure readiness and HTTPS/WSS routing.
3. Stop routing new traffic to the old instance. SIGTERM marks it unready,
   emits `server.draining`, closes sockets, completes pending work and closes
   the database. The process has a 25-second forced-exit bound.
4. Clients reconnect and fetch a full authorized snapshot. The 500 ms game
   reconciler and independent one-second worker process expired deadlines
   using committed state/CAS. No score is inferred from client animation.
5. If health or gameplay fails, revert to the previous image only if schema
   compatibility is verified; otherwise restore into a separate database and
   follow the incident plan. Never erase the live database as a rollback shortcut.

`infra/render.yaml` is an evaluation blueprint, not a created resource. Workspace
confirmation, a supported repository connection, schema validation and actual
creation/deployment are distinct requirements. See `HOSTING.md` for provider
limits and the current deployment boundary.

## Verification commands and evidence

```sh
pnpm exec tsc --noEmit
pnpm test
node --import tsx --test tests/e2e/*.test.ts
PLAYERS=25 node --import tsx tests/load/room.ts
pnpm --dir apps/web build
pnpm audit --prod --audit-level high
```

The network test starts real child Node processes, talks HTTP and Socket.IO,
connects ten players, plays all five modes, sends duplicate/stale commands, kills the service with
SIGKILL during a round and after completion, and checks persisted recovery.
It also checks header spoofing, CSRF, origin rejection and role projections.
It uses SQLite deliberately and cannot substitute for deployed PostgreSQL,
mobile browser, TLS proxy, accessibility or sustained load verification.

The load command creates its own isolated temporary database and simulates
distinct clients behind a deliberately trusted local proxy header. It records
acknowledgment latency and scoring counts under `tests/reports/`. It never sends
traffic to a production service. A 100-client local run requires `PLAYERS=100`
and is still not a deployed capacity claim. CI configuration describes gates;
the fact that a workflow exists does not mean it has run.

Recorded locally on 2026-10-16: both network lifecycle/security tests passed,
including ten-player five-mode completion and the two forced process crashes.
The isolated 25-player burst accepted 25/25 answers with correct scores and
p95 acknowledgment latency of 50 ms. The isolated 100-player burst accepted
100/100 with correct scores and p95 acknowledgment latency of 466 ms
(maximum 682 ms). These are one-round local SQLite/Node measurements, not
regional event-propagation, sustained-load or production capacity results.
The default room cap remains 25.

## Incident triage

- API 503/readiness failure: inspect database availability, migration result and
  pool saturation. Keep existing database state. Disable new hosting first.
- Stuck round: inspect canonical session state/deadline and reconciler error
  events. Restart the worker after the cause is fixed. Do not manually add awards.
- Repeated 409: clients must fetch current state, preserve mutation IDs for
  retries, and never silently overwrite a newer accepted input.
- Unexpected login failures: check bootstrap account existence, origin and
  Secure-cookie routing. Do not enable trusted identity headers as a workaround.
- Suspected compromise: revoke relevant creator sessions and display links,
  rotate affected secrets, preserve a restricted incident log, and scope the
  impact before any external notification decision.

Structured application logs include route, status and latency, but omit request
bodies, cookies, credentials and display-token path segments. The supplied nginx
format redacts display paths and omits query strings. Additional hosting access
logs need equivalent redaction before production. Add alert
destinations and agreed thresholds for readiness, failed reconciliation,
submission rejection/latency and resource usage; those integrations are not
configured by this repository.
