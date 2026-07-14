# Prototype reset and repository reconstruction

## Naming decisions

| Surface | New value |
|---|---|
| Product | Glossa |
| Website | glossa.sh |
| CLI | `glossa` |
| npm package | `@ariobarin/glossa` |
| Repository | `ariobarin/glossa` |
| Config directory | `~/.config/glossa` or platform equivalent |
| Environment prefix | `GLOSSA_` |
| Managed MCP URL | `https://mcp.glossa.sh/mcp` |

The unscoped npm package `glossa` is an npm security-holding package and must not be used. A scoped package can still provide the global binary `glossa`.

## Prototype status

The existing Veronica repository is stale, unversioned prototype material. It is not a release baseline and creates no compatibility, migration, alias, history-preservation, or package-deprecation obligation.

Before the first numbered public Glossa release, the implementation may freely change:

- commands and flags;
- config paths and environment variables;
- HTTP, worker, and MCP protocol shapes;
- database schemas;
- authentication and enrollment flows;
- repository structure and dependencies;
- deployment assumptions.

The first numbered public release establishes the initial compatibility baseline. Stability policy begins with that release.

## Recommended repository setup

Prefer a clean `ariobarin/glossa` repository containing this scaffold and its implementation history. Preserving or importing the stale repository's Git history is optional and should be done only when it helps engineering work. It must not complicate the rebuild.

Suggested sequence:

1. Create or empty the target `ariobarin/glossa` repository.
2. Import this handoff scaffold.
3. Implement each subsystem from the current Glossa specifications and acceptance tests.
4. Use focused commits that make the new design reviewable.
5. Inspect the stale prototype only for isolated ideas or test cases when that saves time.
6. Merge after the new Glossa test suite and acceptance criteria pass.
7. Update repository description, homepage, topics, security contacts, and package metadata.

The old repository may be archived with a short notice that it is a stale pre-release prototype. No redirect, warning executable, forwarding package, or compatibility period is required.

## Release policy

The scaffold package remains private at version `0.0.0`. Do not publish it. When the MVP is ready:

1. choose the first numbered version deliberately;
2. remove the scaffold-only `private` flag from `packages/cli/package.json`;
3. update the CLI version source;
4. create a matching GitHub release tag;
5. publish with provenance.

Only that first numbered release starts the compatibility clock.

## Implementation principle

Do not blindly copy the stale prototype. Rebuild against explicit security properties:

- canonical root selection;
- broad-root refusal;
- path and symlink/junction escape prevention;
- workspace verification;
- atomic writes with revision checks;
- file and output limits;
- direct argv versus explicit shell command;
- process-tree termination;
- queue expiry and late-result handling;
- accurate MCP tool annotations.

These are requirements because they protect users, not because an old implementation happened to contain them.

## Search checklist

Before the first release, search tracked runtime files for:

- `Veronica`;
- `veronica`;
- `VERONICA_`;
- old package/repository URLs;
- old config paths.

Occurrences are allowed only in explicitly named prototype-reference or historical documents.
