# Core MVP implementation backlog

This file contains only core work. Do not pull tasks from `optional/` until all core exit criteria pass or the owner explicitly expands scope.

## M0 — Establish the Glossa repository

- [ ] Create a clean `ariobarin/glossa` repository or replace the contents of an existing target repository.
- [ ] Do not preserve stale history unless it is operationally convenient; history continuity is not a product requirement.
- [ ] Replace package/product/runtime names with Glossa.
- [ ] Use `@ariobarin/glossa` as the npm package and `glossa` as the only executable.
- [ ] Remove old `veronica` commands, aliases, config paths, environment variables, package shims, and compatibility code.
- [ ] Import this handoff scaffold directly onto an implementation branch.
- [ ] Keep the publishable CLI package marked private with version `0.0.0` until the first numbered release is intentionally cut.
- [ ] Review and commit the included lockfile; regenerate it only when dependencies change.
- [ ] Make `npm run check` green.
- [ ] Enable branch protection and required GitHub Actions checks.

**Exit:** clean checkout installs and checks successfully; no stale runtime naming or compatibility surface remains.

## M1 — Implement the local worker and gateway core

- [ ] Implement path canonicalization, symlink/junction escape checks, workspace leases, file limits, atomic writes, command execution, process-tree termination, output limits, and their tests from the Glossa specifications.
- [ ] Treat Windows path behavior, junctions, reparse points, command execution, and process-tree termination as the launch baseline.
- [ ] Define shared job schemas in `packages/protocol`.
- [ ] Keep the worker outbound-only.
- [ ] Remove the scaffold `rootLabel` relay state and keep the canonical absolute path local to the worker.
- [ ] Identify active roots remotely by device ID and root-relative path `.`.
- [ ] Use only `GLOSSA_*` configuration names.
- [ ] Keep local-only development mode working without Auth0.
- [ ] Optionally inspect the stale prototype for isolated implementation ideas, but do not target code parity or preserve obsolete interfaces.

**Exit:** the new Glossa functional and security tests pass, independent of the stale prototype.

## M2 — Auth0 CLI login

- [x] Create an Auth0 Native application for the CLI.
- [x] Enable Device Authorization Grant and refresh-token rotation.
- [x] Enable GitHub as the only social login connection for the private beta.
- [x] Configure API audience and scopes.
- [x] Implement `glossa login`, `logout`, `status`, and `whoami`.
- [x] Open `verification_uri_complete` automatically and retain copyable fallback text.
- [x] Store refresh credentials in an operating-system credential store where available.
- [x] Permit a mode-0600 file fallback only with an explicit warning.
- [x] Never embed a client secret in the CLI.
- [x] Add expiry, refresh, revocation, and interrupted-login tests.

**Exit:** a fresh installation can sign in from a terminal without copying a bearer token.

## M3 — Per-device enrollment and worker authentication

- [x] Add authenticated `POST /v1/devices/enroll`.
- [x] Generate a unique 256-bit device secret and return it once.
- [x] Store only a salted scrypt hash in Postgres.
- [x] Add list, rename, revoke, and last-seen operations.
- [x] Authenticate `/device/*` by device ID and secret over TLS.
- [x] Scope every device to the Auth0 subject that enrolled it.
- [x] Require an explicitly admitted account before device enrollment, and never create accounts automatically from authenticated requests.
- [x] Add rate limits and constant-time token comparison.
- [x] Remove any shared worker token.
- [x] Add cross-account and revoked-device tests.

**Exit:** revoking one device immediately prevents its next poll without affecting other devices.

## M4 — Multi-tenant relay and MCP OAuth

