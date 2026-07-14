# Core MVP product requirements document

## Objective

Ship a private-beta MVP in which a fresh user can:

1. Install `@ariobarin/glossa`.
2. Run `glossa login`.
3. Authenticate in a browser.
4. Run `glossa` inside a Git worktree.
5. Add `https://mcp.glossa.sh/mcp` to an OAuth-capable MCP client.
6. Read and atomically write files and execute bounded one-shot commands.
7. Disconnect or revoke the computer.

No user-managed infrastructure is required.

## Personas

### Solo developer

Owns one or more computers and wants an agent to work in a local repository without pushing every change to a remote environment.

### Maintainer/operator

Runs the managed relay, reviews security boundaries, deploys updates, and needs diagnostics without receiving user source code.

## Core functional requirements

### CLI identity

- `glossa login` uses OAuth Device Authorization Flow.
- GitHub is the only enabled social login connection for the private beta.
- The CLI is a public client and contains no client secret.
- `glossa logout` removes local login credentials.
- `glossa whoami` identifies the account and token expiry.
- Login credentials are separate from per-device worker credentials.

### Private beta admission

- The private beta is invite-only.
- Successful GitHub authentication through Auth0 does not grant Glossa access by itself.
- The operator must explicitly admit an immutable Auth0 subject before that account can enroll devices or use MCP tools.
- Uninvited identities receive no device, workspace, job, or account-existence information.

### Device lifecycle

- First exposure enrolls a named device.
- Every device receives a unique random secret.
- Only a salted password hash is stored server-side.
- Devices can be listed, renamed, and individually revoked.
- Revocation takes effect at the next worker request.

### Exposure

- Running `glossa` with no path selects the current Git worktree root.
- Outside a Git worktree, the user must provide an explicit directory.
- Home and filesystem roots are refused unless `--allow-broad-root` is supplied.
- The canonical root is printed before connection.
- The canonical absolute path remains local and is never sent to the relay or MCP client.
- MCP clients identify an active root by device ID and the root-relative path `.`.
- Stopping the process ends useful access.

### MCP surface

- `list_devices`
- `open_workspace`
- `read_file`
- `write_file`
- `run_command`
- `get_command`
- `cancel_command`
- `close_workspace`

Tools that write or run commands must be accurately marked non-read-only and destructive-capable.

### Limits

- Starting `glossa` is the local authorization boundary for `write_file` and `run_command`; neither operation requires an additional local confirmation prompt.
- Startup must clearly warn that file tools can modify the exposed root and commands run with the full authority of the local worker account.
- Commands inherit the complete environment of the process that started Glossa, including available developer credentials.
- Glossa must not enumerate, persist, or log environment variables automatically.
- The local CLI must show write and command activity and provide an immediate disconnect control.
- Text file and captured output limit: 1 MiB each.
- `run_command` starts an asynchronous local job and promptly returns a command ID.
- `get_command` may wait up to 15 seconds, then reports status and returns the bounded result when complete.
- `cancel_command` terminates the command process tree.
- The core command lifecycle uses ordinary MCP tools and does not require native MCP Tasks support.
- Command lifetime is independent of the hosted request window, defaults to 15 minutes, and has a 60 minute hard maximum.
- Worker long poll: no more than 20 seconds.
- One active command per worker.
- Operations that cannot complete within the bounded request model are rejected in the core MVP.

### Tenancy

Every device, workspace, job, and audit event is owned by an immutable account identifier derived from Auth0 `sub`. Identifier guessing must not cross account boundaries.

## Non-functional requirements

- One small always-on Node process.
- One Postgres database.
- One deployment replica.
- No durable source code or command output.
- Restarts may terminate active calls; workers reconnect automatically.
- Structured logs are metadata-only and scrubbed.
- All public traffic uses HTTPS.
- Windows is the supported worker operating system for the private beta.
- Core CI and acceptance tests exercise Windows worker behavior.
- macOS and Linux worker support is deferred until after the Windows-first private beta.
- The existing `glossa.sh` apex site remains unchanged while `mcp.glossa.sh` is added through Vercel Domains.

## Success metrics

- Median fresh-user setup under 10 minutes.
- No manual OAuth application setup for end users.
- No user-managed VPS, VPN, or proxy.
- Device revocation under one poll interval.
- Zero cross-tenant results in adversarial integration tests.
- Relay cost remains within the current Heroku Student credit for beta traffic.

Anything not listed in this PRD is outside the core MVP. Post-MVP ideas are isolated under `optional/` and must not become hidden launch requirements.
