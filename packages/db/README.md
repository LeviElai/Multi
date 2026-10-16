# Canonical persistence

`SqlStore` implements the shared `Store` contract with normalized relational
records. Production uses `PostgresDatabase`; `NodeSqliteDatabase` is for actual
file-backed local tests, and `D1DatabaseAdapter` is the private Sites evaluation
adapter. Edge imports use `src/index.ts`; import Node adapters directly.

Draft rounds and immutable published rounds are separate records. Sessions
reference a single published version. SQL triggers prohibit changing a published
version or inserting, changing or deleting its rounds. Publication builds and
seals the version within one transaction.

Every session mutation begins with a conditional state-version update and a new
random `last_mutation_id`. Every subsequent write, including answer history,
scoring runs, audit, event, outbox and idempotency receipt, checks that nonce.
Consequently a losing CAS cannot write children even when an adapter cannot
abort a batch based on an intermediate result. The losing caller gets 409, or
the original receipt when the same command already committed.

Submission revisions and score revisions remain in history. Snapshot queries
select only the latest submission and the current scoring run. Composite foreign
keys bind participant, round and scoring records to the same session. Join
capacity and join-lock checks occur in the same serialized update as membership,
event sequence and outbox creation. Opaque player/display credentials are stored
only as supplied digests; token issuance and hashing belong to the security layer.

## Migrations and recovery

- `drizzle/0000_initial.sql` is generated from `db/schema.ts` using drizzle-kit,
  with explicit immutability triggers appended. D1 applies the Drizzle migration.
- `migrations/sqlite/0001_initial.sql` is the equivalent standalone local bootstrap.
- `migrations/postgres/0001_initial.sql` uses UUID identifiers, TIMESTAMPTZ dates
  and JSONB configuration/answer/event/receipt fields, with dependency-ordered
  foreign keys and PostgreSQL immutability triggers.
- Node adapters track a checksum in `_schema_migrations`. Reapplying identical
  migration content is a no-op. PostgreSQL migration application takes an
  advisory transaction lock. Once deployed, do not edit an applied migration;
  add a new forward migration and update the migration runner to apply it.
- Rollback strategy is restoring a pre-migration backup to a new database and
  pointing the service at the restored instance. Never drop canonical tables as
  an automatic rollback. A managed PostgreSQL backup/restore exercise remains a
  deployment gate; local file close/reopen is not a substitute.

## Executed checks

Run the SQLite repository integration suite with the bundled tsx loader:

```sh
node --import ./node_modules/.pnpm/tsx@4.22.1/node_modules/tsx/dist/loader.mjs --test tests/integration/database.test.ts
```

The suite exercises real temporary database files, optimistic draft races,
immutable publication, concurrent joins, losing CAS no-ops, repeated mutation
receipts, FK rollback, retained histories, scoped/expired/revoked credentials,
index selection and file close/reopen. PostgreSQL adapter and migration require
an actual PostgreSQL staging run before claiming parity or production readiness.
