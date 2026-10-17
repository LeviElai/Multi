# Decisions and evidence

- V3 rarity formula wins over V2/V1. Equal points share rank; display order follows joining order.
- All five modes remain required. No marketplace, classroom offering, global rarity or teams.
- Node 24.19.0 available; pnpm 11.25.0; Next 16.3.4 and React 19.2.6 pinned by supplied platform lock. The current Next documentation reports 16.4.2. A version upgrade requires separate compatibility/advisory checks; no assertion that the supplied pin is latest.
- Source architecture remains Next-compatible React + dedicated Node game service + PostgreSQL. Sites' Vinext adapter provides a private evaluation web deployment. If persistent Node/Postgres hosting is unavailable, an explicitly documented D1 adapter can run the same domain engine; it must not be described as the production PostgreSQL deployment.
- Sites deployments start owner-private. This platform access boundary means external guests cannot use that private URL without further access configuration; do not advertise an open beta.
- Server receive time controls input; no grace window. No speed bonus. Published quiz versions never mutate.
- Amountle uses V3's proposed <=100 absolute / >100 proportional curves, explicitly versioned; fairness around the threshold remains a playtest gate.
- English release UI; grapheme-safe engine. Additional languages are not advertised as validated.
- Only original built-in calibrated vector silhouettes are available initially; arbitrary active SVG uploads must never be accepted without sanitization/scanning.
- AI, billing and advertising fail closed until credentials, approved settings and test gates exist. No invented subscription prices or fake generation output.

## Reviewed primary documentation

- https://socket.io/docs/v4/delivery-guarantees/ (retrieved 2026-10-16): ordering does not imply durable arrival; receipts and snapshots supply application recovery.
- https://nextjs.org/docs/app/getting-started/deploying (retrieved 2026-10-16): Node/container and platform-adapter deployment options.

## Evaluation transport

The private Sites build uses D1 and 1.1-second snapshot polling. Deadlines remain server-authoritative; inactive rooms reconcile when requested. Continuous background reconciliation and Socket.IO run in the separate Node service. Private Sites access restricts guest reach; do not advertise this URL as an open party beta.

- 2026-10-17, explicit user correction: Think scoring v3.2 replaces the original V3 formula. A valid answer earns 200 + round(800 × (accepted players − group count) / (accepted players + 2)), rounded once at the end. Two distinct valid answers earn 400 each; matches earn 200. Invalid/unsubmitted answers earn zero and never inflate the rarity denominator. The small-sample adjustment prevents automatic 1,000-point ties in tiny rooms.
- Think spelling correction is deterministic and costs no API tokens: exact/alias matches first, then one unique minor edit (including adjacent transposition) for names of at least four characters. Numbers and short names are never fuzzy matched. Multiple candidate canonical answers enter host review; explicit host decisions override correction. This is bounded typo tolerance, not semantic AI judging.
- Account characters are one compact server-owned JSON record per creator, included in exports and passed atomically into new room joins. No new paid service, autoscaling, recurring job, or provider retry was added.
