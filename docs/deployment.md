# Deployment

## Canonical production state

- GitHub repository: `ariobarin/glossa`
- Heroku app: `ariobarin-glossa`
- Web process count: one
- Database: one Essential-0 Postgres add-on
- MCP endpoint: `https://mcp.glossa.sh/mcp`
- Health endpoint: `https://mcp.glossa.sh/healthz`
- Auth0 issuer: `https://dev-fl2h5xhp6umeh74m.us.auth0.com/`
- Auth0 audience: `https://mcp.glossa.sh/`

Auth0 has one `Glossa CLI` Native application, one current ChatGPT third-party client, and one `Glossa API`. Client ID Metadata Document registration is enabled. Dynamic Client Registration is disabled. Public database signup and automatic Glossa account activation are enabled.

## Deploy

Every push to `main` runs CI. After the build succeeds, relay-affecting changes deploy the same tested commit automatically to Heroku and check `https://mcp.glossa.sh/healthz`. Documentation, website, and CLI-only changes do not restart the relay. GitHub Actions uses the revocable `HEROKU_API_KEY` repository secret.

For a manual recovery deployment, build first:

```powershell
npm ci
npm run check
```

Then deploy the reviewed `main` commit to Heroku:

```powershell
git push heroku main
```

The Heroku release process applies database migrations before the web release becomes active.

## Required Heroku config

- `DATABASE_URL`
- `GLOSSA_AUTH0_AUDIENCE`
- `GLOSSA_AUTH0_CLI_CLIENT_ID`
- `GLOSSA_AUTH0_ISSUER`
- `GLOSSA_BIND_HOST`
- `GLOSSA_DEVICE_AUTH_RATE_LIMIT`
- `GLOSSA_DEVICE_ENROLL_SCOPE`
- `GLOSSA_ENROLL_RATE_LIMIT`
- `GLOSSA_MCP_REQUIRED_SCOPE`
- `GLOSSA_PUBLIC_ORIGIN`
- `GLOSSA_RATE_LIMIT_WINDOW_MS`
- `GLOSSA_RELAY_REQUEST_TIMEOUT_MS`
- `GLOSSA_WORKER_POLL_MS`
- `NODE_ENV`

Keep values in Heroku config. Never copy secret values into commits, issues, or logs.
Keep `GLOSSA_RELAY_REQUEST_TIMEOUT_MS` at 18,000 milliseconds and never above 19,000 so hosted requests finish within 20 seconds.

## Open beta access

A valid Auth0 access token creates or activates its Glossa account automatically. Accounts with `disabled_at` set remain blocked.

## Verify

```powershell
Invoke-RestMethod https://mcp.glossa.sh/healthz
heroku ps --app ariobarin-glossa
heroku releases --app ariobarin-glossa --num 3
```

Also verify one real worker connects and ChatGPT can list its device.

## Publish the CLI

npm trusts the GitHub Actions workflow `publish-cli.yml` for the public package `@ariobarin/glossa`. The workflow uses short-lived OIDC credentials and does not require an npm token.

Prepare a `0.1.x` CLI version, build it, and inspect its package without publishing:

```powershell
npm run cli:prepare -- 0.1.0-beta.4
```

After merging that version change, tag the exact main commit and push the tag only when publication is intended:

```powershell
$version = node -p "require('./packages/cli/package.json').version"
git tag "cli-v$version"
git push origin "cli-v$version"
```

The tag must exactly match the version in `packages/cli/package.json`. Prerelease versions publish under `beta`; stable versions publish under `latest`.
Keep CLI versions on the `0.1.x` line until the release policy changes.

## DNS and TLS

`glossa.sh` remains at Vercel. Only `mcp.glossa.sh` points to the Heroku DNS target. Do not replace nameservers or alter the apex, mail, verification, or unrelated records.

The Vercel project is connected to GitHub with `site/` as its root directory. Changes under `site/` deploy automatically from `main`. For manual recovery:

```powershell
vercel deploy --prod --cwd site
```

## Recovery

- Keep the web process count at one.
- Retain a recent logical Postgres backup.
- Roll back application code before applying an irreversible schema change.
- Workers reconnect after relay restarts, but active jobs do not survive a restart.
- Restore only the previous `mcp` DNS record during DNS rollback.
