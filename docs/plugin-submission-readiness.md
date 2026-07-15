# Public plugin submission readiness

This is the working checklist for publishing Glossa as an installable public plugin in ChatGPT and Codex. It records the smallest credible path to review. It does not imply approval.

Requirements were checked on 2026-07-15 against OpenAI's [plugin submission guide](https://learn.chatgpt.com/docs/submit-plugins), [app guidelines](https://developers.openai.com/apps-sdk/app-guidelines), and [app preparation guide](https://developers.openai.com/apps-sdk/deploy/submission).

## Target

- [ ] Submit an app-only plugin backed by `https://mcp.glossa.sh/mcp`.
- [ ] Use a clear customer-facing name, such as `Glossa Local Workspace`.
- [ ] Keep the first public version focused on one promise: work with an explicitly exposed local coding workspace.
- [ ] Publish through the OpenAI plugin submission portal so users do not need developer mode.
- [ ] Treat plan, region, role, and workspace policy restrictions as separate from public approval.

A local marketplace manifest is useful for development but is not the public approval path. The portal must scan the production MCP server directly. The existing ChatGPT app ID cannot be used in place of a new MCP-backed plugin submission.

## Public execution profile

This is the primary product and review decision.

- [ ] Choose and document the authority available in the public plugin.
- [ ] Prefer a review-safe first release without unrestricted host shell access.
- [ ] Provide narrow workspace tools for listing, searching, reading, revision-checked writing, and patching files.
- [ ] Decide whether the first release needs command execution at all.
- [ ] If commands remain, confine them to a real sandbox or dedicated operating-system account.
- [ ] If commands remain, scrub inherited credentials and environment variables.
- [ ] If commands remain, disable network access by default or clearly constrain and disclose it.
- [ ] If commands remain, add explicit local approval before execution.
- [ ] If commands remain, define retry, cancellation, timeout, and irreversible-side-effect behavior.

The current `run_command` tool has the full authority of the worker account. It can reach networks, credentials, developer tools, and files outside the exposed file root. Its current `openWorldHint: false` value cannot accurately describe every command it can execute.

## Product completeness

- [ ] Remove open-beta and trial wording from the submitted product.
- [ ] Publish a stable CLI version under the npm `latest` tag.
- [ ] Replace public-facing `0.0.0` component versions with a consistent release version.
- [ ] Make installation and first use complete without private operator assistance.
- [ ] Document supported operating systems, Node.js requirements, expected permissions, and safe first use.
- [ ] Provide a self-service disconnect, device revocation, sign-out, and account-deletion path.
- [ ] Confirm the plugin name, website, npm package, OAuth consent screen, support identity, and publisher identity match.

## Public policy and support pages

- [ ] Publish `https://glossa.sh/privacy`.
- [ ] Publish `https://glossa.sh/terms`.
- [ ] Publish `https://glossa.sh/support` with a monitored contact route.
- [ ] Publish or link the security model and a vulnerability-reporting route.
- [ ] State which personal data Glossa processes, including Auth0 identity and device metadata.
- [ ] State that file contents, command inputs, and command outputs transit the relay when tools are used.
- [ ] State the purpose, recipients, retention period, deletion controls, and security measures for every data category.
- [ ] Describe IP address and platform-log handling accurately.
- [ ] Ensure the implementation and operational logs match the published policy.

## MCP contract

- [ ] Give every tool a specific name and description that matches its complete behavior.
- [ ] Add useful output schemas so reviewers and clients can understand result shapes.
- [ ] Set `readOnlyHint`, `destructiveHint`, and `openWorldHint` from worst-case real behavior.
- [ ] Mark every tool that can write, enqueue work, start a process, or cancel work as non-read-only.
- [ ] Mark any tool capable of pushing code, sending network requests, or changing public systems as open-world.
- [ ] Explain each annotation in the submission form with concrete behavior and safeguards.
- [ ] Return only fields needed for the requested task.
- [ ] Remove unnecessary request IDs, trace data, timestamps, debug data, and internal identifiers from tool results.
- [ ] Never return authentication secrets or inherited credentials.
- [ ] Decide whether OAuth permissions should separate read, write, and command authority.
- [ ] Verify OAuth discovery, scopes, consent text, token validation, account isolation, and revocation.
- [ ] Define the exact content security policy required by the submission portal.
- [ ] Add the generated domain-verification token at `/.well-known/openai-apps-challenge` when the portal provides it.

