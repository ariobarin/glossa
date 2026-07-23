# Glossa

Glossa lets ChatGPT work inside one local coding workspace that the user explicitly exposes.

```text
ChatGPT
  -> OAuth protected MCP relay
  -> authenticated outbound worker connection
  -> one local Git worktree or explicit directory
```

Glossa is an execution bridge, not an agent. ChatGPT owns the model, conversation, planning, and approvals. The local worker owns file containment and command execution.

## Why Glossa

Codex and ChatGPT Work share usage. Glossa connects the regular Chat surface to one local workspace without putting another model, planner, or agent in the middle.

## Status

Glossa is a Windows-first open beta. The managed relay is live at `https://mcp.glossa.sh/mcp`. A valid Glossa login activates access automatically.

Install the open-beta CLI with Node 24:

```powershell
npm install --global @ariobarin/glossa@beta
```

Then expose one workspace. Glossa opens Google sign-in automatically when needed:

```powershell
Set-Location C:\path\to\a\project
glossa
```

`glossa start .` is the explicit form. Pass `--device-name <name>` on the first start to give the computer a recognizable name in the device list. You can run additional workers in other terminals to expose more workspaces from the same computer. Use `glossa status` to verify login, relay access, enrolled devices, and active workers. Each device row lists its platform and when the relay last saw it, so stale enrollments are easy to spot. Run `glossa completions <shell>` to print a completion script for PowerShell, Bash, Zsh, or Fish.

On the first successful managed-relay connection on a computer, Glossa prints the ChatGPT quickstart link once. It records a `connect-hint-shown` marker in the local Glossa config directory so later starts stay quiet.

Starting `glossa` authorizes connected clients to modify files inside that root and run commands with the full environment and permissions of the Windows account that launched it. Press Ctrl+C to disconnect.

## ChatGPT

Glossa is not listed in the public plugin directory yet, so add it as a custom app in Developer Mode during the open beta. Follow the [quickstart](https://glossa.sh/docs/quickstart) to connect the managed Glossa endpoint.

See the [open beta guide](docs/open-beta.md) for safe setup, verification, and troubleshooting.

## Local development

Node 24 and Docker are required. Start local Postgres, create `.env` when missing, build, and migrate with:

```powershell
npm run dev:setup
npm run dev
```

Stop local Postgres with `npm run dev:down`.

Glossa uses the managed relay by default. See [self-hosting](docs/self-hosting.md) if you prefer to operate your own relay, database, identity configuration, and CLI build.

## Documentation

- [Open beta guide](docs/open-beta.md)
- [Self-hosting](docs/self-hosting.md)
- [Architecture](docs/architecture.md)
- [Security model](docs/security.md)
- [API and protocol](docs/protocol.md)
- [Managed identity operations](docs/managed-identity.md)
