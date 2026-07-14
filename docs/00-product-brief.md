# Product brief

## One sentence

Glossa turns an explicitly exposed local directory into a remotely accessible coding workspace for an existing agent harness.

## User problem

A user wants a hosted AI agent to work in a repository on their own computer without:

- uploading the repository to another service;
- exposing SSH or a public workstation port;
- configuring a VPS, VPN, reverse proxy, TLS, OAuth provider, and worker token;
- granting access to their entire computer.

## Promise

Install one CLI, sign in in a browser, run `glossa` from a Git worktree, and add one stable MCP endpoint to the agent.

## Product and domain context

- Product: Glossa
- Site: `glossa.sh`
- CLI: `glossa`
- Package: `@ariobarin/glossa`
- Managed endpoint: `https://mcp.glossa.sh/mcp`
- Domain: acquired through Vercel Domains

The MVP must preserve the existing `glossa.sh` website and use Vercel's domain/DNS controls only to add the relay subdomain.

## What Glossa owns

- User and client admission.
- Device enrollment and revocation.
- Routing MCP jobs to a user's active device.
- Short workspace leases.
- Safe metadata-only operational records.
- The public MCP endpoint and relay deployment.

## What stays local

- Repositories and worktrees.
- Build tools and developer credentials.
- File enforcement.
- Command execution.
- Command/file content except transient response transport.

## Not the product

- A coding agent.
- A cloud IDE.
- A repository host.
- Remote desktop.
- General workstation administration.
- A sandbox.

Post-MVP concepts are documented separately under `optional/`.
