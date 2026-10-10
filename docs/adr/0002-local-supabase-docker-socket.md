# ADR-0002: Local Supabase and the Docker socket

- Status: Accepted
- Date: 2026-10-10
- Deciders: Project owner and implementing agent
- Supersedes: None
- Superseded by: None

## Context

Local development should use Supabase without requiring a hosted project or paid service. The Supabase CLI must create/manage its local containers, which requires access to the Docker API. A mounted Docker socket is effectively host-level control and must be treated as a security exception, not an ordinary application capability.

## Assertions (implementation must prove)

- Only the one-shot `supabase-tools` service may mount the Docker socket. It is development-only, has no Bitwarden/application secrets, is never privileged, and does not persist Docker logs.
- Exactly two Linux services may use host networking: `supabase-tools` and the no-socket `e2e` service. E2E receives no socket, published ports, or secrets.
- Supabase published ports bind to `127.0.0.1`; the local project is `hi` and its Compose network is `hi-supabase`. Bridge-networked app services use internal service DNS rather than host-published ports.
- E2E uses exact `http://127.0.0.1:3000` application links delivered through local Mailpit. Account confirmation/recovery tokens appear only in URL fragments, are cleared before app-triggered network/reporting, then sent once through a same-origin server action.
- No Supabase URL/key or browser Supabase data client is exposed to browser code in Milestone 1. Browser data access is mediated by same-origin server actions; a browser client or Realtime subscription requires a later explicit security review before implementation.

## Decision

Use the Supabase CLI local stack. Isolate socket access in a constrained, one-shot `supabase-tools` service; no web, workspace, E2E, or secrets-running service receives it. The socket mount is an explicit development-only host-equivalent privilege. Keep Supabase port publication loopback-only and preserve the approved Linux host-network exceptions solely for `supabase-tools` and `e2e`.

## Alternatives considered

- Run Supabase CLI directly on the host: violates the minimal host-dependency goal and weakens reproducibility.
- Give the web/workspace container the Docker socket: would expose host control to long-running app/development processes.
- Use hosted Supabase for local development: creates network/account dependence and risks unintended remote mutation or cost.
- Give E2E a socket or broaden host networking: unnecessary for following the exact loopback links and increases privilege.

## Consequences

The socket-bearing service is highly trusted and its image/entrypoint must remain narrow. Host-network support is Linux-specific; the supported local contract targets Linux Docker Engine. Loopback links are intentionally exact for password-flow testing, while LAN preview is not an auth/PWA acceptance environment. Milestone 1 accepts server-mediated access; Realtime or browser-side Supabase access is deferred to a reviewed decision.

## Verification

Compose structural checks reject socket mounts outside `supabase-tools`, unexpected host networking, privileged app services, secrets on socket/E2E services, or non-loopback Supabase publishing. E2E validates exact loopback links and fragment handling. Browser bundles and runtime configuration are scanned for Supabase endpoint/key exposure.

## Reversal path

Remove or relocate socket access only through a superseding ADR that documents a tested alternative for local Supabase lifecycle management. Any new socket consumer, host-network service, published bind address, browser client, or Realtime path requires a new explicit security decision and corresponding tests.
