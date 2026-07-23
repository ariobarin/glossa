# Quickstart

Connect ChatGPT to a local workspace.

## Before you begin

Make sure you have:

- Node.js 22.9 or newer
- [Developer Mode](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta) enabled in ChatGPT

> Glossa can modify files and run commands on your computer. Review the [security model](/docs/security).

## Step 1: Install Glossa

Choose your operating system. The npm package supports Windows, macOS, and
Linux. Windows also has a hosted PowerShell installer.

<div class="docs-switcher" data-docs-tabs data-tabs-storage="glossa-install-platform">
  <p class="docs-switcher-label">Operating system</p>
  <div class="docs-tabs" role="tablist" aria-label="Operating system">
    <button id="platform-windows-tab" type="button" role="tab" aria-selected="true" aria-controls="platform-windows" data-docs-tab="windows">Windows</button>
    <button id="platform-macos-tab" type="button" role="tab" aria-selected="false" aria-controls="platform-macos" data-docs-tab="macos" tabindex="-1">macOS</button>
    <button id="platform-linux-tab" type="button" role="tab" aria-selected="false" aria-controls="platform-linux" data-docs-tab="linux" tabindex="-1">Linux</button>
  </div>
  <div id="platform-windows" class="docs-tab-panel" role="tabpanel" aria-labelledby="platform-windows-tab" data-docs-tab-panel="windows">
    <div class="docs-switcher docs-switcher-nested" data-docs-tabs data-tabs-storage="glossa-windows-install-method">
      <p class="docs-switcher-label">Install method</p>
      <div class="docs-tabs" role="tablist" aria-label="Windows install method">
        <button id="windows-powershell-tab" type="button" role="tab" aria-selected="true" aria-controls="windows-powershell" data-docs-tab="powershell">PowerShell</button>
        <button id="windows-npm-tab" type="button" role="tab" aria-selected="false" aria-controls="windows-npm" data-docs-tab="npm" tabindex="-1">npm</button>
      </div>
      <div id="windows-powershell" class="docs-tab-panel" role="tabpanel" aria-labelledby="windows-powershell-tab" data-docs-tab-panel="powershell">
        <p>Run the hosted installer in PowerShell:</p>
        <pre><code class="language-powershell">irm https://glossa.sh/install | iex</code></pre>
      </div>
      <div id="windows-npm" class="docs-tab-panel" role="tabpanel" aria-labelledby="windows-npm-tab" data-docs-tab-panel="npm" hidden>
        <p>Install the beta directly from npm:</p>
        <pre><code class="language-powershell">npm install --global @ariobarin/glossa@beta</code></pre>
      </div>
    </div>
  </div>
  <div id="platform-macos" class="docs-tab-panel" role="tabpanel" aria-labelledby="platform-macos-tab" data-docs-tab-panel="macos" hidden>
    <p>Install the beta from npm in Terminal:</p>
    <pre><code class="language-shell">npm install --global @ariobarin/glossa@beta</code></pre>
  </div>
  <div id="platform-linux" class="docs-tab-panel" role="tabpanel" aria-labelledby="platform-linux-tab" data-docs-tab-panel="linux" hidden>
    <p>Install the beta from npm in your terminal:</p>
    <pre><code class="language-shell">npm install --global @ariobarin/glossa@beta</code></pre>
  </div>
</div>

Confirm Glossa is available:

```shell
glossa --version
```

Update later with `glossa update`.

## Step 2: Start a workspace

Open a terminal in the folder you want to expose, then run:

```shell
glossa --device-name "my-workstation" .
```

> Keep this terminal open while using Glossa.

## Step 3: Connect ChatGPT

1. Open **Settings > Plugins/Apps** and enable **Developer Mode**.
2. Choose **Create**.
3. Name the app **Glossa** and enter this MCP server URL:

```text
https://mcp.glossa.sh/mcp
```

4. Choose **OAuth**.
5. Sign in with the same Google account used by the Glossa CLI, then choose **Create**.

## Step 4: Verify the connection

In ChatGPT, select Glossa and send:

```text
Use Glossa to list my connected workspaces.
```

If Glossa lists the workspace, the connection is ready. Ask it to read a file
next.

## What next

- Read [why Glossa works this way](/docs/why).
- Review the complete [security model](/docs/security).
- Visit [support](/support) if the worker, OAuth flow, or app does not connect.
