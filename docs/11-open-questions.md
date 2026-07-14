# Core open questions requiring owner decisions

These questions can materially affect the core implementation. Post-MVP choices are kept in `optional/`.

There are no unresolved owner questions from the original core handoff or this review.

Resolved: Windows is the supported private beta worker platform. macOS and Linux worker support is deferred until after the Windows-first private beta.

Resolved: GitHub is the only enabled social login connection for the private beta.

Resolved: the private beta is invite-only. Authentication does not create or admit an account automatically.

Resolved: the canonical absolute path is displayed only by the local CLI. MCP clients use device ID and root-relative path `.`.

Resolved: asynchronous commands default to 15 minutes and have a 60 minute hard maximum.

Resolved: commands inherit the complete environment and permissions of the process that started Glossa.

Default assumptions in the implementation plan:

- clean Glossa naming with no old-name alias or compatibility package;
- private beta validates Windows worker behavior first;
- GitHub social login enabled;
- invite-only beta;
- device ID and root-relative path `.` identify the active root remotely;
- existing `glossa.sh` website and Vercel Domains ownership remain untouched except for the new `mcp` DNS record.
