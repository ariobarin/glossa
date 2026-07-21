# Connect ChatGPT to a folder.

Start Glossa, connect it to ChatGPT, and confirm it works.

You need Node.js 22.9 or newer and ChatGPT Business, Enterprise, or Edu with [Developer Mode](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta) access.

## Start Glossa

Open a terminal in the folder where you want ChatGPT to work, then run:

```shell
npm install --global @ariobarin/glossa@beta
glossa .
```

`glossa start .` is the explicit form. You can start more workers in other terminals to expose additional workspaces from the same computer.

## Connect ChatGPT

1. Open **Settings > Plugins**, choose **Developer mode**, and enable **Developer mode** under **Security and login**. If your workspace has an **Apps** settings page instead, use **Settings > Apps > Advanced Settings**.
2. Authorized users can create the custom app from **Settings > Apps > Create**. Business admins and owners can instead use **Workspace settings > Apps > Create**.
3. Name the app **Glossa** and paste this MCP server URL:

```text
https://mcp.glossa.sh/mcp
```

4. Choose **OAuth**, then **Scan Tools**. Complete authorization with the same Google account you used in the Glossa CLI, wait for the scan to finish, then choose **Create**.

## Try it

In another terminal, verify the account, relay, and active worker:

```shell
glossa status
```

In ChatGPT, send:

```text
Use Glossa to list my connected devices.
```
