# Connect ChatGPT to a folder.

Start Glossa, connect it to ChatGPT, and confirm it works.

## Before you begin

Make sure you have:

- Windows with Node.js 22.9 or newer
- A Git repository you are comfortable exposing to ChatGPT
- ChatGPT Pro for personal read access, or ChatGPT Business, Enterprise, or Edu for full read, write, and command access through [Developer Mode](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta)

> Glossa gives ChatGPT the operating-system authority of the account running the worker. Start with a disposable repository and review the [security model](/docs/security) before enabling write actions.

## Step 1: Install Glossa

Open PowerShell and install the current beta with either method.

Hosted installer:

```shell
irm https://glossa.sh/install | iex
```

Direct npm install:

```shell
npm install --global @ariobarin/glossa@beta
```

The installer checks Windows, Node.js, and npm, then installs and verifies
Glossa. If you prefer to review it before running:

```shell
irm https://glossa.sh/install -OutFile install.ps1
Get-Content .\install.ps1
.\install.ps1
```

Confirm the command is available:

```shell
glossa --version
```

Afterward, `glossa update` installs the newest beta. `glossa upgrade` is an
alias.

## Step 2: Start a workspace

Open a terminal in the folder where you want ChatGPT to work. On this computer's first enrollment, choose a recognizable device name:

```shell
glossa --device-name "my-workstation" .
```

`--device-name` is used only during initial enrollment. Later starts reuse the enrolled name; use `glossa devices rename <id> <name>` to change it. `glossa start .` is the explicit form. You can start more workers in other terminals to expose additional workspaces from the same computer.

> Keep this terminal open. Closing it disconnects that local workspace from ChatGPT.

## Step 3: Connect ChatGPT

Choose the path that matches the ChatGPT account you are using. Your selection stays in sync across this guide.

<!-- audience-switcher:start -->
<!-- audience:personal -->

### Personal Pro

OpenAI currently limits custom MCP apps on ChatGPT Pro to read and fetch tools. You can connect Glossa for personal inspection, but file writes and commands require a managed workspace.

1. In ChatGPT web, open **Settings > Plugins**, choose **Developer mode**, and enable it under **Security and login**. If your account shows **Apps** settings instead, use **Settings > Apps > Advanced Settings**.
2. Open **Settings > Apps > Create**.
3. Name the app **Glossa** and enter this MCP server URL:

```text
https://mcp.glossa.sh/mcp
```

4. Choose **OAuth**, then **Scan Tools**.
5. Complete authorization with the same Google account used by the Glossa CLI, wait for the scan to finish, then choose **Create**.

> Personal limitation: ChatGPT Pro can use Glossa's read-oriented tools, but OpenAI currently reserves full MCP write and modify actions for Business, Enterprise, and Edu workspaces.

<!-- audience:workspace -->

### Business, Enterprise, or Edu

Managed workspaces support Glossa's full MCP tool set, including file changes and commands. Developer Mode must be enabled by the right workspace role.

1. **Business:** an admin or owner opens **Workspace settings > Apps > Create** and enables Developer Mode for their account.
2. **Enterprise or Edu:** an admin or owner grants Developer Mode access. An authorized user then enables it from **Settings > Apps > Advanced Settings**.
3. Create the app from **Workspace settings > Apps > Create** as an admin or owner, or from **Settings > Apps > Create** as an authorized user.
4. Name the app **Glossa** and enter this MCP server URL:

```text
https://mcp.glossa.sh/mcp
```

5. Choose **OAuth**, then **Scan Tools**.
6. Complete authorization with the same Google account used by the Glossa CLI, wait for the scan to finish, then choose **Create**.

> Workspace access: admins and owners control who can use the app and which actions it can take. Review Glossa's write and command tools before publishing it to other members.

<!-- audience-switcher:end -->

## Step 4: Verify the connection

In another terminal, check the account, relay, enrolled device, and active worker:

```shell
glossa status
```

<!-- audience-switcher:start -->
<!-- audience:personal -->

### Try a personal read

In ChatGPT, select Glossa and send:

```text
Use Glossa to list my connected devices, then read package.json from my active workspace.
```

If ChatGPT blocks a write or command tool, that is the current Pro plan boundary rather than a worker connection failure.

<!-- audience:workspace -->

### Try the full workspace flow

Start with a read-only check:

```text
Use Glossa to list my connected devices, then read package.json from my active workspace.
```

When that works, test a small edit inside a disposable repository and review ChatGPT's confirmation before it runs.

<!-- audience-switcher:end -->

## What next

- Read [why Glossa works this way](/docs/why).
- Review the complete [security model](/docs/security).
- Visit [support](/support) if the worker, OAuth flow, or tool scan does not connect.
