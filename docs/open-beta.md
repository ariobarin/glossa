# Open beta guide

Glossa is currently a Windows-first open beta. Start with a disposable Git repository that does not contain credentials or important work.

## Requirements

- Windows with Git, Node.js 24, and npm
- A disposable Git repository
- ChatGPT on the web with plugin access

Available actions depend on the current ChatGPT plan and plugin permissions. See OpenAI's [developer mode and MCP apps guide](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) and [Apps in ChatGPT guide](https://help.openai.com/en/articles/11487775-connector).

## Install and connect

Install the beta CLI:

```powershell
npm install --global @ariobarin/glossa@beta
```

## Start a worker

Change to a disposable repository and start Glossa:

```powershell
Set-Location C:\path\to\a\test-repo
glossa
```

Glossa opens browser login automatically when needed. After sign-in, the terminal prints the exposed root, device name, and security warning. Leave that terminal open while using Glossa. Press Ctrl+C to disconnect.

Starting Glossa authorizes connected clients to modify files inside the exposed root and run commands with the full environment and permissions of your Windows account. Do not expose your home directory, a drive root, or a repository containing credentials.

## Install the ChatGPT plugin

1. Open the [Glossa Live plugin](https://chatgpt.com/plugins/plugin_asdk_app_6a5702618d3081919dfdd643c18aba0c).
2. Choose **Install plugin**.
3. Complete the authorization using the same account as the CLI.

You do not need to configure OAuth, networking, or hosted infrastructure.

## Verify the connection

Start a ChatGPT conversation with Glossa Live selected and ask:

```text
List my connected devices.
```

The result should include one online device with root path `.`. Then try a harmless read:

```text
Open my connected Glossa workspace and read README.md.
```

Only test writes and commands inside the disposable repository.

## Troubleshooting

- No online devices: confirm the `glossa` terminal is still running.
- Plugin setup cannot discover tools: confirm `https://mcp.glossa.sh/healthz` returns `{"ok":true,"service":"glossa-relay"}`.
- OAuth loops or expires: reopen the Glossa Live plugin and authorize it again.
- Account access fails: open a GitHub issue without including tokens, credentials, or local paths.

## Disconnect

Press Ctrl+C in the worker terminal. The device remains enrolled for later sessions, but it is offline and cannot access the local workspace while the worker is stopped.
