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

Personal Pro currently supports custom MCP read and fetch access. Full write and command access requires eligible Business, Enterprise, or Edu access. See OpenAI's [current MCP availability](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt).

## Status

Glossa is a Windows-first open beta. The managed relay is live at `https://mcp.glossa.sh/mcp`. A valid Glossa login activates access automatically.

Install the open-beta CLI with Node 24:

```powershell
npm install --global @ariobarin/glossa@beta
```

Then expose one workspace. Glossa opens browser login automatically when needed:

```powershell
Set-Location C:\path\to\a\project
glossa
```

Starting `glossa` authorizes connected clients to modify files inside that root and run commands with the full environment and permissions of the Windows account that launched it. Press Ctrl+C to disconnect.

## ChatGPT

Glossa is not listed in the public plugin directory yet, so Developer Mode is required during the open beta. The current setup requires ChatGPT on the web with full MCP write support and permission to create a custom app. Follow [Get started](https://glossa.sh/get-started) to confirm eligibility and connect the managed Glossa endpoint.

See the [open beta guide](docs/open-beta.md) for safe setup, verification, and troubleshooting.

## Local development

Node 24 and Docker are required. Start local Postgres, create `.env` when missing, build, and migrate with:

```powershell
npm run dev:setup
npm run dev
```

Stop local Postgres with `npm run dev:down`.

## Documentation

- [Open beta guide](docs/open-beta.md)
- [Architecture](docs/architecture.md)
- [Security model](docs/security.md)
- [API and protocol](docs/protocol.md)
