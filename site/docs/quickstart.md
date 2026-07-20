# Put ChatGPT to work.

Glossa lets ChatGPT read files, make changes, and run commands in your folder.

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

1. Open **Settings > Apps > Advanced Settings**. Enable [Developer Mode](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta), then choose **Create**.
2. Name it **Glossa** and paste this server URL:

```text
https://mcp.glossa.sh/mcp
```

3. Choose **OAuth**, check the confirmation box, then choose **Create**.
4. Choose **Sign in with Glossa**.

## Test the connection

In ChatGPT, send:

```text
Use Glossa to list my connected devices.
```
