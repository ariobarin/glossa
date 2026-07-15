# Data model

## accounts

| Column | Type | Notes |
|---|---|---|
| id | uuid | Internal immutable identifier |
| auth0_subject | text unique | External identity, e.g. `auth0|...` |
| created_at | timestamptz | |
| admitted_at | timestamptz nullable | First successful authenticated activation |
| disabled_at | timestamptz nullable | |

The first valid request for an Auth0 subject creates the account row atomically. Existing accounts remain unavailable while `disabled_at` is non-null.

## devices

| Column | Type | Notes |
|---|---|---|
| id | uuid | Appears in device token |
| account_id | uuid | Required ownership key |
| name | text | Unique per active account |
| token_salt | bytea | Random |
| token_hash | bytea | scrypt output |
| token_version | integer | Rotation support |
| platform | text nullable | Non-sensitive summary |
| created_at | timestamptz | |
| last_seen_at | timestamptz nullable | |
| revoked_at | timestamptz nullable | |

Never store the plaintext device token.

## audit_events

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| account_id | uuid | |
| device_id | uuid nullable | |
| event_type | text | Enrolled, revoked, connected, auth failure |
| outcome | text | success/failure |
| metadata | jsonb | Strict allowlist only |
| created_at | timestamptz | |

Audit metadata must not contain source, command, output, Authorization headers, or full local paths.

## In-memory resources

### ConnectedDevice

- device ID
- account ID
- last poll waiter
- active job ID
- connection generation

The relay does not receive or retain the worker's canonical absolute root. MCP responses identify the exposed root with the device ID and root-relative path `.`.

### WorkspaceLease

- workspace ID
- account ID
- device ID
- path relative to exposed root
- created/expires timestamps

### Job

- job ID
- account ID
- device ID
- workspace ID
- tagged request
- created/expires timestamps
- completion waiter

All resource lookups require both `accountId` and resource ID.
