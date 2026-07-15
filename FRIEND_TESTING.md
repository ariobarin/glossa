# Invite friends to test Glossa

Checked on 2026-07-15.

## What your friend needs

- Windows with Git, Node.js 20 or newer, and npm
- A disposable Git repository they are comfortable exposing
- ChatGPT on the web with developer mode available

ChatGPT Pro can connect custom MCP apps for read and fetch behavior. Full MCP write and modify support is currently limited to Business and Enterprise or Edu plans. Custom apps are web-only. See OpenAI's [developer mode and MCP apps guide](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) and [Apps in ChatGPT guide](https://help.openai.com/en/articles/11487775-connector).

## 1. Send your friend these two links

- Repository: `https://github.com/ariobarin/glossa`
- MCP endpoint: `https://mcp.glossa.sh/mcp`

## 2. Have them install the worker

In PowerShell:

```powershell
npm install --global @ariobarin/glossa@beta
glossa login
```

They should create their Auth0 account and finish the browser login. Authentication succeeds before private beta admission, but Glossa access remains blocked until you admit the account.

## 3. Admit their account

1. Open Auth0 Dashboard.
2. Go to User Management, then Users.
3. Open your friend's new user.
4. Copy the exact User ID. It usually starts with `auth0|`.
5. Run the admission command from this repository:

```powershell
heroku run --app ariobarin-glossa "npm run admit --workspace @glossa/relay -- '<exact-auth0-user-id>'"
```

Use the immutable Auth0 User ID, not their email address. The command admits a new account or restores an existing disabled account without exposing database credentials.

## 4. Have them start a safe worker

They should use a disposable test repository first:

```powershell
Set-Location C:\path\to\their\test-repo
glossa
```

The terminal prints the exact exposed root, device name, and security warning. Leave that terminal open. Ctrl+C disconnects the worker.

Glossa can modify files inside the exposed root and can run commands with the full environment and permissions of their Windows account. They should never expose their home directory, a drive root, or a repository containing credentials during initial testing.

## 5. Have them create the ChatGPT app

On `chatgpt.com`:

1. Open Settings, Apps, then Advanced Settings.
2. Enable developer mode.
3. Choose Create app.
4. Name it `Glossa`.
5. Enter `https://mcp.glossa.sh/mcp` as the MCP server URL.
6. Scan tools.
7. Complete the Auth0 authorization using the same account as the CLI.
8. Create the app. If ChatGPT says `Glossa` already exists, open that existing record instead of creating another name.

Client ID Metadata Document registration handles the ChatGPT OAuth client. They do not need a client ID, client secret, redirect URL, Heroku account, Auth0 tenant, VPN, or VPS.

## 6. Run the first demo

Start a normal ChatGPT chat, select Glossa, and ask:

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

- `account_not_admitted`: repeat the admission command with the exact Auth0 User ID.
- No online devices: confirm the `glossa` terminal is still running.
- App creation cannot scan tools: verify `https://mcp.glossa.sh/healthz` returns `{"ok":true,"service":"glossa-relay"}`.
- OAuth loops or expires: reopen the existing Glossa app and authorize it again. Do not create duplicate app names.
- Commands are unavailable on Pro: this is a ChatGPT plan limitation, not a worker failure.

## End the test

Press Ctrl+C in the worker terminal. The device remains enrolled for future sessions, but it is offline and cannot access the local workspace while the worker is stopped.
