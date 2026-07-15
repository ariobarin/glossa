# @ariobarin/glossa

This package contains the `glossa` executable. Install the open beta from npm:

```powershell
npm install --global @ariobarin/glossa@beta
glossa login
glossa status
glossa whoami
Set-Location C:\path\to\a\repository
glossa
```

Login uses Auth0 Device Authorization Flow. Public tenant, client, and API identifiers are built in, so testers do not configure OAuth values.

OAuth and device credentials use the operating-system credential store. If it is unavailable, Glossa warns before using a restricted credential file.

The first managed session enrolls the computer under its hostname. Running `glossa` inside a Git worktree exposes only that worktree root. The process prints the canonical root, shell authority warning, and write or command activity. Press Ctrl+C to disconnect.

The managed endpoint defaults to `https://mcp.glossa.sh`. Development deployments may override `GLOSSA_RELAY_ORIGIN` and `GLOSSA_WORKER_ORIGIN`. Plain HTTP is accepted only for loopback relay origins and loopback or private IPv4 worker origins.
