# Open beta guide

Glossa is currently an open beta for Windows, macOS, and Linux. Start with a folder that does not contain credentials or important work.

## Requirements

- Node.js 22.9 or newer and npm
- Developer Mode enabled in ChatGPT

Glossa is not listed in the public plugin directory yet, so add it as a custom app through Developer Mode during the open beta.

## Install and connect

On Windows, install the beta CLI with the hosted PowerShell installer:

```powershell
irm https://glossa.sh/install | iex
```

On Windows, macOS, or Linux, install directly from npm:

```shell
npm install --global @ariobarin/glossa@beta
```

The installer checks Windows, Node.js, and npm, installs
`@ariobarin/glossa@beta`, and verifies the installed CLI. To inspect it first:

```powershell
irm https://glossa.sh/install -OutFile install.ps1
Get-Content .\install.ps1
.\install.ps1
```

Run `glossa update` later to upgrade from the beta channel. `glossa upgrade` is
an alias.

## Start a worker

Change to the folder you want to expose and start Glossa. On this computer's first enrollment, choose a recognizable device name:

```shell
cd path/to/a/test-folder
glossa --device-name "my-workstation" .
```

`--device-name` is used only during initial enrollment. Later starts reuse the enrolled name; use `glossa devices rename <id> <name>` to change it. `glossa start .` is the explicit form. Start more workers in other terminals when you want to expose several workspaces from the same computer.

To try the experimental compact session HUD instead, run `glossa ui .`. It immediately starts the worker, shows connection and tool activity, and keeps the worker-account authority warning visible. Press `d` for details, `?` for help, or `q` to disconnect.

Glossa opens Google sign-in automatically when needed. `glossa login` is available as an optional preflight. Choose the Google account you want to use for Glossa. After sign-in, the terminal prints the exposed root, device name, connection state, and security warning. On the first successful managed-relay connection on a computer, it also prints the ChatGPT quickstart link. A `connect-hint-shown` marker in the local Glossa config directory suppresses that hint on later runs. Leave that terminal open while using Glossa. Press Ctrl+C to disconnect.

Starting Glossa authorizes connected clients to modify files inside the exposed root and run commands with the full environment and permissions of your operating-system account. Do not expose your home directory, a filesystem root, or a folder containing credentials.

## Enable Developer Mode and add Glossa

1. Follow OpenAI's [Developer Mode guide](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta).
2. Open **Settings > Plugins/Apps** and enable **Developer Mode**.
3. Choose **Create**.
4. Name the custom app **Glossa**, enter `https://mcp.glossa.sh/mcp` as the MCP server endpoint, and choose OAuth authentication.
5. Sign in with the same Google account as the worker, then choose **Create**.

You do not need to create OAuth credentials, configure networking, or operate hosted infrastructure.

## Verify the connection

Start a ChatGPT conversation with the Dev-labeled Glossa app selected and ask:

```text
List my connected devices.
```

The result should include one online device with root path `.`. Then try a harmless read:

```text
Use Glossa to read a file that exists in my active workspace.
```

Only test writes and commands inside a folder you are comfortable modifying.

## Troubleshooting

- Run `glossa status` to validate Google login, relay access, enrolled devices, and active workers.
- Run `glossa doctor` to check Node.js, relay reachability, sign-in state, and the local device credential before reporting a problem.
- No Create option: confirm Developer Mode is enabled and your workspace role has access.
- No online devices: confirm the `glossa` terminal is still running.
- App setup cannot discover tools: confirm `https://mcp.glossa.sh/healthz` returns `{"ok":true,"service":"glossa-relay"}`.
- OAuth loops or expires: reopen the custom Glossa app and authorize it again.
- Wrong Google account: stop the worker, run `glossa logout --browser`, open Glossa under **Settings > Plugins** in ChatGPT and disconnect it, then reconnect and sign in on both sides with the same Google account. Use **Settings > Apps** if that is the label your workspace shows.
- Account access fails: open a GitHub issue without including tokens, credentials, or local paths.

## Disconnect

Press Ctrl+C in the worker terminal. The device remains enrolled for later sessions, but it is offline and cannot access the local workspace while the worker is stopped.

Run `glossa logout` to remove only the CLI's local OAuth credentials. Run `glossa logout --browser` when switching Google accounts; it also opens Glossa's browser-session logout endpoint.

Use `glossa devices list`, `glossa devices rename <id> <name>`, or `glossa devices revoke <id>` to recover stale enrollments and remove computers you no longer trust. Each listed device shows its platform and when the relay last saw it, which helps identify computers that are offline or duplicated.
