# @ariobarin/glossa

This package contains the `glossa` executable. Node 24 is required. Install the open beta from npm:

```powershell
npm install --global @ariobarin/glossa@beta
Set-Location C:\path\to\a\repository
glossa
```

Glossa opens Google sign-in automatically when needed using OAuth Device Authorization Flow. Public client and resource identifiers are built in, so testers do not configure OAuth values. Use the same Google account when authorizing Glossa in ChatGPT.

OAuth and device credentials use the operating-system credential store. If it is unavailable, Glossa warns before using a restricted credential file.

The first managed session enrolls the computer under its hostname. Running `glossa` inside a Git worktree exposes only that worktree root. The process prints the canonical root, shell authority warning, and write or command activity. Press Ctrl+C to disconnect.

The managed endpoint defaults to `https://mcp.glossa.sh`. Development deployments may override `GLOSSA_RELAY_ORIGIN` and `GLOSSA_WORKER_ORIGIN`. Plain HTTP is accepted only for loopback relay origins and loopback or private IPv4 worker origins.

Run `glossa logout` to remove the CLI's local OAuth credentials. Run `glossa logout --browser` before switching Google accounts so the next Glossa authorization does not silently reuse the previous browser session.
