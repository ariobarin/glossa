# Quickstart

Connect ChatGPT to one local folder through a worker that enforces file boundaries and runs commands on your computer.

## Before you begin

Make sure you have:

- Node.js 22.9 or newer
- A local folder you want ChatGPT to work in
- [Developer Mode](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta) available in ChatGPT

> Glossa can change files and run commands inside the folder with the authority of your operating-system account. Start with a folder you can safely test, and never expose your home directory or a filesystem root. Review the [security model](/docs/security) before enabling write actions.

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

Afterward, `glossa update` installs the newest beta. `glossa upgrade` is an
alias.

## Step 2: Start a workspace

Open a terminal in the folder where you want ChatGPT to work. The folder does
not need to be a Git repository. On this computer's first enrollment, choose a
recognizable device name:

```shell
glossa --device-name "my-workstation" .
```

`--device-name` is used only during initial enrollment. Later starts reuse the enrolled name; use `glossa devices rename <id> <name>` to change it. `glossa start .` is the explicit form. You can start more workers in other terminals to expose additional workspaces from the same computer.

> Keep this terminal open. Closing it disconnects that local workspace from ChatGPT.

## Step 3: Connect ChatGPT

The setup is the same for any ChatGPT account with Developer Mode.

1. In ChatGPT web, open **Settings > Apps > Advanced Settings** and enable **Developer Mode**. If your account shows **Plugins** settings instead, use **Settings > Plugins > Developer mode**.
2. Open **Settings > Apps > Create**.
3. Name the app **Glossa** and enter this MCP server URL:

```text
https://mcp.glossa.sh/mcp
```

4. Choose **OAuth**, then **Scan Tools**.
5. Complete authorization with the same Google account used by the Glossa CLI, wait for the scan to finish, then choose **Create**.

If a workspace controls custom apps centrally, its admin may need to enable
Developer Mode or grant access first.

## Step 4: Verify the connection

In another terminal, check the account, relay, enrolled device, and active worker:

```shell
glossa status
```

In ChatGPT, select Glossa and send:

```text
Use Glossa to list my connected workspaces.
```

When that works, ask ChatGPT to read a file that exists in the folder. Test
writes and commands only when you are comfortable with the selected folder and
review ChatGPT's confirmation before it runs.

## What next

- Read [why Glossa works this way](/docs/why).
- Review the complete [security model](/docs/security).
- Visit [support](/support) if the worker, OAuth flow, or tool scan does not connect.
