# Core architecture decisions

## ADR-001 — Rebrand to Glossa

**Decision:** product Glossa, site `glossa.sh`, binary `glossa`.

**Reason:** one consistent product identity. The domain suffix must not leak into executable naming.

## ADR-002 — Scoped npm package

**Decision:** publish `@ariobarin/glossa`.

**Reason:** unscoped `glossa` is occupied by an npm security-holding package. npm package naming and executable naming are independent.

## ADR-003 — Heroku for the core MVP

**Decision:** one Basic dyno and Essential-0 Postgres, subject to current Student Pack verification.

**Reason:** the original research placed the pair inside the recurring student credit; it removes VPS administration and fits the existing Node architecture.

## ADR-004 — Auth0 for identity

**Decision:** use one Auth0 tenant, one Native CLI application, and Auth for MCP.

**Reason:** Auth0 directly supports Device Authorization Flow and standards-based MCP OAuth. Avoid implementing an authorization server.

## ADR-005 — Per-device random secret

**Decision:** enroll each device with a unique 256-bit token, stored server-side only as a salted scrypt hash.

**Reason:** simple, revocable, and implementable for MVP.

## ADR-006 — One relay replica

**Decision:** one process only for MVP.

**Reason:** active jobs and workspace leases are in memory. Horizontal scale without coordination risks misrouting and lost state.

## ADR-007: Asynchronous command jobs

**Decision:** `run_command` starts an asynchronous local job and promptly returns a command ID. Commands default to a 15 minute timeout and have a 60 minute hard maximum. `get_command` may wait up to 15 seconds before returning current status or the final result. `cancel_command` terminates the job. These are ordinary MCP tools and do not require native MCP Tasks support.

**Reason:** unattended coding agents need long-running commands, while the hosted request boundary must not depend on command duration. Ordinary tools provide broader client compatibility than the experimental native task lifecycle.

## ADR-008 — No durable content

**Decision:** no file or command content in Postgres, logs, or audit events.

**Reason:** minimize privacy risk and preserve the product's local-compute promise.

## ADR-009 — Preserve the worker boundary

**Decision:** implement and test local path/process enforcement from current Glossa requirements.

**Reason:** the gateway cannot safely enforce access to resources it does not own.

## ADR-010 — Keep Vercel Domains as domain control plane

**Decision:** retain `glossa.sh` at Vercel Domains and add only `mcp.glossa.sh` for the Heroku relay.

**Reason:** the owner already controls the domain there, the apex site exists, and registrar or website migration adds risk without helping the MVP. Confirm authoritative nameservers before editing because DNS may be delegated.

## ADR-011 — Separate core and optional scope

**Decision:** all post-MVP features, alternate services, and nonessential integrations live under `optional/`.

**Reason:** optional work must not become an implicit blocker, login requirement, or dependency of the core MVP.

## ADR-012 — Prototype reset before the first numbered release

**Decision:** treat all existing code and interfaces as replaceable prototype material until Glossa intentionally publishes its first numbered public version. The stale Veronica repository is reference-only. No aliases, shims, parity target, deprecation period, schema compatibility, or history preservation are required before that release.

**Reason:** compatibility promises are meaningful only after users have a released version to depend on. Removing imaginary constraints lets the MVP adopt the simplest secure design.

## ADR-013: Windows-first private beta

**Decision:** Windows is the only supported worker operating system for the private beta. macOS and Linux worker support follows after the Windows launch baseline is complete.

**Reason:** the primary development and initial user environment is Windows. Path containment, junction handling, command execution, and process-tree termination require direct platform acceptance evidence before launch.

## ADR-014: GitHub-only social login

**Decision:** GitHub is the only enabled social login connection for the private beta.

**Reason:** Glossa initially serves developers, and one login provider keeps Auth0 configuration, account identity, and authentication testing narrow for the MVP.

## ADR-015: Invite-only private beta

**Decision:** only Auth0 subjects explicitly admitted by the operator may enroll devices or use MCP tools. Authentication does not create or admit an account automatically.

**Reason:** controlled admission limits security exposure, abuse, and operating cost while command execution, tenant isolation, and revocation are validated.

## ADR-016: Local-only canonical paths

**Decision:** the full canonical path is displayed only by the local CLI. MCP clients identify an active root by device ID and root-relative path `.`, and the relay does not receive a root label, repository name, or local absolute path.

**Reason:** device ID plus a relative path is sufficient for routing and file operations without exposing the Windows username, repository name, or local directory structure.

## ADR-017: Session-authorized writes and commands

**Decision:** starting an exposure session authorizes the connected MCP client to write within the exposed root and execute bounded commands without a separate local prompt for each operation. Commands retain the full authority and permissions of the local worker account. The CLI must show the shell-authority warning, visible activity, and an immediate disconnect control.

**Reason:** per-operation confirmation prevents unattended agent work and duplicates approval policy owned by the MCP client or agent harness. A deliberate local session with a clear warning and kill switch preserves an explicit user-controlled boundary.

## ADR-018: Full worker environment

**Decision:** commands inherit the complete environment and permissions of the process that started Glossa, including available Git, npm, SSH, and cloud credentials. Glossa does not enumerate, persist, or log environment variables automatically.

**Reason:** unattended coding agents need the same tools and credentials available in the user's terminal. The exposure session and worker account are the authorization boundary.
