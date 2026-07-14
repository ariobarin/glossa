# Optional backlog

Start this backlog only after the core MVP passes `docs/09-acceptance-tests.md` or the owner explicitly authorizes an item.

## O1 — Enhanced observability

- [ ] Decide whether production failures justify Sentry or another error tracker.
- [ ] Build and test a strict telemetry allowlist.
- [ ] Redeem the selected Student Pack offer.
- [ ] Add the integration without changing core request semantics.
- [ ] Add optional coverage reporting if it improves review quality.

## O2 — Local approval controls

- [ ] Define read, write, and command approval states.
- [ ] Add a local confirmation protocol owned by the worker.
- [ ] Ensure relay compromise cannot silently bypass local approval.
- [ ] Add timeout, disconnect, and unattended-mode behavior.

## O3 — Background and streaming jobs

- [ ] Define explicit job resources and cancellation semantics.
- [ ] Decide whether polling remains sufficient.
- [ ] Add streaming only with bounded backpressure and privacy rules.
- [ ] Do not add a queue or Redis until the resource model requires it.

## O4 — Web dashboard and teams

- [ ] Design account/device administration beyond the CLI.
- [ ] Add invitations, roles, and organization ownership only with tenant-isolation tests.
- [ ] Decide whether public signup and billing are warranted.

## O5 — Scale and isolation

- [ ] Measure real connection and request load.
- [ ] Select multi-replica coordination only after observing a bottleneck.
- [ ] Evaluate per-tenant process isolation, Durable Objects, or another model with a written ADR.

## O6 — Additional domain surfaces

- [ ] Add a branded Auth0 domain only if the beta needs it.
- [ ] Add a public status domain only when a status service exists.
- [ ] Make all changes through the authoritative DNS provider identified from Vercel Domains.
