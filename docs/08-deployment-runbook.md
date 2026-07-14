# Core Heroku and Vercel Domains deployment runbook

## Preconditions

- Student Pack Heroku credit and current plan pricing are visibly confirmed.
- Auth0 issuer, audience, Native client ID, and scopes are configured.
- The owner is logged into the Vercel account that owns `glossa.sh`.
- Existing DNS records have been recorded or exported.
- CI is green.
- One relay replica is configured.

## Provision Heroku

```bash
heroku create <chosen-app-name>
heroku ps:type basic
heroku addons:create heroku-postgresql:essential-0
```

Configure settings and secrets through Heroku config vars. Do not paste them into issues, commits, or chat transcripts.

Required vars are documented in `.env.example`.

Set `GLOSSA_BIND_HOST=0.0.0.0` on Heroku so the router can reach the web process. Local and private-interface deployments should bind only to the interface that is intended to receive relay traffic.

## Deploy

Use GitHub integration or protected Git deploy after CI. The `release` process applies migrations. Before the first numbered release, schema changes do not need rolling backward compatibility: use coordinated deploys or a maintenance window. Never destroy non-disposable account/device data without explicit owner approval and a verified backup.

## Configure the domain through Vercel Domains

Known context: `glossa.sh` was acquired through Vercel Domains and already has an apex site.

1. In Heroku, add `mcp.glossa.sh` as the application's custom domain.
2. Copy Heroku's exact DNS target.
3. In the Vercel dashboard, open the domain/DNS view for `glossa.sh`.
4. Confirm the authoritative nameservers. If DNS is delegated elsewhere, make the record at the authoritative provider rather than changing delegation.
5. Record the complete current DNS set before editing.
6. Preserve apex, `www`, verification, email, and unrelated records.
7. Add the record for `mcp.glossa.sh` using the Heroku target.
8. Do not transfer the domain, replace nameservers, or move the existing website.
9. Verify the apex site remains healthy.
10. Verify Heroku ACM and HTTPS for `mcp.glossa.sh`.

The same relay hostname serves:

- `/mcp`
- `/device/*`
- `/v1/*`
- `/healthz`
- protected-resource metadata

Authorization, not hidden paths, protects routes.

## Health verification

```bash
curl --fail https://mcp.glossa.sh/healthz
```

Also verify:

- `https://glossa.sh` still serves the existing site;
- unauthorized `/mcp` receives the expected OAuth challenge;
- invalid device credentials receive `401`;
- revoked device credentials receive `401`;
- an enrolled worker polls successfully;
- active jobs disappear after restart and the worker reconnects;
- no token, file content, command arguments/output, or full local path appears in Heroku logs.

## Scaling rule

Keep `web=1`. Do not scale horizontally until active routing state has a coordination design outside the core MVP.

## Backup and rollback

- Schedule regular Postgres logical backups.
- Retain at least the last known-good release.
- Roll back application code before running an irreversible schema migration.
- Device/account metadata must survive application rollback.
- Workers must tolerate unknown registration generations and reconnect.
- DNS rollback means restoring the recorded prior `mcp` record only; never alter unrelated Vercel records.

## Cost guardrail

Expected core resources based on the original research:

- Basic dyno: approximately $7/month
- Essential-0 Postgres: approximately $5/month

Verify current prices and Student Pack credit before provisioning. Do not add paid add-ons without explicit owner approval.
