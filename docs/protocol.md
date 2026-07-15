# API and protocol contract

All production endpoints use HTTPS.

## Public metadata

### `GET /.well-known/oauth-protected-resource`

Advertise `https://mcp.glossa.sh/` as the protected resource, along with the authorization server and the `glossa:access` scope. The protected-resource identifier is the OAuth audience. It is intentionally not the request URL `https://mcp.glossa.sh/mcp`.

### `GET /healthz`

No secret data. Suitable for uptime checks.

## User-authenticated control API

OAuth bearer token required. Audience must match the Glossa API. Routes check scopes and derive account ownership from `sub`.

### `POST /v1/devices/enroll`

Input:

```json
{
  "name": "Thomas MacBook",
  "platform": "darwin-arm64"
}
```

Output, shown once:

```json
{
  "device": {
    "id": "uuid",
    "name": "Thomas MacBook"
  },
  "device_token": "gld_uuid_secret"
}
```

### `GET /v1/devices`

Lists only the authenticated user's devices.

### `PATCH /v1/devices/:id`

Rename a device owned by the account.

### `DELETE /v1/devices/:id`

Revoke a device owned by the account.

## Device-authenticated worker API

Use:

```text
Authorization: Device gld_<device-id>_<secret>
```

### `POST /device/register`

Registers an active worker generation. The request does not include the canonical local root or a derived repository name.

### `POST /device/poll`

Waits no more than 18 seconds. Returns one job or `204 No Content`. A worker has at most one delivered active job. Worker HTTP requests use a 19 second client timeout and reconnect with bounded exponential jitter.

### `POST /device/result`

Posts a structured result for the delivered job. Late results after caller timeout are ignored.

## MCP endpoint

### `POST /mcp`

OAuth required. The token's account can route only to devices owned by that account.

The origin route `POST /` serves the same authenticated transport for MCP clients that use their configured transport URL as the OAuth resource. This keeps the OAuth resource equal to the protected resource identifier `https://mcp.glossa.sh/`. The canonical protocol endpoint remains `https://mcp.glossa.sh/mcp`.

Tools:

- `list_devices`
- `list_files`
- `read_file`
- `write_file`
- `run_command`
- `get_command`
- `cancel_command`

`list_devices` identifies an active root by device ID and reports `path: "."`. `list_files` returns at most 1,000 immediate entries for one directory without recursion or link traversal. File and command tools accept the device ID and operate relative to its exposed root. Local absolute paths are never transmitted to or returned by the hosted relay.

Tool annotations must describe actual behavior. `write_file` and `run_command` are non-read-only and destructive-capable.
Every tool advertises the `glossa:access` OAuth scheme in descriptor metadata and is visible to the model. `run_command` declares `openWorldHint: true` because a command can use the worker account's inherited network access and affect external systems. All other tools declare `openWorldHint: false`.
Tool descriptions state when the model should select each operation. Every public input and output field includes a description, and successful results provide both structured content and an equivalent JSON text fallback.

## Worker job union

```ts
type WorkerJob =
  | { type: "list_files"; requestId: string; path: string }
  | { type: "read_file"; requestId: string; path: string }
  | {
      type: "write_file";
      requestId: string;
      path: string;
      content: string;
      expectedSha256?: string;
    }
  | {
      type: "run_command";
      requestId: string;
      argv?: string[];
      shellCommand?: string;
      stdin?: string;
      timeoutMs: number;
    }
  | {
      type: "get_command";
      requestId: string;
      commandId: string;
      waitMs?: number;
    }
  | { type: "cancel_command"; requestId: string; commandId: string };
```

`argv` and `shellCommand` are mutually exclusive.

An active worker executes valid `write_file` and bounded `run_command` jobs without a separate local confirmation round trip. Session startup is the local authorization boundary. File tools remain confined to the exposed root. Commands retain the full authority and permissions of the local worker account.

Command processes inherit the complete environment of the Glossa worker process. Glossa does not enumerate or transmit that environment unless a user-authorized command explicitly reads or prints part of it.

`run_command` returns a command ID and status once the worker accepts the job. `get_command` may wait up to 15 seconds, then reports `running`, `succeeded`, `failed`, `canceled`, or `timed_out`, and includes bounded output after completion. Public MCP results omit worker-local lifecycle timestamps because clients do not need them to manage a command. `cancel_command` terminates the process tree. Disconnecting the worker rejects new jobs and terminates an active command. Command state and output remain transient and are never persisted by the relay.

Text file content and each captured command stream are limited to 1 MiB. Command output beyond that limit is truncated. One command may run at a time per worker; another `run_command` request returns `command_busy` until the active command finishes or is canceled.

The requested command timeout defaults to 900,000 milliseconds and must be between 1 millisecond and the 3,600,000 millisecond hard maximum.

These are ordinary MCP tools so clients do not need native MCP Tasks support. Native task negotiation may be added after target client support is dependable, but it is not part of the core MVP contract.

## Error principles

- Return stable machine-readable codes.
- Do not include local absolute paths in hosted errors.
- Distinguish offline, timeout, stale revision, output truncated, and command spawn failure.
- Authentication errors disclose no device/account existence.
