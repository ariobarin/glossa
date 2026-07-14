# Start here: Glossa MVP handoff

This package is an implementation-ready handoff for building the first releasable **Glossa** MVP. The existing Veronica repository is a stale, unversioned prototype and is not the product baseline.

## Fixed naming and ownership

- Product: **Glossa**
- Website: **glossa.sh**
- CLI binary: **`glossa`**
- GitHub repository target: **`ariobarin/glossa`**
- npm package target: **`@ariobarin/glossa`**
- Hosted MCP endpoint target: **`https://mcp.glossa.sh/mcp`**
- Domain registrar/control plane: **Vercel Domains**

The owner acquired `glossa.sh` through Vercel Domains. Begin DNS work in the Vercel dashboard, preserve the existing apex website and records, and confirm the authoritative nameservers before making changes. Do not transfer the domain or replace the existing site as part of the MVP.

Do not call the binary `glossa.sh`. The `.sh` suffix belongs only to the website domain.

The unscoped npm name `glossa` is occupied by an npm security-holding package. Publish the scoped package `@ariobarin/glossa`, while exposing the executable name `glossa`.

## Core MVP package

The core plan contains only what is required to reach a usable private-beta MVP:

1. Product requirements and a strict MVP boundary.
2. A TypeScript monorepo scaffold.
3. A clean repository reconstruction plan, with the stale prototype available only as non-authoritative reference material.
4. A Student Developer Pack–optimized core service stack.
5. Auth0 device login and MCP OAuth.
6. Per-device enrollment and revocation.
7. A one-process Heroku relay with Postgres metadata.
8. Vercel Domains configuration for `mcp.glossa.sh`.
9. Autonomous-agent execution instructions with human login checkpoints.
10. Core acceptance tests and release criteria.

Post-MVP features and nonessential services are isolated under `optional/`. They are not prerequisites, login blockers, or part of the core definition of done.

## First commands

```bash
node scripts/preflight.mjs
npm install
npm run check
```

The scaffold is intentionally incomplete. It establishes the target repository, boundaries, service decisions, and initial authentication/control-plane code. Implement the worker and MCP routing from the current Glossa specifications and acceptance tests. The stale prototype may be inspected for ideas or isolated test cases, but it must not constrain the design or be ported wholesale.

## Core service stack

- **GitHub**: repository, Actions, releases, npm trusted publishing
- **Heroku Basic dyno**: relay/control plane
- **Heroku Postgres Essential-0**: persistent account/device metadata
- **Auth0 Free**: CLI Device Authorization Flow and MCP OAuth
- **Vercel Domains**: registrar/DNS control plane for `glossa.sh`
- **npm**: package distribution for `@ariobarin/glossa`

Read these core files in order:

1. `AGENTS.md`
2. `automation/AGENT_KICKOFF.md`
3. `docs/01-prd.md`
4. `docs/02-architecture.md`
5. `TASKS.md`
6. `LOGIN_CHECKPOINTS.md`
7. `docs/09-acceptance-tests.md`

Read `optional/README.md` only after the core MVP is deployed or when the owner explicitly expands scope.
