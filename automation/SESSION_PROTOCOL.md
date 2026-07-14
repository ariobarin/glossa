# Autonomous session protocol

## State file

Create `.glossa-agent-state.json` from `automation/state.template.json`. It is local-only and must never be committed.

Update after:

- each completed task;
- each commit;
- each external service change;
- each login checkpoint;
- each deployment and rollback.

## Progress updates

At useful intervals, report:

- milestone and task;
- completed evidence;
- tests run;
- current blocker or next action;
- whether a human login is needed.

Do not narrate every shell command.

## Login pause format

Use:

> **Login required — [service]**  
> I opened the official [service] login page so I can [purpose]. Please sign in and complete MFA yourself, then tell me when the account dashboard is visible. I will not ask for or handle your credentials.

After confirmation, continue configuration without asking the user to transcribe settings that the agent can read from the browser.

## Secret handling

- Generate secrets locally with a cryptographically secure generator.
- Insert them directly into Auth0/Heroku/GitHub UIs.
- Do not print secrets.
- Do not store them in agent state.
- Record only secret names and last-rotation timestamps.
- Prefer npm trusted publishing over npm tokens.

## Failure handling

- Retry transient network/service failures with bounded backoff.
- Do not repeatedly retry authentication failures.
- For `glossa.sh`, begin in Vercel Domains, confirm authoritative nameservers, and preserve/export all existing DNS before edits.
- Use a new deployment/release for changes; do not patch production manually when code changes are appropriate.
- Roll back if acceptance checks fail after deployment.
