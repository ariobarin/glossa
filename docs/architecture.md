# Core MVP architecture

## Topology

```text
OAuth-capable MCP client
        │
        │ HTTPS + Auth0 access token
        ▼
mcp.glossa.sh
Heroku Basic dyno
  ├─ Auth0 JWT verification
  ├─ MCP adapter
  ├─ account/device routing
  ├─ in-memory jobs/workspaces
  └─ metadata persistence ─── Heroku Postgres
        ▲
        │ HTTPS + per-device credential
        │ repeated outbound polling (≤20 s)
        │
glossa process on user device
  ├─ canonical root
  ├─ path/symlink enforcement
  ├─ atomic file operations
  └─ bounded one-shot commands
```

`glossa.sh` is registered through Vercel Domains. Vercel DNS routes only `mcp.glossa.sh` to the Heroku custom-domain target; the existing apex website remains where it is.

## Why this is the minimum hosted shape

The relay must be publicly reachable, but the user's computer should make outbound connections only. A single Heroku web process supplies the rendezvous point and OAuth-protected MCP endpoint. Postgres stores only identity and lifecycle metadata. All active routing state remains in memory.

The user does not operate a VPS. Heroku is the operator's shared managed service.

## Identity planes

### MCP client identity

Auth0 handles OAuth discovery, login, consent, and access tokens. The relay validates issuer, audience, expiry, and `glossa:access` scope. The relay then requires an existing admitted account for the access-token subject. Authentication never creates or admits an account automatically.

### CLI user identity

The published CLI is one Auth0 Native application using Device Authorization Flow. The embedded client ID is public. The CLI requests `openid profile offline_access glossa:device`.

### Worker device identity

After user login, the CLI calls the device-enrollment API. The server returns a device token once:

```text
gld_<device-id>_<random-256-bit-secret>
```

The database stores the device ID, account ID, salt, and scrypt hash. Worker requests authenticate the device token over HTTPS. One device can be revoked without affecting the user's other devices or MCP authorizations.

## State ownership

### Postgres

- accounts
- devices and revocation
- device names
- schema migrations
- metadata-only audit events

### Relay memory

- active worker connections
- device IDs and connection generations, without local absolute paths
- pending jobs
- workspace leases
- request waiters
- recent nonces and bounded rate-limit counters

### Worker

- exposed canonical root
- path enforcement
- local process execution
- complete inherited local environment and developer credentials
- temporary active command state

## Hosted request timeout constraint

Heroku's router requires an initial response within its request window. Therefore:

- worker long polls return within 20 seconds;
- worker poll wait time is reduced by authentication time so the complete request remains bounded;
- `run_command` returns promptly after the worker accepts the command and supplies a command ID;
- command execution continues locally beyond the initiating request;
- `get_command` may wait up to 15 seconds, and `cancel_command` uses a separate bounded request;
- no hosted request remains open for the lifetime of a command.

The core protocol uses ordinary MCP tools for command start, status, result, and cancellation. Native MCP Tasks support is deferred until target clients support it dependably.

## Deployment scale

Use exactly one web dyno for MVP because active jobs and workspaces are process-local. Do not scale horizontally as part of the core MVP.

## Local development

Local mode may skip Auth0 only when bound to loopback and clearly marked development-only. Production code paths must exercise the same account and device ownership checks.
