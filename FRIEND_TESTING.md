# Try the Glossa open beta

Checked on 2026-07-15.

## What your friend needs

- Windows with Git, Node.js 20 or newer, and npm
- A disposable Git repository they are comfortable exposing
- ChatGPT on the web with plugin access

Available actions depend on the current ChatGPT plan and plugin permissions. See OpenAI's [developer mode and MCP apps guide](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) and [Apps in ChatGPT guide](https://help.openai.com/en/articles/11487775-connector).

## 1. Send your friend these two links

- Repository: `https://github.com/ariobarin/glossa`
- ChatGPT plugin: `https://chatgpt.com/plugins/plugin_asdk_app_6a5702618d3081919dfdd643c18aba0c`

## 2. Have them install the worker

In PowerShell:

```powershell
npm install --global @ariobarin/glossa@beta
glossa login
```

They should create their Auth0 account and finish the browser login. Their Glossa account activates automatically on the first authenticated request.

## 3. Have them start a safe worker

They should use a disposable test repository first:

```powershell
Set-Location C:\path\to\their\test-repo
glossa
```

The terminal prints the exact exposed root, device name, and security warning. Leave that terminal open. Ctrl+C disconnects the worker.

Glossa can modify files inside the exposed root and can run commands with the full environment and permissions of their Windows account. They should never expose their home directory, a drive root, or a repository containing credentials during initial testing.

## 4. Have them install the ChatGPT plugin

On `chatgpt.com`:

1. Open the [Glossa Live plugin](https://chatgpt.com/plugins/plugin_asdk_app_6a5702618d3081919dfdd643c18aba0c).
2. Choose **Install plugin**.
3. Complete the Auth0 authorization using the same account as the CLI.

They do not need a client ID, client secret, redirect URL, Heroku account, Auth0 tenant, VPN, or VPS.

## 5. Run the first demo

Start a normal ChatGPT chat, select Glossa Live, and ask:

```text
List my connected devices.
```

Expected result: one online device with root path `.`.

Then try a harmless read:

```text
Open my connected Glossa workspace and read README.md.
```

Only test writes and commands in a disposable repository and on a ChatGPT plan that supports those MCP actions.

## Troubleshooting

- `account_disabled`: contact the Glossa operator.
- No online devices: confirm the `glossa` terminal is still running.
- App creation cannot scan tools: verify `https://mcp.glossa.sh/healthz` returns `{"ok":true,"service":"glossa-relay"}`.
- OAuth loops or expires: reopen the Glossa Live plugin and authorize it again.

## End the test

Press Ctrl+C in the worker terminal. The device remains enrolled for future sessions, but it is offline and cannot access the local workspace while the worker is stopped.
