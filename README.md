# Glossa

Glossa lets ChatGPT work inside one local coding workspace that the user explicitly exposes.

```text
ChatGPT
  -> OAuth protected MCP relay
  -> authenticated outbound worker connection
  -> one local Git worktree or explicit directory
```

Glossa is an execution bridge, not an agent. ChatGPT owns the model, conversation, planning, and approvals. The local worker owns file containment and command execution.

## Status

Glossa is a Windows-first private beta. The managed relay is live at `https://mcp.glossa.sh/mcp`. Tester accounts require explicit operator admission.

The CLI package is not published yet. Install it from the repository:

```powershell
git clone https://github.com/ariobarin/glossa.git
Set-Location glossa
npm ci
npm run build
npm install --global .\packages\cli
```

Then sign in and expose one workspace:

```powershell
glossa login
Set-Location C:\path\to\a\project
glossa
```

Starting `glossa` authorizes connected clients to modify files inside that root and run commands with the full environment and permissions of the Windows account that launched it. Press Ctrl+C to disconnect.

## ChatGPT

Create a custom app in ChatGPT developer mode with this MCP URL:

```text
https://mcp.glossa.sh/mcp
```

See [FRIEND_TESTING.md](FRIEND_TESTING.md) for the exact owner and tester workflow.

## Documentation

- [Product contract](docs/product.md)
- [Architecture](docs/architecture.md)
- [Security model](docs/security.md)
- [Data model](docs/data-model.md)
- [API and protocol](docs/protocol.md)
- [Deployment](docs/deployment.md)
- [Architecture decisions](docs/decisions.md)
