# Optional feature roadmap

These are not part of the core MVP and must not be implemented accidentally while completing `TASKS.md`.

## Safety and local UX

- Local approval prompts for writes or commands beyond the core session-authorized mutation model.
- Session trust modes such as read-only, confirm-destructive, or fully trusted until disconnect.
- Native tray/menu-bar status application.
- Rich local audit viewer.
- Container, VM, or sandbox execution profiles.
- Signed job envelopes or end-to-end encrypted job payloads.

## Longer-running execution

- Background job resources.
- Job cancellation after delivery.
- Streaming command output.
- Persistent terminals and reconnectable sessions.
- Artifact transfer for large outputs.
- WebSocket worker transport after the polling model proves insufficient.

## Hosted product expansion

- Native MCP Tasks integration after dependable support exists across target clients.
- Organization and team accounts.
- Per-project roles and shared devices.
- Web account/device dashboard.
- Public signup and self-service invitation management beyond the core operator-managed allowlist.
- Billing and usage limits.
- Multi-region service.
- Multiple relay replicas with coordinated routing.
- Durable queues or Redis only when a demonstrated scaling requirement exists.
- Public status page on a separate subdomain.

## Product integrations

- IDE extensions.
- GitHub App integration.
- Notifications for device connection, destructive actions, or revocation.
- Additional MCP-client onboarding helpers.

Each optional feature requires its own threat-model update, acceptance criteria, and explicit owner approval before entering the core backlog.
