# Agent operating contract

## Mission

Take this repository from scaffold to a working private-beta MVP of Glossa. Continue autonomously through implementation, tests, documentation, deployment preparation, and browser-based configuration of the core services.

Pause only at the explicit human-login checkpoints in `LOGIN_CHECKPOINTS.md`, or when a decision would materially change security, pricing, ownership, or the core MVP contract.

The contents of `optional/` are outside the core mission. Do not implement, provision, or require them unless the owner explicitly expands scope after the core acceptance tests pass.

## Prototype and compatibility policy

No numbered public Glossa release exists yet. Until the owner deliberately publishes the first numbered version, all code, commands, configuration, APIs, schemas, and deployment assumptions are prototype material. There is no backward-compatibility obligation, deprecation period, migration shim, alias, or Git-history preservation requirement.

The existing Veronica repository is stale and non-authoritative. Use it only as optional reference material. Re-derive behavior from the current Glossa PRD, security model, and acceptance tests, and freely replace obsolete implementation choices. Security properties still require explicit tests; staleness is not permission to weaken them.

The first numbered public release establishes the initial compatibility baseline. Any stability promise starts there, not before it.

## Non-negotiable boundaries

- Glossa is a thin execution bridge. Do not add an LLM, agent loop, conversation store, planner, or model-provider integration.
- The local worker is authoritative for path containment and command execution.
- Never make whole-machine access the default.
- Treat shell access as the full authority of the local worker account.
- Do not describe command filtering as a sandbox.
- Keep repositories, builds, credentials, and commands on the user's computer.
- Persistent account/device metadata may live in Postgres. File contents and command output must not be durably stored.
- The hosted relay must run as one small Node process for MVP.
- Use one Heroku web dyno and one Postgres database. Do not add Redis, queues, Kubernetes, or microservices.
- Keep active devices, jobs, and workspace leases in memory for MVP.
- Account ownership must be checked at every device, workspace, and job lookup.
- Heroku-facing requests and long polls must finish within 20 seconds. Commands run as asynchronous worker jobs whose lifetime is independent of any one hosted request.
- Asynchronous commands default to a 15 minute timeout and must never exceed 60 minutes.
- `glossa.sh` is registered through Vercel Domains. Preserve the apex site and existing records; add only the required `mcp.glossa.sh` record.
- Never commit credentials, browser sessions, local paths, tokens, generated runtime state, or `.glossa-agent-state.json`.

## Rebrand rules

Application code, package metadata, environment variables, commands, tests, and user-facing text must use Glossa naming:

- `glossa`
- `GLOSSA_*`
- `@ariobarin/glossa`
- `mcp.glossa.sh`

The word `Veronica` may appear only in prototype-reference or historical documents. Do not add compatibility shims or tests for the old name.

## Workflow

1. Read the relevant design and security docs.
2. Work from `TASKS.md` in milestone order.
3. State the smallest behavior being added.
4. Implement worker enforcement from the current Glossa security requirements and tests; consult the stale prototype only when useful.
5. Add tests before or with behavior changes.
6. Run `npm run check`.
7. Commit one coherent scope at a time.
8. Update docs when trust, ownership, routing, persistence, or execution changes.
9. Update `.glossa-agent-state.json` locally after each task.
10. Stop at a login checkpoint rather than requesting credentials.
11. Ignore `optional/` until the core MVP passes acceptance or the owner explicitly changes scope.

## Browser and account safety

When a service login is needed:

1. Navigate to the service's official login page.
2. Tell the user exactly which service and why.
3. Pause so the user can enter credentials and complete MFA.
4. Never view, request, copy, or store their password or one-time code.
5. After the user confirms login, continue configuration in the browser.
6. Record only non-secret identifiers and URLs in local agent state.
7. Place secrets directly into the destination service's secret/config UI; never echo them into chat or logs.
8. Before changing Vercel DNS, record all existing records and verify the authoritative nameservers.

## Definition of done

The core MVP is done only when every requirement in `docs/09-acceptance-tests.md` passes against the deployed `mcp.glossa.sh` endpoint and at least one real worker on a supported operating system. Optional files are not part of this definition of done.
