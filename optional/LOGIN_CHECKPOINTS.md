# Optional human login checkpoints

These checkpoints are not part of the core autonomous run. The agent must not pause for them unless the owner has explicitly authorized the corresponding optional task.

## OCP-01 — Sentry Student offer

- User signs in through the GitHub Student Developer Pack redemption flow.
- Agent creates a Node project only after telemetry scrubbing tests exist.
- PII and content collection remain disabled.

## OCP-02 — Codecov

- User signs in and authorizes the Glossa repository.
- Agent enables reporting only after deciding whether coverage should be a required check.

## OCP-03 — 1Password Developer Tools

- User activates the student benefit.
- Agent may help organize maintainer credentials but never accesses secret values.

## OCP-04 — Doppler

- User activates the student plan only after a documented need for cross-service secret synchronization.
- Agent must not replace working Heroku/GitHub secret handling merely to add another service.

## OCP-05 — Additional Vercel DNS records

- User signs into the Vercel account owning `glossa.sh`.
- Agent adds `auth.glossa.sh`, `status.glossa.sh`, or another record only after the corresponding optional service is approved and provisioned.
- Existing apex and unrelated records remain untouched.