- [ ] Configure Auth0 Auth for MCP.
- [ ] Serve protected-resource metadata.
- [ ] Validate issuer, audience, expiry, and required scopes for `/mcp`.
- [ ] Reject valid but uninvited identities before device, workspace, or job lookup.
- [ ] Map the Auth0 `sub` claim to only that account's devices.
- [ ] Thread `accountId` through devices, workspaces, jobs, and audit events.
- [ ] Implement the MCP tools: list devices, open/close workspace, read/write file, and run command.
- [ ] Make `run_command` return a command ID after worker acceptance.
- [ ] Add command status/result and cancellation tools with transient worker-owned state.
- [ ] Allow `get_command` to wait up to 15 seconds before returning current status.
- [ ] Keep the core command lifecycle independent of native MCP Tasks support.
- [ ] Register MCP tools with accurate read-only and destructive annotations.
- [ ] Enforce a 15 minute default and 60 minute hard maximum command runtime independently of hosted request limits.
- [ ] Inherit the complete worker process environment for commands without automatically enumerating, persisting, or logging it.
- [ ] Keep worker polls below 20 seconds with jittered reconnects.
- [ ] Add exhaustive tenant-isolation tests.

**Exit:** two test accounts cannot observe or operate each other's devices, even with guessed identifiers.

## M5 — Heroku deployment and Vercel Domains routing

- [ ] Redeem the Heroku Student Developer Pack offer.
- [ ] Create one Basic dyno application.
- [ ] Attach Heroku Postgres Essential-0.
- [ ] Apply SQL migrations automatically and safely.
- [ ] In Vercel Domains, export or record the current `glossa.sh` DNS configuration.
- [ ] Confirm the authoritative nameservers before editing DNS.
- [ ] Preserve the existing apex website and all unrelated records.
- [ ] Add `mcp.glossa.sh` using the exact Heroku custom-domain DNS target.
- [ ] Configure and verify Heroku ACM.
- [ ] Add health, readiness, release, rollback, and backup runbooks.
- [ ] Configure one relay replica only.
- [ ] Verify deploy/restart recovery.

**Exit:** `https://mcp.glossa.sh/mcp` works, the existing `glossa.sh` site is unchanged, costs remain within the recurring Student Pack credit, and workers recover after a dyno restart.

## M6 — Core operational and supply-chain safety

- [ ] Add structured metadata-only server logs.
- [ ] Redact Authorization headers, bodies, file content, command arguments/output, and full local paths.
- [ ] Add health and readiness checks that reveal no account data.
- [ ] Add Dependabot and dependency-review checks.
- [ ] Enable GitHub secret scanning and push protection where available.
- [ ] Publish with npm trusted publishing and provenance from GitHub Actions.
- [ ] Document incident response, Auth0 key changes, device revocation, and release rollback.
- [ ] Verify a production deploy from the protected main branch.

**Exit:** core failures are diagnosable from sanitized platform logs, supply-chain checks pass, and no long-lived npm publishing token is required.

## M7 — Core safety UX and private beta

- [ ] Print the canonical exposed root before connection.
- [ ] Display the shell-authority warning before connecting and treat session startup as write and command authorization.
- [ ] Show write and command activity locally without requiring per-operation confirmation.
- [ ] Verify the canonical absolute path is never sent to the relay or MCP client.
- [ ] Refuse home/filesystem roots without explicit broad-root override.
- [ ] Display account, device, endpoint, exposed root, and connection status in `glossa status`.
- [ ] Add `glossa devices`, `glossa devices rename`, and `glossa devices revoke`.
- [ ] Provide an immediate local disconnect/kill switch.
- [ ] Complete acceptance tests on a clean Windows machine.
- [ ] Document macOS and Linux worker support as deferred until after the Windows-first private beta.
- [ ] Mark the old Veronica repository as an archived stale prototype reference; do not publish redirects, aliases, or compatibility packages.
- [ ] Choose and publish the first numbered `@ariobarin/glossa` version, remove the scaffold-only `private` flag, and publish core onboarding documentation.

**Exit:** a fresh Windows user reaches a working MCP connection in under ten minutes without configuring infrastructure, and every core acceptance test passes.
