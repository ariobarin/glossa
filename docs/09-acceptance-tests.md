# Core MVP acceptance tests

## Fresh user path

- [ ] Install `@ariobarin/glossa` on a clean Windows machine.
- [ ] `glossa login` opens the correct Auth0 browser flow.
- [ ] The Auth0 browser flow offers GitHub as the only social login connection.
- [ ] No client secret or manually copied bearer token is needed.
- [ ] `glossa whoami` reports the correct account.
- [ ] Running `glossa` in a Git worktree prints the canonical root and connects.
- [ ] The full canonical path appears locally but never reaches the relay or MCP client.
- [ ] The stable endpoint is `https://mcp.glossa.sh/mcp`.
- [ ] OAuth-capable MCP client completes login and lists only the user's device.
- [ ] Total setup is under ten minutes.

## Domain and deployment

- [ ] Vercel Domains/DNS remains the recorded control point for `glossa.sh`, unless authoritative nameserver inspection proves delegation elsewhere.
- [ ] Existing `https://glossa.sh` content is unchanged and healthy.
- [ ] `mcp.glossa.sh` resolves only to the intended Heroku custom-domain target.
- [ ] Heroku serves a valid certificate for `mcp.glossa.sh`.
- [ ] No unrelated DNS record was removed or modified.

## Filesystem safety

- [ ] Absolute paths are rejected.
- [ ] `..` traversal is rejected.
- [ ] Symlink/junction escape reads are rejected.
- [ ] Writes through a symlinked writable ancestor are rejected.
- [ ] Home/root exposure requires explicit broad-root override.
- [ ] Workspace paths are revalidated for every operation.
- [ ] Atomic revision-checked write rejects stale content.

## Commands

- [ ] Session startup displays the shell-authority warning before connection.
- [ ] A valid `write_file` starts without an additional local confirmation prompt.
- [ ] A valid `run_command` starts without an additional local confirmation prompt.
- [ ] The local CLI visibly reports write and command activity.
- [ ] Immediate local disconnect rejects new commands and terminates an active command.
- [ ] Direct argv execution avoids shell interpretation.
- [ ] Explicit shell command uses the platform shell and is visibly distinct.
- [ ] A command receives the complete environment inherited by the Glossa worker process.
- [ ] Glossa does not enumerate, persist, or log environment variables automatically.
- [ ] `run_command` promptly returns a command ID after worker acceptance.
- [ ] A command continues beyond 20 seconds without holding its initiating hosted request open.
- [ ] `get_command` may wait up to 15 seconds, reports running state, and returns the final bounded result.
- [ ] `cancel_command` terminates the process group and discovered descendants.
- [ ] The complete command lifecycle works in an MCP client without native MCP Tasks support.
- [ ] An omitted command timeout defaults to 15 minutes.
- [ ] A requested timeout above 60 minutes is rejected.
- [ ] The configured command runtime timeout terminates the process group and discovered descendants.
- [ ] Output is capped and reports truncation.
- [ ] Worker shutdown terminates an active command.

## MCP tool registration

- [ ] Tool annotations describe actual behavior.
- [ ] `write_file` and `run_command` are marked non-read-only and destructive-capable.
- [ ] `write_file` performs revision-checked local writes under the exposed root.
- [ ] `run_command` executes with the local worker account's full authority and permissions.

## Identity and tenancy

- [ ] An explicitly admitted Auth0 subject can enroll a device and use the MCP endpoint.
- [ ] A valid but uninvited GitHub identity cannot enroll a device or use MCP tools.
- [ ] Authentication alone never creates or admits an account.
- [ ] Admission failures reveal no device, workspace, job, or account-existence information.
- [ ] Every device has an independent credential.
- [ ] Server stores no plaintext device secret.
- [ ] Revocation blocks the next request.
- [ ] Account A cannot list account B's device.
- [ ] Account A cannot open or use a guessed workspace/job belonging to B.
- [ ] Auth0 audience, issuer, expiry, and scope are checked.
- [ ] Missing or invalid credentials reveal no account/device existence.

## Platform behavior

- [ ] An MCP client identifies the active root by device ID and root-relative path `.`.
- [ ] Windows worker behavior passes on a real supported Windows machine.
- [ ] Git worktree root discovery and canonical path display are correct on Windows.
- [ ] Windows junction and reparse-point escape attempts are rejected.
- [ ] Command timeout and worker shutdown terminate discovered Windows descendants.
- [ ] Worker long poll returns within 20 seconds.
- [ ] Relay runs on one Basic dyno.
- [ ] Postgres survives deploy/restart.
- [ ] Active workers reconnect after restart.
- [ ] Active calls fail cleanly during restart.
- [ ] No request relies on more than the platform routing window.

## Privacy and release operations

- [ ] Heroku logs contain no tokens, file content, command arguments/output, or full local paths.
- [ ] Health endpoint contains no user data.
- [ ] npm package is published with trusted publishing and provenance where supported.
- [ ] Core CI, dependency review, secret scanning, and rebrand checks pass.
- [ ] The published package exposes the `glossa` binary.

Optional integrations and post-MVP features are not acceptance criteria for this file.

macOS and Linux worker support is deferred until after the Windows-first private beta and is not part of these acceptance criteria.
