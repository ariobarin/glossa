# Optional services and Student Developer Pack opportunities

These services may improve operations or developer experience, but none are required to ship the core MVP.

## Sentry Student

Potential use: sanitized relay exceptions and traces.

Adoption gate:

- core metadata-only logging is insufficient for diagnosing real beta failures;
- an explicit scrubbing test suite exists;
- PII collection is disabled;
- file content, command content, tokens, and full local paths are excluded.

## Codecov

Potential use: coverage reporting and pull-request coverage gates.

Adoption gate: the test suite is stable enough that a coverage threshold will encourage meaningful testing rather than brittle metric chasing.

## 1Password Developer Tools

Potential use: maintainer account, recovery-code, and secret management.

It is not a runtime dependency and should never be required for end users.

## Doppler Student Team

Potential use: central secret synchronization after secret duplication across Heroku, GitHub, and additional environments becomes a real problem.

Do not add Doppler to the core deployment solely because a student offer exists.

## Testmail or similar email-testing tools

Potential use: automated tests for invitation or account-email flows after those product features exist.

## Datadog or New Relic

Potential use: deeper application performance monitoring at larger scale.

Do not run multiple overlapping telemetry stacks. Consider only after platform logs and any selected error tracker are insufficient.

## Alternative hosting or data services

- DigitalOcean: owner has already used the student benefit; not selected for core.
- Microsoft Azure: possible fallback, but increases platform complexity.
- Fly.io: possible per-tenant isolation or machine provisioning later.
- Cloudflare Workers/Durable Objects: possible future connection coordination after a transport redesign.
- MongoDB Atlas: unnecessary while metadata is relational and fits Postgres.
- Appwrite or Clerk: would overlap with the selected Auth0 and Postgres responsibilities.

## Optional domain additions

- `auth.glossa.sh` for a branded Auth0 domain.
- `status.glossa.sh` for a public status page.
- Other product subdomains only when their corresponding feature exists.

All domain changes still begin in the Vercel Domains dashboard and must preserve the apex site and existing DNS records.
