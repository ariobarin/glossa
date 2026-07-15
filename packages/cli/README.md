# @ariobarin/glossa

This package publishes the `glossa` executable.

```bash
npm install --global @ariobarin/glossa
glossa login
glossa status
glossa whoami
cd path/to/repository
glossa
glossa logout
```

Login uses Auth0 Device Authorization Flow and opens the complete verification URL when Auth0 provides one. The public tenant, client, and API identifiers are built in, so a fresh installation does not need environment configuration. Development deployments can override them with `GLOSSA_AUTH0_ISSUER`, `GLOSSA_AUTH0_CLI_CLIENT_ID`, and `GLOSSA_AUTH0_AUDIENCE`.

Refresh credentials use the operating-system credential store. If that store is unavailable, Glossa prints a warning before using its mode-0600 credential-file fallback.

The first managed session enrolls the computer under its hostname and stores the returned device credential in the same operating-system credential store. Running `glossa` inside a Git worktree exposes only that worktree root. The local process prints the full canonical root, shell-authority warning, and write or command activity. Press Ctrl+C to disconnect immediately.

The managed endpoint defaults to `https://mcp.glossa.sh`. Temporary or local deployments can set `GLOSSA_RELAY_ORIGIN` for authenticated enrollment and `GLOSSA_WORKER_ORIGIN` for outbound worker polling. Plain HTTP is accepted only for loopback relay origins and loopback or private IPv4 worker origins.
