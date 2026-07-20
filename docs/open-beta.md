# Open beta guide

Glossa is currently a Windows-first open beta. Start with a disposable Git repository that does not contain credentials or important work.

## Requirements

- Windows with Git, Node.js 24, and npm
- A disposable Git repository
- ChatGPT on the web
- Permission to create a custom app in Developer Mode

Glossa is not listed in the public plugin directory yet, so add it as a custom app in Developer Mode during the open beta.

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

Glossa opens Google sign-in automatically when needed. Choose the Google account you want to use for Glossa. After sign-in, the terminal prints the exposed root, device name, and security warning. Leave that terminal open while using Glossa. Press Ctrl+C to disconnect.

Starting Glossa authorizes connected clients to modify files inside the exposed root and run commands with the full environment and permissions of your Windows account. Do not expose your home directory, a drive root, or a repository containing credentials.

## Enable Developer Mode and add Glossa

1. Follow OpenAI's [Developer Mode guide](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta) for your plan and workspace role.
2. In ChatGPT Settings, open **Apps**, choose **Create**, and name the custom app **Glossa**.
3. Enter `https://mcp.glossa.sh/mcp` as the MCP server endpoint and choose OAuth authentication.
4. Choose **Scan tools**, complete authorization using the same Google account as the worker, then create the app.

You do not need to create OAuth credentials, configure networking, or operate hosted infrastructure.

## Verify the connection

Start a ChatGPT conversation with the Dev-labeled Glossa app selected and ask:

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
- App setup cannot discover tools: confirm `https://mcp.glossa.sh/healthz` returns `{"ok":true,"service":"glossa-relay"}`.
- OAuth loops or expires: reopen the custom Glossa app and authorize it again.
- Wrong Google account: stop the worker, run `glossa logout --browser`, disconnect and reconnect Glossa under **Settings > Apps** in ChatGPT, then sign in on both sides with the same Google account.
- Account access fails: open a GitHub issue without including tokens, credentials, or local paths.

## Disconnect

Press Ctrl+C in the worker terminal. The device remains enrolled for later sessions, but it is offline and cannot access the local workspace while the worker is stopped.

Run `glossa logout` to remove only the CLI's local OAuth credentials. Run `glossa logout --browser` when switching Google accounts; it also opens Glossa's browser-session logout endpoint.
