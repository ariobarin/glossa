# Architecture decisions

## One managed relay

Run one Heroku web process and one Postgres database. Active worker routing remains in memory, so horizontal scaling is unsafe until routing state has an external coordination design.

## Auth0 owns identity

Use one Auth0 Native application for the CLI, one custom API, and the current ChatGPT client registered through Client ID Metadata Document metadata. Keep Dynamic Client Registration disabled. Auth0 handles authentication, while Postgres controls private beta admission.

## Per-device secrets

Enroll each device with a unique random token and store only a salted scrypt hash on the relay. Device credentials remain separate from user OAuth credentials.

## Worker owns enforcement

The worker owns canonical path containment, atomic file writes, command execution, and process-tree cancellation because it owns the filesystem and processes.

## No durable content

Do not store source files, command arguments, command output, environment values, tokens, or full local paths in Postgres or logs.

## Asynchronous commands

`run_command` starts a local job and returns a command ID. `get_command` reports state and bounded output. `cancel_command` terminates the process tree. Command lifetime does not depend on one hosted HTTP request.

## Session-authorized access

Starting `glossa` authorizes writes and commands inside the exposed root without another local prompt for every operation. The CLI must display the authority warning, activity, and an immediate Ctrl+C disconnect path.

## Complete worker environment

Commands inherit the full environment and permissions of the account that launched Glossa. This supports real development workflows and makes the exposure session the explicit security boundary.

## Local-only paths

The full canonical path remains local. MCP clients identify an active root using a device ID and root-relative path `.`.

## Windows-first beta

Windows is the supported private beta worker platform. Other operating systems require direct validation of path containment and process termination before support is claimed.

## Domain ownership

Keep the existing `glossa.sh` site and Vercel DNS ownership. Route only `mcp.glossa.sh` to Heroku.
