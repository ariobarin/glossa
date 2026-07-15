# Self-hosting

Glossa is a managed service. Self-hosting is the optional alternative for people who prefer to operate the infrastructure themselves. A private installation consists of one public relay process, one Postgres database, one OAuth tenant, and the Windows CLI built from this repository.

## Requirements

- Node.js 24 and npm 11
- Postgres 17
- one public HTTPS origin for the relay
- an Auth0 tenant that issues JWT access tokens for your relay audience
- one Auth0 Native application with Device Code enabled for the CLI

Keep the relay at one process. Active worker routes and pending jobs live in relay memory, so horizontal scaling is not supported.

## Identity contract

Create an Auth0 API whose identifier is your relay audience, such as `https://mcp.example.com/`. Add these permissions:

- `glossa:access` for the MCP client
- `glossa:device` for CLI enrollment and device management

The Native application is a public client and needs Device Code and refresh token grants. Its allowed scopes must include `openid`, `profile`, `offline_access`, and `glossa:device`.

The MCP client must receive tokens from the same issuer, for the same audience, with `glossa:access`. Configure the client registration and consent flow using the current instructions from your identity provider and MCP client.

## Relay

Copy `.env.example` to `.env` and set at least:

```dotenv
NODE_ENV=production
GLOSSA_BIND_HOST=0.0.0.0
PORT=39100
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE
GLOSSA_PUBLIC_ORIGIN=https://mcp.example.com
GLOSSA_AUTH0_ISSUER=https://YOUR_TENANT.auth0.com/
GLOSSA_AUTH0_AUDIENCE=https://mcp.example.com/
```

Install, build, migrate, and start the relay:

```powershell
npm ci
npm run build
npm run migrate --workspace @glossa/relay
npm run start --workspace @glossa/relay
```

Terminate TLS in front of the relay. Confirm `https://mcp.example.com/healthz` returns an object with `ok` set to `true`.

## Windows CLI

Use the same issuer, audience, and Native application when running the repository build:

```powershell
$env:GLOSSA_RELAY_ORIGIN = "https://mcp.example.com"
$env:GLOSSA_WORKER_ORIGIN = "https://mcp.example.com"
$env:GLOSSA_AUTH0_ISSUER = "https://YOUR_TENANT.auth0.com/"
$env:GLOSSA_AUTH0_AUDIENCE = "https://mcp.example.com/"
$env:GLOSSA_AUTH0_CLI_CLIENT_ID = "YOUR_NATIVE_CLIENT_ID"

Set-Location C:\path\to\glossa
npm ci
npm run build

Set-Location C:\path\to\a\project
node C:\path\to\glossa\packages\cli\dist\main.js
```

Only the selected project is exposed. The command process still has the full authority and environment of the Windows account that launched it.

## ChatGPT

Add `https://mcp.example.com/mcp` as a custom MCP app in ChatGPT Developer Mode. This is a private app for your account or workspace. It is separate from the public Glossa app and the managed relay.

Review [architecture](architecture.md) and [security](security.md) before exposing the service to other users.
