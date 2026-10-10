# Local development contract

This document records the target operator interface for Foundation Milestone 1. Commands are introduced progressively by the implementation plan; a command listed here is a contract, not a claim that its executable already exists in this documentation-only task.

## Prerequisites and resource budget

The supported local setup requires Git and Docker; Node.js, pnpm, Supabase CLI, and application tools run in containers. Allocate at least 7 GB of RAM to Docker for the full Supabase local stack, as recommended by the [Supabase CLI documentation](https://supabase.com/docs/reference/cli/global-flags).

Local Supabase uses project `hi`, network `hi-supabase`, and these stable loopback ports:

| Service | Host address |
|---|---|
| Next.js | `127.0.0.1:3000` |
| Supabase API | `127.0.0.1:54321` |
| PostgreSQL | `127.0.0.1:54322` |
| Mailpit | `127.0.0.1:54324` |

Supabase ports are published only on `127.0.0.1`; do not expose them to the LAN. The app and container tools use the internal network where possible. See [ADR-0001](adr/0001-containerized-modular-workspace.md), [ADR-0002](adr/0002-local-supabase-docker-socket.md), and [ADR-0003](adr/0003-household-context-invitation-and-pwa-boundaries.md) for the boundaries behind this contract.

## Commands

| Command | Contract |
|---|---|
| `./bin/dev` | Interactive development; requires `BWS_ACCESS_TOKEN`, starts local Supabase, waits for health, then runs the allowlisted development command with Next.js on loopback. |
| `./bin/dev --lan` | Same secret-backed path, but exposes only Next.js on `0.0.0.0` for trusted-LAN visual testing with fake data. It is not the auth-link or PWA acceptance environment. |
| `./bin/check` | Containerized aggregate formatting, lint, type, boundary, unit, component, operations, database, E2E, accessibility, secret-scan, and production-build checks. Does not require Bitwarden; uses disposable test-only keys. |
| `./bin/test <suite>` (`unit`, `component`, `operations`, `db`, `e2e`, or `all`) | Run the named isolated test suite with fresh process-local test-only keys; no Bitwarden. |
| `./bin/build` | Build the app and non-root production image without runtime secrets. |
| `./bin/db <operation>` (`start`, `stop`, `status`, `reset`, `lint`, `test`, `types`, `types-check`, `backup`, or `restore`) | Operate only this repository's local Supabase project. Restore requires explicit confirmation; no remote target. |
| `./bin/logs [web]` | Follow safe development logs without environment values. |
| `./bin/verify-service-logs` | Run the fixed service-log canary verification and print only safe pass/fail summaries. |
| `./bin/with-secrets dev` | Internal, fixed-purpose Bitwarden runner for interactive development; rejects arbitrary commands and check/test/build modes. |

Interactive development requires the externally supplied `BWS_ACCESS_TOKEN`; it is never stored in the repository. Test/check commands use only generated disposable keys, and production builds receive no runtime secrets. Do not paste secrets into command arguments or logs.

## Local-only and hosted-operation boundary

The default target is local Docker/Supabase. Hosted project creation, hosted database or Auth changes, migrations against a remote project, secrets, storage, functions, deployment, paid services, domains, pushing, and pull-request operations each require a separate explicit owner request. A local CLI or MCP connection being available does not itself grant authority to mutate hosted state. During Foundation Milestone 1, Supabase MCP use is documentation/reference only; see [agent-tooling.md](agent-tooling.md).
