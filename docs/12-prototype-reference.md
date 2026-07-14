# Stale prototype reference guidance

Reference source: `https://github.com/ariobarin/veronica`

The repository is stale, unversioned prototype material. It is not authoritative, does not define the Glossa architecture, and does not create backward-compatibility or parity requirements. The implementation agent does not need to clone it.

## When consulting it is useful

Inspect the prototype only when it can cheaply answer a narrow question, such as:

- how a particular operating system process-tree edge case was previously tested;
- whether a path canonicalization case already has a useful fixture;
- how an outbound polling experiment behaved;
- which failure modes were observed during early experimentation.

Use the optional helper only for that purpose:

```bash
./scripts/bootstrap-prototype-reference.sh
```

Treat every copied fragment as untrusted input: review it, adapt it to the current design, and cover it with new Glossa tests. Do not import the old repository wholesale, preserve its module boundaries, or seek test parity.

## Current design source of truth

In descending order:

1. `docs/01-prd.md`;
2. `docs/03-security-threat-model.md`;
3. `docs/02-architecture.md`;
4. `docs/09-acceptance-tests.md`;
5. current Glossa code and tests;
6. this handoff's recorded architecture decisions.

The stale prototype is outside that source-of-truth chain.

## Useful ideas that still require fresh implementation

- outbound-only worker connections;
- local authority over filesystem and process enforcement;
- explicit devices, workspaces, and jobs;
- bounded file and command results;
- worker reconnection after relay restart.

These are retained only where the current Glossa requirements independently justify them.
