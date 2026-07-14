# Core Heroku and Vercel Domains deployment runbook

## Preconditions

- Student Pack Heroku credit and current plan pricing are visibly confirmed.
- Auth0 issuer, audience, Native client ID, and scopes are configured.
- The owner is logged into the Vercel account that owns `glossa.sh`.
- Existing DNS records have been recorded or exported.
- CI is green.
- One relay replica is configured.

## Temporary RackNerd staging

While Heroku student verification is pending, merged Glossa revisions can be staged through the private `ariobarin/relay` repository. External MCP clients use `https://veronica.ariobarin.com/mcp`, but protected-resource metadata advertises the final Glossa API audience `https://mcp.glossa.sh/`. The staging hostname is not a compatibility promise, and the final managed endpoint remains `https://mcp.glossa.sh/mcp` on Heroku.

The VPS binds the relay only to its private WireGuard address. Caddy publishes `/mcp`, `/v1/*`, `/healthz`, and protected-resource metadata. Worker `/device/*` traffic stays on WireGuard and public requests to those paths return `404`. The Relay repository owns the temporary deployment workflow, systemd unit, Caddy routing, rollback, and reboot checks. See the [Relay staging operator procedure](https://github.com/ariobarin/relay/blob/main/docs/glossa-operations.md).

Do not mark this milestone complete from the staging deployment. Heroku credit, Postgres, DNS, ACM, restart recovery, and cost verification below remain required before the MVP endpoint is final.

## Configure Auth0

Use these public identifiers for the MVP tenant:

- Issuer: `https://dev-fl2h5xhp6umeh74m.us.auth0.com/`
- API audience: `https://mcp.glossa.sh/`
- Native application client ID: `9mwnK9nTAd8q1kxnKIZxC1wodxzfWHg5`

The `Glossa CLI` Native application enables only Device Code and Refresh Token grants. Refresh token rotation is enabled with a 30 day maximum lifetime. The `Glossa API` uses the RFC 9068 token profile, RS256 signing, per-application authorization, and offline access.

Define `glossa:device` and `glossa:access` permissions on the API. Grant the CLI user-delegated access to only `glossa:device`. The relay requires `glossa:access` for MCP requests. GitHub is the only login connection enabled for the CLI during the private beta.

Enable Dynamic Client Registration, Client ID Metadata Document registration, and the Resource Parameter Compatibility Profile in the tenant's Advanced settings. The authorization-server metadata must publish an `/oidc/register` endpoint. Dynamic Client Registration is open, so any MCP client can register an application, but registration does not admit an identity to Glossa.

For the Glossa API, keep user-delegated and client access set to per-application authorization. Set the default third-party user-delegated policy to `Authorized` with only `glossa:access` selected. Keep default third-party client access unauthorized. Do not grant `glossa:device` to dynamically registered MCP clients.

Promote the GitHub social connection to domain level so dynamically registered third-party applications can use it. The tenant's explicit Glossa account admission still rejects valid but uninvited GitHub identities before any device or workspace lookup.

The GitHub connection currently uses Auth0 development keys and requests only the required basic profile. This is suitable for MVP testing, but replace it with a dedicated GitHub OAuth application before a production launch.

The CLI embeds these public identifiers and needs no local Auth0 configuration. The same environment names remain available as development overrides. The relay still receives its issuer and audience through `GLOSSA_AUTH0_ISSUER` and `GLOSSA_AUTH0_AUDIENCE`.

## Admit a private beta account

Authentication never creates an account row. After verifying the immutable Auth0 `sub` value, admit it with an explicit database operation:

```sql
INSERT INTO accounts (id, auth0_subject, admitted_at)
VALUES (gen_random_uuid(), '<exact-auth0-subject>', now())
ON CONFLICT (auth0_subject) DO UPDATE
SET admitted_at = now(), disabled_at = NULL;
```

Do not use an email address or GitHub username in place of the exact Auth0 subject. A row with a null `admitted_at` or non-null `disabled_at` remains unable to enroll or manage devices.

## Provision Heroku

```bash
heroku create <chosen-app-name>
heroku ps:type basic
heroku addons:create heroku-postgresql:essential-0
```

Configure settings and secrets through Heroku config vars. Do not paste them into issues, commits, or chat transcripts.

Required vars are documented in `.env.example`.

The default fixed-window limits are 10 device enrollments per Auth0 subject and 120 device-authenticated requests per source address per minute. Override `GLOSSA_RATE_LIMIT_WINDOW_MS`, `GLOSSA_ENROLL_RATE_LIMIT`, or `GLOSSA_DEVICE_AUTH_RATE_LIMIT` only after reviewing expected worker counts and poll frequency.

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

Protected-resource metadata advertises the API audience `https://mcp.glossa.sh/` as its `resource` value. MCP clients still send protocol requests to `https://mcp.glossa.sh/mcp`.

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
