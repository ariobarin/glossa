# Core service stack and Student Developer Pack plan

Research date: 2026-07-14. Offers and prices can change; verify them during the core login checkpoints.

This file lists only services required for the MVP. Nonessential Student Pack products and alternative platforms are isolated in `optional/SERVICES.md`.

## GitHub

Use GitHub for the repository, protected branches, Actions, release automation, security scanning, and npm trusted publishing. Verify the owner's Student Developer Pack status before redeeming the Heroku offer.

## Heroku

The selected core deployment is:

- one Basic web dyno;
- one Heroku Postgres Essential-0 database;
- one application replica.

The Student Developer Pack offer should be verified during setup. The previously researched allocation was sufficient to cover the approximately $12/month Basic dyno plus Essential-0 combination, but the agent must confirm current pricing and credit before provisioning.

Why Heroku:

- fits the existing single Node-process architecture;
- provides managed TLS and custom domains;
- avoids VPS administration;
- supports straightforward GitHub deployment;
- accommodates the bounded long-polling request model.

Required adaptation:

- worker polls complete within 20 seconds;
- commands run as asynchronous local jobs and no hosted request waits for command completion;
- the relay remains at one replica because active routing state is in memory.

## Auth0 Free

Use Auth0 for:

- OAuth Device Authorization Flow for `glossa login`;
- OAuth protection for the MCP resource;
- token discovery, issuer/audience validation, scopes, consent, and revocation.

The CLI is a public Native application and must not contain a client secret. Use the standard Auth0 tenant domain for the core MVP. A branded auth subdomain is not required.

Enable GitHub as the only social login connection for the private beta. Additional identity providers are outside the MVP.

## Vercel Domains

The owner acquired `glossa.sh` through Vercel Domains. Treat Vercel as the first domain-management checkpoint.

Core use:

1. Inspect the existing domain and DNS configuration in Vercel.
2. Confirm the authoritative nameservers; do not assume they have not been delegated.
3. Record the current records before changes.
4. Preserve the existing apex marketing site and unrelated records.
5. Add only `mcp.glossa.sh` using Heroku's exact DNS target.
6. Verify the apex site and the new subdomain after propagation.

Do not transfer the registrar, replace nameservers, or migrate the website as part of the MVP.

## npm

Publish the scoped package `@ariobarin/glossa` with a `glossa` executable. Use GitHub Actions trusted publishing and provenance where available. Do not attempt to claim or publish the occupied unscoped package name.

## Core cost guardrail

The core paid infrastructure should remain limited to the Heroku dyno and Postgres plan covered by the confirmed Student Pack allocation. Do not provision paid add-ons or a second hosting platform without owner approval.

## Sources to verify during implementation

- GitHub Student Developer Pack: https://education.github.com/pack
- Heroku pricing: https://www.heroku.com/pricing/
- Heroku request timeouts: https://devcenter.heroku.com/articles/request-timeout
- Auth0 pricing: https://auth0.com/pricing
- Auth0 Device Authorization Flow: https://auth0.com/docs/get-started/authentication-and-authorization-flow/device-authorization-flow
- Auth0 for AI Agents / Auth for MCP: https://auth0.com/ai
- Vercel Domains documentation: use the official Vercel dashboard and documentation linked from the account
