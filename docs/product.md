# Product contract

## Objective

An open beta user can:

1. Install the CLI from the GitHub repository.
2. Sign in through Auth0.
3. Run `glossa` inside one Git worktree or explicit directory.
4. Connect ChatGPT to `https://mcp.glossa.sh/mcp`.
5. Read and atomically write files and run bounded one-shot commands.
6. Disconnect by stopping the local worker.

The tester does not manage a VPS, VPN, reverse proxy, TLS certificate, OAuth server, or database.

## Access

- Auth0 database signup is open so anyone can create a Glossa identity.
- The first valid authenticated request creates or activates the account record.
- A disabled identity receives no account, device, workspace, or job details.

## Device and exposure lifecycle

- The first managed session enrolls a named device with a unique random secret.
- The relay stores only a salted password hash of the device secret.
- Running `glossa` with no path selects the current Git worktree root.
- Outside a Git worktree, the tester must provide an explicit directory.
- Home, drive, and filesystem roots require `--allow-broad-root`.
- The canonical absolute path is printed locally and is never sent to the relay.
- Stopping the worker ends useful access.

## MCP tools

- `list_devices`
- `open_workspace`
- `read_file`
- `write_file`
- `run_command`
- `get_command`
- `cancel_command`
- `close_workspace`

## Limits

- Text files and captured output are limited to 1 MiB each.
- One command runs at a time per worker.
- Commands default to a 15 minute timeout and cannot exceed 60 minutes.
- `get_command` may wait up to 15 seconds before returning current state.
- The worker long poll remains below the hosted request timeout.
- Commands inherit the complete environment and permissions of the worker account.
- Glossa does not enumerate, persist, or log environment variables automatically.

## Tenancy and persistence

Every device, workspace, and job is owned by the account derived from the Auth0 subject. Identifier guessing must never cross account boundaries.

Postgres stores account and device metadata. Active workers, workspaces, and jobs remain in relay memory. Source files and command content are never stored durably by the relay.
