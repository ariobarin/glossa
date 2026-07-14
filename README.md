# Glossa

Glossa lets a user explicitly expose one local coding workspace to an existing AI-agent harness through a managed MCP relay.

```text
agent harness
    │ OAuth-protected MCP
    ▼
Glossa managed relay
    │ per-device authenticated outbound polling
    ▼
glossa process on the user's computer
    │ locally enforced root
    ▼
local files and bounded one-shot commands
```

Glossa is an execution bridge, not an agent. The outer harness owns models, conversations, planning, approvals, retries, and user interaction.

## Prototype status

No numbered Glossa release exists yet. The current code and the older Veronica repository are prototype material, not compatibility baselines. Until the first numbered public release, commands, configuration, protocols, schemas, and repository structure may change without aliases or migration shims.

## Intended user experience

```bash
npm install --global @ariobarin/glossa
glossa login
cd ~/code/project
glossa
```

The user signs in in a browser once. Glossa enrolls the computer, exposes only the selected Git worktree, and connects it to the stable MCP endpoint at `https://mcp.glossa.sh/mcp`.

Starting an exposure session authorizes the connected client to write files within the exposed root and run bounded commands without a second local prompt for each operation. The CLI displays the shell-authority warning and provides visible activity plus an immediate disconnect control.

Commands inherit the complete environment and permissions of the account that started Glossa, including available developer credentials. Glossa does not enumerate or log that environment automatically.

Commands run as asynchronous jobs. `run_command` returns a command ID promptly, while separate status and cancel operations allow installs, builds, and tests to continue beyond a single hosted request window.

## Domain context

`glossa.sh` was acquired through Vercel Domains. The existing apex site must remain intact. The core deployment adds only the records needed for `mcp.glossa.sh`, after first exporting or recording the current DNS configuration and confirming which nameservers are authoritative.

## Core MVP constraints

- One Glossa account per Auth0 user.
- Multiple devices are allowed, but only one active worker per device name.
- One exposed root per running `glossa` process.
- File reads, atomic writes, and completed bounded one-shot commands.
- Per-device enrollment, listing, and revocation.
- No user-managed VPS, VPN, reverse proxy, TLS, or OAuth setup.
- Commands execute with the local operating-system account's permissions.
- This is not a sandbox.

The core specification is in `docs/01-prd.md`. Nonessential features and service integrations are kept separately under `optional/` and do not block the MVP.
