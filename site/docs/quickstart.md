# Connect ChatGPT to a folder.

Start Glossa, connect it to ChatGPT, and confirm it works.

You need Node.js 24 and ChatGPT Business, Enterprise, or Edu with [Developer Mode](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta) access.

## Start Glossa

Open a terminal in the folder where you want ChatGPT to work, then run:

```shell
npm install --global @ariobarin/glossa@beta
glossa .
```

`glossa start .` is the explicit form. You can start more workers in other terminals to expose additional workspaces from the same computer.

## Connect ChatGPT

1. Open **Settings > Apps > Advanced Settings**, enable **Developer Mode**, then choose **Create**.
2. Name the app **Glossa** and paste this server URL:

```text
https://mcp.glossa.sh/mcp
```

3. Choose **OAuth**, then **Scan Tools**. Authorize with the same Google account you used in the Glossa CLI, wait for the scan, then choose **Create**.

Business admins and owners can also begin at **Workspace settings > Apps > Create**.

## Try it

In another terminal, verify the account, relay, and active worker:

```shell
glossa status
```

In ChatGPT, send:

```text
Use Glossa to list my connected devices.
```
