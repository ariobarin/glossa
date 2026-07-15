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

Glossa is a Windows-first open beta. The managed relay is live at `https://mcp.glossa.sh/mcp`. A valid Glossa login activates access automatically.

Install the open-beta CLI from npm:

```powershell
npm install --global @ariobarin/glossa@beta
```

Then sign in and expose one workspace:

```powershell
glossa login
Set-Location C:\path\to\a\project
glossa
```

Starting `glossa` authorizes connected clients to modify files inside that root and run commands with the full environment and permissions of the Windows account that launched it. Press Ctrl+C to disconnect.

## ChatGPT

Install the Glossa plugin in ChatGPT:

[Install Glossa Live](https://chatgpt.com/plugins/plugin_asdk_app_6a5702618d3081919dfdd643c18aba0c)

See [FRIEND_TESTING.md](FRIEND_TESTING.md) for the complete setup workflow.

## Documentation

- [Product contract](docs/product.md)
- [Architecture](docs/architecture.md)
- [Security model](docs/security.md)
- [Data model](docs/data-model.md)
- [API and protocol](docs/protocol.md)
- [Deployment](docs/deployment.md)
- [Architecture decisions](docs/decisions.md)
