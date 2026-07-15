# Deployment

Glossa production uses one Heroku web process and one Postgres database. Active routing state is process-local, so the relay must not scale horizontally until routing has an external coordination design.

Operational inventory, such as platform resource names and Auth0 application counts, belongs in operator records rather than this guide. Public endpoints and required client identifiers remain documented where clients need them.

## Automated deployment

Every push to `main` runs CI. After the build succeeds, relay-affecting changes deploy the same tested commit to Heroku and check `https://mcp.glossa.sh/healthz`. Documentation, website, and CLI-only changes do not restart the relay.

The deployment workflow reads its Heroku credential from the `HEROKU_API_KEY` repository secret. The release process applies database migrations before the web release becomes active.

## Required configuration

Configure these values in Heroku:

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

Never copy secret values into commits, issues, or logs. Keep `GLOSSA_RELAY_REQUEST_TIMEOUT_MS` at 18,000 milliseconds and never above 19,000 so hosted requests finish within 20 seconds.

## Manual recovery deployment

Build and verify the reviewed `main` commit before pushing it to Heroku:

```powershell
npm ci
npm run check
git push heroku main
```

Check the public health endpoint and the target Heroku app:

```powershell
Invoke-RestMethod https://mcp.glossa.sh/healthz
heroku ps --app <app-name>
heroku releases --app <app-name> --num 3
```

Also verify that a real worker connects and ChatGPT can list its device.

## Open beta access

A valid Auth0 access token creates or activates its Glossa account automatically. Accounts with `disabled_at` set remain blocked.

## Publish the CLI

npm trusts the GitHub Actions workflow `publish-cli.yml` for `@ariobarin/glossa`. The workflow uses short-lived OIDC credentials and does not require an npm token.

Prepare a `0.1.x` CLI version, build it, and inspect its package without publishing:

```powershell
npm run cli:prepare -- 0.1.0-beta.4
```

After merging that version change, tag the exact `main` commit and push the tag only when publication is intended:

```powershell
$version = node -p "require('./packages/cli/package.json').version"
git tag "cli-v$version"
git push origin "cli-v$version"
```

The tag must exactly match the version in `packages/cli/package.json`. Prerelease versions publish under `beta`; stable versions publish under `latest`. Keep CLI versions on the `0.1.x` line until the release policy changes.

## Website, DNS, and TLS

The Vercel project uses `site/` as its root directory and deploys changes from `main`. For manual recovery:

```powershell
vercel deploy --prod --cwd site
```

Only `mcp.glossa.sh` should point to the Heroku custom-domain target. Preserve the apex site and all unrelated DNS records when changing that route.

## Recovery principles

- Keep the web process count at one.
- Retain a recent logical Postgres backup.
- Roll back application code before applying an irreversible schema change.
- Expect workers to reconnect after relay restarts. Active jobs do not survive a restart.
- Restore only the previous `mcp` DNS record during DNS rollback.
