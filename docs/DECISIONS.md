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