## Reviewer environment

- [ ] Complete individual or business verification for the exact publisher name.
- [ ] Confirm the submitter has Apps Management write access in the publishing organization.
- [ ] Create a fully featured Auth0 demo account that does not require MFA, SMS, or email confirmation.
- [ ] Run a dedicated, isolated review worker that stays available throughout review.
- [ ] Expose only a disposable fixture repository with no real credentials or private source code.
- [ ] Seed deterministic files and command results required by every submitted test case.
- [ ] Give reviewers concise setup instructions that require no private network or operator intervention.
- [ ] Verify the complete reviewer flow from an unrelated network.
- [ ] Verify supported flows in both ChatGPT web and mobile.

## Required submission tests

Submit exactly five positive tests and three negative tests. Final expected results must match the public tool surface.

### Positive candidates

- [ ] List the connected review device and return only the fields needed to select it.
- [ ] Read a known UTF-8 fixture file from the exposed root.
- [ ] Search for a known symbol or phrase and return bounded matching locations.
- [ ] Update a fixture file using revision checking, then read back the new content.
- [ ] Apply a safe patch or run one sandboxed project check, depending on the approved execution profile.

### Negative candidates

- [ ] Reject parent traversal, absolute paths, symlink escapes, and Windows junction escapes.
- [ ] Return a clear, safe error when the selected worker is offline.
- [ ] Refuse a command, file operation, or secret-access request that exceeds the public authority boundary.

## Verification and operations

- [ ] Add first-party automated tests. `npm run check` currently performs a build only.
- [ ] Cover cross-account device and job isolation.
- [ ] Cover OAuth discovery, invalid tokens, insufficient scopes, disabled accounts, and revocation.
- [ ] Cover path traversal, symlinks, junctions, reparse points, broad-root rejection, and revision races.
- [ ] Cover size limits, invalid UTF-8, command timeouts, cancellation, output limits, and process-tree cleanup.
- [ ] Cover tool names, descriptions, schemas, annotations, and minimized responses as a versioned contract.
- [ ] Add an end-to-end smoke test using the production-style relay, a fixture worker, and an MCP client.
- [ ] Monitor relay availability, OAuth failures, worker routing failures, and unexpected error rates without logging sensitive payloads.
- [ ] Document support ownership, incident response, credential rotation, account deletion, and rollback.
- [ ] Verify worker reconnect behavior and the user-visible result of a relay restart.
- [ ] Complete a focused security review before submission.

## Submission packet

- [ ] Create a new `With MCP` plugin draft in the OpenAI plugin submission portal.
- [ ] Enter the production MCP URL rather than the existing ChatGPT app ID.
- [ ] Provide the verified publisher identity, plugin descriptions, category, logo, website, support, privacy, and terms URLs.
- [ ] Configure authentication and add the reviewer demo credentials.
- [ ] Complete domain verification and the content security policy.
- [ ] Scan tools, inspect every discovered schema and annotation, fix issues, deploy, and scan again.
- [ ] Add realistic starter prompts for the highest-value workflows.
- [ ] Add the five positive and three negative reviewer tests.
- [ ] Select only countries where the product, terms, privacy policy, and support process are ready.
- [ ] Add concise initial-release notes and complete policy attestations only after final verification.
- [ ] Submit for review, respond to reviewer findings, and publish only after approval.
- [ ] Replace development or direct-share installation instructions with the published directory URL.

## Initial submission gate

Do not submit until all of these are true:

- [ ] The public execution profile is narrower than unrestricted host shell authority, or that authority is genuinely sandboxed and accurately disclosed.
- [ ] The product is presented and operated as a stable release.
- [ ] Privacy, terms, support, security, and deletion surfaces are public and accurate.
- [ ] Tool annotations and response data match real behavior.
- [ ] The isolated reviewer account and worker are reproducible without MFA or private access.
- [ ] All eight submitted tests pass from the reviewer environment.
- [ ] Automated security and integration checks pass on the exact deployed revision.
