# Core human login checkpoints

These are the only external-service logins required for the core MVP. The implementation agent may configure each service in a browser after the user logs in. It must never request or handle passwords or MFA codes.

Optional-service checkpoints are isolated in `optional/LOGIN_CHECKPOINTS.md` and must not block core delivery.

Use the exact order below.

## CP-01 — GitHub and Student Developer Pack

**Purpose:** verify education status, redeem the required Heroku offer, and manage the repository.

Agent actions before pause:

1. Open the official GitHub Education Pack page.
2. Open the GitHub repository settings page in another tab.
3. Explain that the user must sign in and complete any GitHub/MFA prompts.

Human action:

- Sign in to GitHub.
- Confirm Student Developer Pack access.

Agent actions after login:

- Record offer eligibility, not credentials.
- Rename or create `ariobarin/glossa`.
- Configure branch protection, Actions, environments, and repository settings as needed.

## CP-02 — Heroku Student offer

**Purpose:** activate the recurring Student Pack credit and create the core relay/database.

Human action:

- Sign in to Heroku through the official Student Pack redemption flow.
- Complete payment verification if Heroku requires it.

Agent actions after login:

- Confirm the education credit is visible before provisioning.
- Create one app in a nearby Common Runtime region.
- Select a Basic dyno because the relay must remain available.
- Provision Postgres Essential-0.
- Do not add Redis or paid add-ons.
- Record app name, region, Heroku hostname, database attachment name, and custom-domain DNS target.

## CP-03 — Auth0

**Purpose:** configure CLI Device Authorization Flow and MCP OAuth.

Human action:

- Sign in or create an Auth0 account.
- Complete email verification and MFA.

Agent actions after login:

- Create a production tenant.
- Create one Native application for the CLI.
- Enable Device Authorization Grant and refresh-token rotation.
- Create the Glossa API/audience and scopes.
- Configure Auth for MCP and protected-resource settings.
- Configure GitHub as the only social login connection for the private beta.
- Use the standard Auth0 tenant domain for core MVP; a branded auth subdomain is optional and must not block launch.
- Record issuer, client ID, audience, scopes, and public metadata URLs.
- Put secrets directly into Heroku config vars; do not expose them in chat.

## CP-04 — Vercel Domains for glossa.sh

**Purpose:** connect the existing Vercel-registered domain to the Heroku relay without disturbing the current website.

Known context:

- The owner acquired `glossa.sh` through Vercel Domains.
- The apex website already exists and must remain unchanged.

Human action:

- Sign in to the Vercel account that owns `glossa.sh` and complete MFA.

Agent actions after login:

1. Open the Vercel Domains/DNS view for `glossa.sh`.
2. Confirm whether Vercel nameservers are authoritative or whether DNS is delegated elsewhere.
3. Export, screenshot, or record the current DNS records before editing.
4. Preserve the apex, `www`, verification, email, and all unrelated records.
5. Add only the record required for `mcp.glossa.sh`, using the exact Heroku DNS target.
6. Do not transfer the registrar, replace nameservers, or move the marketing site.
7. Verify `glossa.sh` still works after the change.
8. Verify DNS resolution and the Heroku certificate for `mcp.glossa.sh`.

## CP-05 — npm

**Purpose:** publish `@ariobarin/glossa`.

Human action:

- Sign in to npm and complete MFA or passkey prompts.

Agent actions after login:

- Verify control of the `@ariobarin` scope.
- Configure trusted publishing from the GitHub Actions workflow.
- Do not create a long-lived npm token unless trusted publishing is unavailable.
- Confirm the package's `bin` field exposes `glossa`.
- Do not attempt to publish the occupied unscoped `glossa` package.
