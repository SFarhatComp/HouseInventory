# ADR-0001: Containerized modular workspace

- Status: Accepted
- Date: 2026-10-10
- Deciders: Project owner and implementing agent
- Supersedes: None
- Superseded by: None

## Context

The family beta should be reproducible on a machine with only Git and Docker, keep host dependencies small, and leave room for a polished web product without prematurely splitting it into services. The approved design selects Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, and Supabase, with a phone-first PWA and modular package boundaries.

## Assertions (implementation must prove)

- `apps/web` owns the Next.js application; `packages/domain` owns framework-independent domain rules; `packages/ui` owns shared visual components; `packages/config` owns shared configuration. Domain code cannot import React, Next.js, Supabase, browser globals, or `apps/*`.
- The workspace, tools, development, and production build run in containers. Git and Docker are the only required host tools; the production runner is non-root and contains no development/security/database tooling or runtime secrets.
- The local command contract is stable and documented in [development.md](../development.md); local Supabase published ports bind only to loopback.
- Linux Compose host networking is restricted to the no-socket `e2e` and `supabase-tools` services; the latter is separately constrained in [ADR-0002](0002-local-supabase-docker-socket.md).

## Decision

Use one modular pnpm workspace and containerized development/build workflow. Keep the web app and shared packages in one repository; do not introduce microservices or a native mobile package in Milestone 1. Add boundaries and package ownership before feature implementation so later inventory capabilities can extend the domain without binding it to a UI or backend SDK.

## Alternatives considered

- Host-installed Node/pnpm: simpler initially, but adds local version and dependency drift contrary to the host-tooling goal.
- A monolith with no package boundaries: fewer files now, but makes domain/UI coupling and later feature ownership harder to detect.
- Microservices or native app from the outset: increases operational and product surface before the family beta needs it.

## Consequences

The tools image owns pinned runtimes and dependencies; a clean checkout can bootstrap through Docker. The workspace has a modest setup cost and must keep lockfiles, image versions, and package boundaries current. Production images stay smaller and non-root. Later native work may consume domain/UI-independent contracts but is not committed to a specific mobile framework.

## Verification

Task 2 checks the required directories and package names and rejects `apps/mobile`. Container checks enforce the production user and tool exclusions. Task 3 verifies the domain import boundary. Compose checks enforce the service and network constraints stated above.

## Reversal path

If host-installed development, a different workspace/package manager, microservices, or a native package becomes justified, propose a superseding ADR describing the operational and boundary changes; do not silently weaken these constraints.
