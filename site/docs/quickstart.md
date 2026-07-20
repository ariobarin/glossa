# Put ChatGPT to work.

Glossa lets ChatGPT read files, make changes, and run commands in your folder.

Full Glossa access currently requires ChatGPT Business, Enterprise, or Edu on the web. You must be a Business admin or owner, or an Enterprise/Edu user authorized for [Developer Mode](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta).

## Install Glossa

Requires Node.js 24.

```shell
npm install --global @ariobarin/glossa@beta
```

## Start it in a folder

Open a terminal in the folder where you want ChatGPT to work.

```shell
glossa .
```

## Add it to ChatGPT

1. Open **Settings > Apps > Advanced Settings**, enable **Developer Mode**, then choose **Create**. Business admins and owners can also start from **Workspace settings > Apps > Create**.
2. Name it **Glossa** and paste this server URL:

```text
https://mcp.glossa.sh/mcp
```

3. Choose **OAuth**, then choose **Scan Tools**.
4. Complete the Glossa authorization prompt with the same Google account you used in the Glossa CLI, then wait for the tool scan to finish.
5. Choose **Create**.

## Test the connection

In ChatGPT, send:

```text
Use Glossa to list my connected devices.
```

## Switch Google accounts

Stop the worker, then clear Glossa's local and browser login:

```shell
glossa logout --browser
```

In ChatGPT, disconnect and reconnect Glossa under **Settings > Apps**. Choose the same Google account when ChatGPT and the CLI authorize Glossa again.

You can also ask ChatGPT to use Glossa's `logout` tool. ChatGPT will give you the browser link that you must open to clear the remembered Glossa login.
