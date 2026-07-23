# Open beta guide

Glossa is currently a Windows-first open beta. Start with a disposable Git repository that does not contain credentials or important work.

## Requirements

- Windows with Git, Node.js 22.9 or newer, and npm
- A disposable Git repository
- ChatGPT Pro on the web for read and fetch tools only, or ChatGPT Business, Enterprise, or Edu for full MCP access
- For managed workspaces, an admin, owner, or authorized Enterprise/Edu role with permission to create a custom app in Developer Mode

Glossa is not listed in the public plugin directory yet, so add it as a custom app in Developer Mode during the open beta. Personal Pro accounts can inspect a workspace with read-oriented tools. File writes and commands require Business, Enterprise, or Edu because OpenAI currently limits full MCP actions to managed workspaces.

## Install and connect

Install the beta CLI with either method.

Hosted installer:

```powershell
irm https://glossa.sh/install | iex
```

Direct npm install:

```powershell
npm install --global @ariobarin/glossa@beta
```

The installer checks Windows, Node.js, and npm, installs
`@ariobarin/glossa@beta`, and verifies the installed CLI. To inspect it first:

```powershell
irm https://glossa.sh/install -OutFile install.ps1
Get-Content .\install.ps1
.\install.ps1
```

After Glossa starts, press `u` to update from the beta channel.

## Start a worker

Open PowerShell in a disposable repository and run:

```powershell
glossa
```

Glossa opens Google sign-in automatically when needed. Choose the Google account you want to use for Glossa. After sign-in, the session display shows the workspace, connection, activity, and security warning. Press `s` for account and device status, `d` for recent activity, or `q` or Ctrl+C to disconnect. Press `?` to see every key.

Starting Glossa authorizes connected clients to modify files inside the exposed root and run commands with the full environment and permissions of your Windows account. Do not expose your home directory, a drive root, or a repository containing credentials.

## Enable Developer Mode and add Glossa

1. Follow OpenAI's [Developer Mode guide](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta) for your plan and workspace role.
2. Open **Settings > Plugins**, choose **Developer mode**, and enable **Developer mode** under **Security and login**. If your workspace has an **Apps** settings page instead, use **Settings > Apps > Advanced Settings**.
3. Authorized users can choose **Settings > Apps > Create**. Business admins and owners can instead choose **Workspace settings > Apps > Create**.
4. Name the custom app **Glossa**, enter `https://mcp.glossa.sh/mcp` as the MCP server endpoint, and choose OAuth authentication.
5. Choose **Scan Tools**, complete authorization using the same Google account as the worker, wait for the scan to finish, then choose **Create**.

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

- Press `s` in Glossa to check the account, relay, enrolled devices, and active workers.
- No Create option: confirm your plan supports full MCP apps and your workspace role has Developer Mode access.
- No online devices: confirm the `glossa` terminal is still running.
- App setup cannot discover tools: confirm `https://mcp.glossa.sh/healthz` returns `{"ok":true,"service":"glossa-relay"}`.
- OAuth loops or expires: reopen the custom Glossa app and authorize it again.
- Wrong Google account: press `l` in Glossa and confirm, open Glossa under **Settings > Plugins** in ChatGPT and disconnect it, then reconnect and sign in on both sides with the same Google account. Use **Settings > Apps** if that is the label your workspace shows.
- Account access fails: open a GitHub issue without including tokens, credentials, or local paths.

## Disconnect

Press `q` or Ctrl+C in the worker terminal. The device remains enrolled for later sessions, but it is offline and cannot access the local workspace while the worker is stopped.

Press `l` and confirm to sign out locally and in the browser.

Press `s` to list enrolled computers, then `r` to revoke one.
