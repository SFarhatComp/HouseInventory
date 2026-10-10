# Platform and Household Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Milestone 1 as a working, phone-first foundation: a reproducible containerized repository, local Supabase, a Fresh and Airy PWA shell, safe operational logging, email/password authentication, isolated households, owner-managed invitations, and tested row-level security.

**Architecture:** Build one Next.js modular monolith in a pnpm workspace. Keep framework-independent rules in `packages/domain`, reusable visual primitives in `packages/ui`, and shared tooling in `packages/config`. Supabase migrations are the only database source of truth. Protected routes carry the active household explicitly as `/[locale]/h/[householdId]/...`; every server and database boundary revalidates membership. Containers own the application toolchain, while a narrowly scoped one-shot Supabase tools service receives the Docker socket solely to operate the local stack.

**Tech Stack:** Node.js 24 LTS, pnpm workspaces, Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui source components, Lucide, React Hook Form, Zod, next-intl, Supabase PostgreSQL/Auth/Data API, Pino, Vitest, Testing Library, pgTAP, Playwright, axe, Docker Compose, Bitwarden Secrets Manager CLI, and Gitleaks

**Spec:** `docs/superpowers/specs/2026-10-09-household-food-inventory-design.md`

## Global Constraints

- This plan covers all and only Milestone 1: platform, mobile shell, authentication, households, invitations, baseline operations, and their tests.
- Do not implement Inventory, Shopping, dietary safety, Meals, pricing, AI, export/deletion, hosted deployment, or a native client. Navigation placeholders may identify later milestones but must not pretend those capabilities work.
- Do not create `apps/mobile`, microservices, a background worker, provider-specific CI, or speculative packages.
- Git and Docker with Docker Compose remain the only host prerequisites. All Node, pnpm, Supabase, PostgreSQL, browser, lint, test, build, secret, and database tooling runs in containers.
- Pin container images and installed tools. Use the baseline below and exact package versions with a committed lockfile; do not use `latest`. If a pinned artifact is unavailable or has a published security defect when execution starts, stop and record the reviewed replacement in the ADR and lockfile rather than silently floating versions.
- Never mount the Docker socket into the web service or production image. Treat the socket-bearing local-development service as host-equivalent privilege and document it in an ADR.
- The local Supabase network binds published ports to `127.0.0.1`. Web, tools, workspace, and later secrets-runner containers join that network and use internal container DNS; on Linux, E2E uses host networking without a socket or published ports so its browser can follow the exact loopback application links delivered through Mailpit. Milestone 1 sends all application mutations through same-origin Next.js actions and exposes no Supabase endpoint or key through application bundles, runtime configuration, browser links, or browser data clients. Account verification/recovery links target `http://127.0.0.1:3000/auth/confirm` and place the short-lived Supabase token hash and flow type in the URL fragment. Browsers omit that fragment from the initial document and static-asset requests; at its first execution, the confirm client synchronously moves the values to memory and clears the fragment before any app-triggered fetch, action, telemetry, or error report, then submits them once to a same-origin action. `./bin/dev --lan` exposes only Next.js on `0.0.0.0` for trusted-LAN visual testing with fake data.
- Do not use the Supabase, Vercel, or GitHub MCPs to mutate hosted services while implementing this plan. Hosted project creation, deployment, remote migrations, pushes, and PRs require a separate request.
- `BWS_ACCESS_TOKEN` stays outside the repository and is passed only at runtime. Interactive `./bin/dev`/`--lan` requires that bootstrap token and delegates to the constrained Bitwarden runner; automated `./bin/check` and `./bin/test` instead generate fresh test-only pseudonym/invitation keys inside their runner process, inherit them only into test children, and never print or persist them. No privileged key, real email, real household data, raw request body, confirmation/recovery token hash, session credential, or raw invitation token may enter source, images, fixtures, logs, screenshots, Playwright traces/HAR/video, retained test artifacts, or command output. The explicit transient exceptions are the suite-scoped disposable Mailpit message containing an account-email token hash (deleted immediately after bounded in-memory extraction and again by failure-safe suite cleanup), one verification-action request and one Auth POST body, and session credentials in host-only Cookie/Set-Cookie, bounded Next server memory, and direct Next-to-Auth authorization/refresh request/response boundaries; none becomes a retained test artifact or application log. Committed UI fixtures use obviously synthetic values only.
- Follow red-green-refactor for behavior, authorization, schemas, and regressions. Configuration work starts with a deterministic failing assertion and ends with an executable check.
- Each task updates its affected documentation, creates one focused non-amended commit, resolves the active execution worktree's absolute repository root, calls Codebase Memory `index_repository` for that exact root, and polls `index_status` until that worktree's committed `HEAD` is ready. Use `/home/miso/project/HI` only when it is the active execution checkout. Stop and report if the indexed root and commit cannot both be verified.
- Use a worktree when execution begins. Serialize local Supabase work across worktrees unless the repository scripts have created a distinct project ID, port set, and loopback network.

## Pinned Baseline

- Node image: `node:24.21.0-bookworm-slim`, with its multi-architecture digest recorded in the Dockerfile during Task 2
- pnpm: `12.10.1`
- Next.js: `16.4.0`; React and React DOM: `19.3.0`
- Supabase CLI: `2.120.0`; `@supabase/ssr`: `0.12.7`; `@supabase/supabase-js`: `2.117.2`
- Bitwarden Secrets Manager CLI: `2.1.0`
- Gitleaks container: `ghcr.io/gitleaks/gitleaks:v8.30.0@sha256:691af3c7c5a48b16f187ce3446d5f194838f91238f27270ed36eef6359a574d9`, plus a committed positive canary test
- Pino: `10.4.0`; next-intl: `4.14.9`
- Each remaining direct JavaScript package is installed at the task that first needs it, with an exact version reviewed for Node/Next compatibility and frozen in `pnpm-lock.yaml` before that task's feature code is added.

Local fixed ports are Next.js `3000`, Supabase API `54321`, PostgreSQL `54322`, and Mailpit `54324`. Studio and analytics services are excluded. The project ID is `hi`, and the loopback-bound Docker network is `hi-supabase`.

## Decisions Locked by Plan Approval

- Household application URLs use an explicit `householdId` path segment. A future convenience cookie may remember the last selection, but it is never an authorization source.
- Owners create a one-time copy/share invitation link in Milestone 1. The bearer token is placed in the URL fragment (`/invite#<token>`), which browsers do not send in HTTP request URLs. The acceptance page is `private, no-store`, uses `Referrer-Policy: no-referrer`, moves the token into in-memory component state, clears the fragment, and then submits it. No transactional-email provider is added for household invitations. Supabase still sends account verification and password-recovery mail, but custom templates link to `/auth/confirm#token_hash=<hash>&type=<email|recovery>` rather than using the provider `ConfirmationURL`; the same fragment-clearing rule applies before a one-time same-origin verification action.
- The server derives a 32-byte opaque invitation token with HMAC-SHA-256 over a versioned canonical tuple of server-verified issuer, household, normalized invited email, role, and random UUID idempotency key, using a server-only derivation key. An exact retry derives the same base64url token; changing any invitation field under the same key is an idempotency conflict. Only the token's SHA-256 hexadecimal digest is sent to or stored by Supabase. The invite expires after seven days and can establish at most one membership.
- Local password-flow tests use the Mailpit service included in the Supabase CLI stack.
- A minimal service worker may cache only versioned public shell assets and an offline page. It never caches authenticated HTML, API responses, Supabase responses, or mutations.
- Basic local logical backup/restore commands are created now because the repository contract requires them. They refuse non-local targets and restore requires an explicit confirmation flag. The hosted backup policy and full recovery drill remain Milestone 5.
- Physical-phone LAN mode is a visual/responsive preview, not the PWA installability or account-email-link acceptance environment: plain LAN HTTP is not a secure context and its changing address is not an approved Auth origin. PWA and full auth tests run on secure localhost in Playwright; hosted HTTPS phone acceptance belongs to Milestone 5.
- Milestone 1 visual snapshots cover only the stable shell/auth/household surfaces introduced here. The complete feature visual-regression program remains part of Milestone 5.
- Supabase access/refresh credentials persist only in host-only session cookies: `HttpOnly`, `SameSite=Lax`, path `/`, no `Domain`, bounded lifetime, and `Secure` exactly when the validated application origin is HTTPS. Local `http://127.0.0.1` is the documented non-Secure development exception; hosted HTTPS must set `Secure`. They may exist transiently in bounded Next server memory and direct Next-to-Auth authorization/refresh request/response bodies or headers, but never logs, caches, client JavaScript, persisted Playwright storage state, traces/HAR/video, screenshots, or retained artifacts. Every response that sets, refreshes, or clears a session cookie is dynamic and carries `Cache-Control: private, no-store`, `Pragma: no-cache`, and an expired `Expires` value.

## Stable Interfaces

### Host command surface

| Command | Contract |
|---|---|
| `./bin/dev` | Require `BWS_ACCESS_TOKEN`, start local Supabase, wait for health, then delegate to the allowlisted `./bin/with-secrets dev` runner and serve Next.js on loopback. |
| `./bin/dev --lan` | Use the same Bitwarden-backed path while binding only Next.js to `0.0.0.0`; print the phone URL and a LAN-warning message. |
| `./bin/check` | Start required local services, then run format check, lint, type checking, boundaries, unit, component, operations, database, end-to-end, accessibility, secret scan, and production build in a runner that generates non-persisted test-only application keys. It never requires or reads Bitwarden. |
| `./bin/test unit\|component\|operations\|db\|e2e\|all` | Run the named containerized suite with fresh process-local test-only application keys; it never requires or reads Bitwarden. |
| `./bin/build` | Build the application and the non-root production image. |
| `./bin/db start\|stop\|status\|reset\|lint\|test\|types\|types-check\|backup\|restore` | Operate only the repository's local Supabase project unless a later, separately approved plan adds a remote mode. |
| `./bin/logs [web]` | Follow development logs without printing environment values. |
| `./bin/verify-service-logs` | Start the fixed no-socket audit web child, run the in-memory service-log canary scanner concurrently in the socket-bearing tools service, and tear down the child on every exit; accept no arguments and print only safe pass/fail summaries. |
| `./bin/with-secrets dev` | Verify required local services and their startup attestation, then run only the fixed internal development command in a no-socket `secrets-runner` service under `bws run`; arbitrary shell execution and check/test/build modes are rejected. This is the internal target for `./bin/dev`; production builds never receive runtime secrets. |

Root pnpm scripts contain the actual tooling logic. The host wrappers do argument validation and invoke the appropriate Compose service; CI will call the same Compose-backed entry points.

Any command that needs CLI-generated local Supabase credentials uses one fixed streaming handoff: a `supabase-tools` emitter captures machine-readable CLI output with tracing off, refuses a TTY, accepts only a closed non-secret target identifier, and writes a versioned allowlisted payload only into an anonymous pipe. The payload binds the credentials to exactly one validated server URL: `http://supabase_kong_hi:8000` for bridge-networked web/tools/workspace/`secrets-runner` targets, or `http://127.0.0.1:54321` for the existing host-networked `e2e` service in either its normal E2E mode or closed service-log-audit-web mode. The `db-test-bridge` payload alone additionally carries a direct PostgreSQL connection URL parsed from machine-readable CLI status, rebound and validated to `supabase_db_hi:5432`, and consumed only by the closed two-connection database-test child. The named no-socket consumer rejects a target, field-set, or URL mismatch before spawning its child. The wrapper uses `pipefail`; neither side echoes values. Credentials never enter host shell variables, command arguments, Compose interpolation, files, images, or terminal output. Development sends a bridge-bound payload only to `secrets-runner`; ordinary tests use their declared network target, while either `e2e` mode receives only the loopback-bound API payload in its ephemeral-key runner. No direct database credential enters the app, E2E, audit-web, browser, build, or non-database test target; no Supabase variant enters browser configuration or client code; build receives no runtime credentials.

### Application and database boundaries

- `packages/domain` may import only the TypeScript standard library and its own modules. It exports branded identifiers, household-role rules, active-context parsing, invitation-expiry decisions, and validation-neutral result types.
- `apps/web/src/lib/supabase/server.ts` creates request-scoped clients from SSR cookies and the publishable key. There is no browser Supabase client in Milestone 1. A server-only operational-event adapter internally creates a secret-key client and exports only `recordOperationalEvent(SafeOperationalEvent)`—never the unrestricted client. Test/setup code is excluded from the production build.
- Session helpers set host-only `HttpOnly`, `SameSite=Lax`, path-`/`, bounded cookies, add `Secure` in hosted HTTPS, and document/test the loopback-HTTP exception. Server code may transiently consume credentials and send them only to Auth for user validation/refresh. The centralized adapter propagates `@supabase/ssr` `setAll(cookies, cacheHeaders)` onto the actual response and strengthens it so any session Set-Cookie implies dynamic `private, no-store`, `Pragma: no-cache`, and expired `Expires`; no Client Component, shared cache, log, reporter, or retained artifact may read or store credential values.
- `requireUser()` authenticates the request. `requireHouseholdContext(householdId)` then confirms an active membership and returns `{ userId, householdId, role }`; route shape alone never authorizes access.
- Browser-facing server reads use reviewed RLS-backed fixed-path POST RPCs; household/user identifiers travel only in request bodies and never Data API URL paths or query strings. Multi-step household, membership, and invitation changes use reviewed database functions with fixed `search_path`, explicit grants, and transactional checks.
- Mutation functions return one of three stable composite results: `mutation_result(outcome mutation_outcome, retry_after timestamptz)`, `uuid_mutation_result(outcome mutation_outcome, entity_id uuid, retry_after timestamptz)`, or `version_mutation_result(outcome mutation_outcome, version bigint, retry_after timestamptz)`. `mutation_outcome` is the closed enum `succeeded | invalid | forbidden | conflict | rate_limited`; expected failures return a result so rate-bucket updates commit, while unexpected internal failures still raise and roll back. Required database functions have these exact public signatures; actor identity and verified email always come from `auth.uid()` and `auth.users`, never caller parameters:

```sql
get_my_profile() returns table (id uuid, display_name text, locale text)
list_my_households() returns table (id uuid, name text, currency text, locale text, timezone text, status text, role public.household_role, version bigint)
get_household_shell(p_household_id uuid) returns table (id uuid, name text, currency text, locale text, timezone text, status text, role public.household_role, version bigint)
list_household_members(p_household_id uuid) returns table (user_id uuid, display_name text, role public.household_role, status public.membership_status, joined_at timestamptz)
create_household(p_name text, p_timezone text, p_request_id uuid, p_correlation_id uuid) returns public.uuid_mutation_result
update_household(p_household_id uuid, p_name text, p_timezone text, p_expected_version bigint, p_correlation_id uuid) returns public.version_mutation_result
change_household_member_role(p_household_id uuid, p_user_id uuid, p_role public.household_role, p_correlation_id uuid) returns public.mutation_result
remove_household_member(p_household_id uuid, p_user_id uuid, p_correlation_id uuid) returns public.mutation_result
leave_household(p_household_id uuid, p_correlation_id uuid) returns public.mutation_result
create_household_invitation(p_household_id uuid, p_invited_email text, p_role public.household_role, p_token_digest text, p_request_id uuid, p_correlation_id uuid) returns public.uuid_mutation_result
list_household_invitations(p_household_id uuid) returns table (id uuid, invited_email text, role public.household_role, issued_by uuid, created_at timestamptz, expires_at timestamptz, accepted_at timestamptz, revoked_at timestamptz)
revoke_household_invitation(p_household_id uuid, p_invitation_id uuid, p_correlation_id uuid) returns public.mutation_result
accept_household_invitation(p_token_digest text, p_correlation_id uuid) returns public.uuid_mutation_result
purge_expired_operational_events() returns bigint
purge_stale_household_invitations() returns bigint
```

  Every audited mutation validates the request-context UUIDv4 correlation ID and writes it unchanged to its audit row; the idempotency request ID is separate and never reused as correlation. Before expected validation/authorization work, security-sensitive mutation functions atomically consume a permit from a bounded private token-bucket row keyed by authenticated actor and registered scope. An exact idempotent retry may bypass consumption only after reauthenticating the actor, rechecking the operation's current authorization/replay eligibility, and proving every canonical field matches; a former owner/member never regains an old capability through replay. The result carries a safe `retry_after` only for `rate_limited`. Functions are invoker-security unless elevated access is necessary. Revoke default and existing `EXECUTE` privileges from `PUBLIC`, `anon`, and `authenticated` for every function created in an exposed schema, including invoker-security routines, before granting only exact reviewed signatures to required roles. Every security-definer function also has `search_path = ''`, fully qualified objects, and explicit ownership. The private helper schema is absent from Data API exposed schemas, denies `CREATE` and broad privileges, and grants `authenticated` only `USAGE` plus `EXECUTE` on the exact safe membership predicates required by authenticated-only RLS policies; `anon` receives neither. Token-bucket helpers remain callable only by function owners. Maintenance/purge routines are granted only to the maintenance role.
- The Next server hashes an invitation token immediately after receiving it from browser memory and passes only a strictly validated 64-character lowercase hexadecimal digest to `accept_household_invitation`. A still-unaccepted, valid invitation may create or reactivate the matching verified account's membership with the invited role; it never overwrites another active membership implicitly. Once accepted, a retry by that same account returns the previously accepted household ID without changing membership status or role, while a different-account replay rejects. Removal or leave after acceptance therefore cannot be undone by replaying the consumed invitation.
- Browser roles receive no direct invitation-table privileges. The owner-only `list_household_invitations` function returns the exact summary columns above and can never return the token digest or idempotency key.

Milestone 1 owns these columns and no feature-domain columns:

| Table | Required columns and constraints |
|---|---|
| `profiles` | `id uuid` PK/FK to `auth.users` with account-delete cascade, bounded `display_name`, `locale = 'en-CA'`, UTC `created_at`/`updated_at` |
| `households` | UUID PK, bounded `name`, `currency = 'CAD'`, `locale = 'en-CA'`, valid IANA `timezone`, lifecycle `status`, nullable historical `created_by` with account-delete set-null, `create_request_id`, monotonic `version`, UTC timestamps, unique `(created_by, create_request_id)` |
| `household_members` | `(household_id, user_id)` PK, `role` (`owner`/`member`), `status` (`active`/`inactive`), UTC join/update timestamps, household FK, and account-delete cascade on user FK subject to the deferred last-owner invariant |
| `household_invitations` | UUID PK, household, normalized invited email, role, unique 64-character SHA-256 digest, nullable historical issuer/acceptor references with account-delete set-null, request ID, seven-day expiry, accepted/revoked timestamps, UTC timestamps, unique `(issued_by, request_id)` |
| `audit_events` | UUID PK, household, nullable historical actor with account-delete set-null, registered action/target codes, optional target UUID, correlation UUID, UTC timestamp; no payload column |
| `operational_events` | UUID PK, unique diagnostic ID, correlation UUID, registered operation/error/outcome, optional HMAC actor/household refs, UTC creation and 30-day expiry; no raw identifier or payload column |
| `private.mutation_rate_buckets` | `(actor_id, scope)` PK, bounded token balance and UTC refill timestamp, account-delete cascade; no browser grants and at most one row per actor/scope |

All application primary keys are UUIDs; technical timestamps are `timestamptz` in UTC. RLS is enabled before grants are added. The private helper schema is not exposed through the Data API.

M1 mutation token buckets use these exact capacities/refill rates: `household.create` 5/hour, `household.update` 30/hour, `invitation.create` 10/hour, `invitation.accept` 20/15 minutes, `invitation.revoke` 30/hour, and one shared `membership.manage` bucket for role change/remove/leave at 30/hour. Auth registration/sign-in/email limits remain the Supabase Auth limits in Task 4. Reads and idempotent replay responses do not consume mutation permits.

### Logging boundary

`apps/web/src/modules/operations/server/logger.ts` exposes only centrally registered operation, route-template, and error codes. `createLogger` may receive branded raw UUIDs in its server-only context and immediately HMAC-pseudonymizes them; event methods can never receive identifiers or free-form metadata:

```ts
type OperationCode = (typeof OPERATION_CODES)[number];
type RouteTemplate = (typeof ROUTE_TEMPLATES)[number];
type ErrorCode = (typeof ERROR_CODES)[number];
type CorrelationId = string & { readonly __brand: "CorrelationId" };
type DiagnosticId = string & { readonly __brand: "DiagnosticId" };

type SafeLogEvent = {
  outcome: "success" | "failure";
  durationMs?: number;
  errorCode?: ErrorCode;
};

type AppLogger = {
  info(event: SafeLogEvent): void;
  warn(event: SafeLogEvent): void;
  error(event: SafeLogEvent): DiagnosticId;
};

declare function createLogger(input: {
  operation: OperationCode,
  route: RouteTemplate,
  actorId?: UserId,
  householdId?: HouseholdId
}): AppLogger;

declare function requireRequestContext(): {
  correlationId: CorrelationId;
};

declare function withActionContext<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult>;
```

The wrapper adds timestamp, severity, environment, version, deployment ID, a generated diagnostic ID, a server-generated lowercase UUIDv4 correlation ID, and internal HMAC pseudonyms. Every untrusted public request gets a new correlation ID; caller-supplied `x-correlation-id` and private-context headers are replaced, not propagated. Trusted upstream propagation is deferred until a future authenticated boundary exists. `error()` returns the same branded diagnostic ID written to the event so a safe failure response can display it; callers cannot supply or alter either ID. Runtime schemas bound every string and number. The logger does not accept arbitrary metadata, caller-supplied diagnostic/pseudonym values, raw `Error` objects, request objects, headers, bodies, actual pathnames, or URLs.

The initial registries are fixed to:

- Operations: `health.check`, `readiness.check`, `auth.sign_up`, `auth.sign_in`, `auth.recover`, `auth.reset`, `auth.sign_out`, `household.create`, `household.update`, `household.switch`, `invitation.create`, `invitation.revoke`, `invitation.accept`, `member.change_role`, `member.remove`, and `member.leave`
- Route templates: `/api/health`, `/api/readiness`, `/[locale]/sign-up`, `/[locale]/sign-in`, `/[locale]/forgot-password`, `/[locale]/reset-password`, `/auth/confirm`, `/[locale]/households`, `/[locale]/households/new`, `/[locale]/h/[householdId]`, `/[locale]/h/[householdId]/settings/household`, and `/[locale]/invite`
- Error codes: `VALIDATION_FAILED`, `AUTH_REQUIRED`, `AUTH_INVALID`, `EMAIL_UNVERIFIED`, `RATE_LIMITED`, `HOUSEHOLD_FORBIDDEN`, `VERSION_CONFLICT`, `INVITATION_INVALID`, `DEPENDENCY_UNAVAILABLE`, and `INTERNAL_ERROR`

## Review Focus

- **Reproducibility and privilege:** A clean machine needs only Git and Docker; only the one-shot `supabase-tools` service has the Docker socket; production is non-root and contains no dev/security/database tool or secret.
- **Secrets, privacy, and diagnostics:** Browser bundles, status wrappers, service logs, health responses, printed access URLs, caches, screenshots, traces/HAR/video, localStorage/sessionStorage/Playwright `storageState`, retained test artifacts, manifests, command output, and non-backup artifacts contain no privileged key, real email, undeclared raw identifier, real household data, password, confirmation/recovery token hash, session credential, or invitation token. The reviewed exception is the active household UUID in the canonical `/<locale>/h/<householdId>/...` address-bar/history route; it is never an authorization source and must not be copied into other persisted browser state or artifacts. Account-email and invitation credentials exist only in their declared disposable email/fragment/memory/action boundaries; access/refresh credentials persist only in secure cookies and cross only the declared transient browser/Next/Auth boundaries. UI fixtures are synthetic, and closed codes/pseudonyms still correlate failures. Local backup files are explicitly sensitive mode-0600 artifacts that may contain application rows, but never Auth identities/password hashes, privileged keys, or raw invitation tokens.
- **Authorization and concurrency:** RLS/function ACL tests cover every role and cross-household case; authentication uses a server-verified user rather than `getSession()`; true two-connection tests prove all mutation token buckets and the last-owner invariant under races.
- **Reliable household workflows:** Registration, verification, recovery, create/update/switch household, invite/accept/revoke, role change, removal, and leave are validated, same-origin, transactional where needed, retry-safe, retention-aware, and visibly fail without false success.
- **Phone/PWA quality:** Secure-localhost tests prove 360/390/430 layouts, 44-pixel targets, AA/focus/reduced-motion/safe-area behavior, exact cache allowlisting, private/no-store responses, offline/reconnect behavior, and a production build; LAN mode makes narrower claims.

---

### Task 1: Record the Milestone 1 architectural decisions

**Files:**
- Create: `docs/adr/0001-containerized-modular-workspace.md`
- Create: `docs/adr/0002-local-supabase-docker-socket.md`
- Create: `docs/adr/0003-household-context-invitation-and-pwa-boundaries.md`
- Create: `docs/development.md`
- Modify: `docs/agent-tooling.md`

**Interfaces:**
- Consumes: approved specification, root agent rules, and this plan
- Produces: accepted decisions for package ownership, container commands, local Docker privilege, household URL context, invitation delivery, and PWA caching

- [ ] **Step 1: Write the ADR assertions before the decisions**

  In each ADR, list the observable consequences that implementation must later prove: import boundaries, Docker-socket isolation, the two narrowly allowed Linux host-network services, loopback-only Supabase publishing, exact loopback application-link E2E tests with fragment-only account tokens, server-mediated browser data access for Milestone 1, the later Realtime/browser-client review point, explicit household route context, deterministic-retry digest-only invitations, and no private response caching.

- [ ] **Step 2: Verify the assertions are currently unmet**

  Run `rg --files apps packages supabase compose.yaml Dockerfile bin` and confirm the application files do not yet exist. This is the expected red state for the architectural assertions.

- [ ] **Step 3: Complete the accepted ADRs**

  Document context, decision, alternatives, consequences, and reversal path. Record the socket mount as a development-only security exception. Mark the ADRs `Accepted` only because execution starts after the owner approves this plan.

- [ ] **Step 4: Define the operator contract**

  Add the stable command table, expected ports, default loopback behavior, `--lan` behavior, approximate local resource requirement, and the rule that hosted operations need separate authorization to `docs/development.md`. Update `docs/agent-tooling.md` so Supabase MCP is documentation-only for this milestone.

- [ ] **Step 5: Validate documentation**

  Run `git diff --check`, verify every new relative link resolves, and use `rg` to confirm the three ADRs cover every decision in the “Decisions Locked by Plan Approval” section.

- [ ] **Step 6: Commit and re-index**

  Commit as `docs: record foundation architecture decisions`. Re-index Codebase Memory at that exact `HEAD` and verify ready status before Task 2.

### Task 2: Bootstrap the containerized pnpm workspace

**Files:**
- Create: `.dockerignore`
- Create: `.editorconfig`
- Modify: `.gitignore`
- Create: `.npmrc`
- Create: `Dockerfile`
- Create: `compose.yaml`
- Create: `.devcontainer/devcontainer.json`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `pnpm-lock.yaml`
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`
- Create: `packages/config/package.json`
- Create: `packages/config/typescript/base.json`
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/src/index.ts`
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`
- Create: `bin/dev`
- Create: `bin/build`
- Create: `bin/logs`
- Create: `bin/network`
- Create: `scripts/verify/container-boundary.mjs`
- Create: `scripts/verify/workspace-layout.mjs`

**Interfaces:**
- Workspace packages: `@hi/web`, `@hi/domain`, `@hi/ui`, and `@hi/config`
- Docker targets: `tools`, `db-tools`, `development`, `builder`, and `runner`
- Compose services: `tools`, `workspace`, `supabase-tools`, `web`, and `e2e`; Task 5 adds `secrets-runner`
- Named volumes: pnpm store, workspace modules, Next build cache; Supabase CLI owns the named local database volume

- [ ] **Step 1: Add failing structural checks**

  Write `workspace-layout.mjs` to require the approved directories/package names and reject `apps/mobile`. Write `container-boundary.mjs` to parse `docker compose config --format json` and reject a Docker-socket mount anywhere except the one-shot `supabase-tools` service, any Bitwarden/application-secret environment on that service, a privileged web/workspace service, a root production runner, or any persistent Docker logging driver on `supabase-tools`.

- [ ] **Step 2: Run the checks in a pinned temporary Node container**

  Confirm both checks fail because the workspace and Compose topology are absent. Do not use host Node.

- [ ] **Step 3: Create the workspace manifests and minimal app**

  Set `packageManager` to pnpm `12.10.1`, enable `save-exact`, create the three package boundaries, and add a minimal server-rendered Next.js page on Next.js `16.4.0`/React `19.3.0`. Install only dependencies needed by executable Milestone 1 work; defer Motion until the shell task and Recharts until the later Insights milestone.

- [ ] **Step 4: Add the multi-stage image**

  Pin `node:24.21.0-bookworm-slim` by its resolved digest. Enable pnpm `12.10.1` through Corepack. `tools` contains application/test/security tooling but no Docker socket by default; `db-tools` contains the pinned Supabase CLI, Docker client, and PostgreSQL tools but no `bws`. `runner` uses a non-root user and Next standalone output. No build argument or layer may contain application secrets.

- [ ] **Step 5: Add Compose and devcontainer topology**

  Give only the one-shot `supabase-tools` service the documented socket mount. Pin its Docker logging driver to `none` so attached stdout can feed fixed anonymous credential pipes and safe summaries without daemon persistence; inspect and fail closed on any other effective driver. `web`, `e2e`, `tools`, and the devcontainer `workspace` have no socket and no privileged mode. Declare the external `hi-supabase` network for `web`, `tools`, and `workspace`; before any Compose service needs it, the host wrapper idempotently creates it with `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` and rejects an existing network with incompatible options. Set the devcontainer's host-side `initializeCommand` to `./bin/network ensure` so a fresh editor launch cannot fail on the external network. Configure `e2e` with Linux host networking but no published ports, so it can read local Mailpit and its browser can follow the exact `http://127.0.0.1:3000/auth/confirm#...` application link without rewriting. Reserve Linux host networking for `e2e` and the one-shot `supabase-tools` service, subject to the executable Task 4 topology spike. Add named dependency/cache volumes and health checks, and keep the host web bind on `127.0.0.1` by default.

- [ ] **Step 6: Add host wrappers**

  Make `bin/network`, `bin/dev`, `bin/build`, and `bin/logs` strict scripts with validated arguments and explicit Docker/Compose targets. `bin/network ensure` idempotently creates or validates `hi-supabase`; every wrapper that starts an attached service invokes it before Compose resolves that service. `bin/dev --lan` changes only the web bind address and prints the reachable URL without dumping environment values.

- [ ] **Step 7: Generate and freeze the lockfile inside the tools image**

  Run `./bin/network ensure`, build the tools target, perform a pnpm install with exact versions, commit `pnpm-lock.yaml`, then prove a second install succeeds with `--frozen-lockfile`.

- [ ] **Step 8: Reach green**

  Run `docker compose build tools development runner`, `docker compose run --rm tools pnpm install --frozen-lockfile`, `docker compose run --rm tools pnpm verify:workspace`, and `docker compose run --rm tools pnpm verify:container`. Start `web`, request the minimal page from the health-checked container, and inspect `runner` to prove it is non-root and lacks pnpm store contents and development tools.

- [ ] **Step 9: Commit and re-index**

  Commit as `chore: add containerized pnpm workspace`. Re-index Codebase Memory and verify the exact commit is ready.

### Task 3: Add the shared quality and test harness

**Files:**
- Create: `packages/config/eslint/base.mjs`
- Create: `packages/config/typescript/nextjs.json`
- Create: `packages/config/vitest/base.ts`
- Create: `eslint.config.mjs`
- Create: `prettier.config.mjs`
- Create: `vitest.workspace.ts`
- Create: `playwright.config.ts`
- Modify: `package.json`, `apps/web/package.json`, `packages/config/package.json`, `packages/domain/package.json`, `packages/ui/package.json`, and `pnpm-lock.yaml`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/app/page.test.tsx`
- Create: `apps/web/tests/e2e/bootstrap.spec.ts`
- Create: `scripts/verify/workspace-boundaries.mjs`
- Create: `scripts/verify/no-console.mjs`
- Create: `scripts/verify/docs-links.mjs`
- Create: `scripts/verify/__tests__/workspace-boundaries.test.ts`
- Create: `bin/check`
- Create: `bin/test`

**Interfaces:**
- Root scripts: `format:check`, `lint`, `typecheck`, `test:unit`, `test:component`, `test:operations`, `test:db`, `test:e2e`, `secret:scan`, `build`, and aggregate `check`; `test:db` runs pgTAP followed by the two-connection TypeScript integration tests
- Boundary rule: `packages/domain` cannot import React, Next.js, Supabase, browser globals, or `apps/*`

- [ ] **Step 1: Test the boundary checker first**

  Give the verifier one valid fixture and fixtures that illegally import React, Supabase, and an app module. Run the test in `tools` and see the illegal fixtures are not yet rejected.

- [ ] **Step 2: Implement shared configuration**

  Add strict TypeScript, ESLint flat config, Prettier, Vitest workspaces, Testing Library, Playwright, and axe. Ban unrestricted `console.*` under production application source and server secrets under files with `"use client"`.

- [ ] **Step 3: Implement deterministic repository verifiers**

  Make boundary, no-console, documentation-link, workspace-layout, and container-boundary checks return non-zero with actionable file paths. Do not make them depend on GitHub or network access.

- [ ] **Step 4: Add real smoke coverage**

  Component-test the minimal page semantics and use Playwright to confirm the running container renders it at a phone viewport. Do not add a meaningless constant-only unit test merely to make a command green.

- [ ] **Step 5: Wire container entry points**

  Implement validated `bin/test` suite selection and `bin/check`. Until database and secret tooling arrive, the aggregate command must clearly report those gates as not installed rather than silently marking them passed; remove that temporary state across Tasks 4 and 5.

- [ ] **Step 6: Reach green**

  Run `docker compose run --rm tools pnpm format:check`, `docker compose run --rm tools pnpm lint`, `docker compose run --rm tools pnpm typecheck`, and the verifier unit tests; then run `./bin/test component`, `./bin/test e2e`, and `./bin/build`. All commands execute through Compose.

- [ ] **Step 7: Commit and re-index**

  Commit as `chore: add shared quality harness`. Re-index Codebase Memory and verify ready status.

### Task 4: Add local Supabase and the server-only data boundary

**Files:**
- Create: `.env.example`
- Create: `supabase/config.toml`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/000_smoke.sql`
- Modify: `bin/network`
- Create: `scripts/supabase/topology-spike.mjs`
- Create: `scripts/supabase/start.mjs`
- Create: `scripts/supabase/stop.mjs`
- Create: `scripts/supabase/status.mjs`
- Create: `scripts/supabase/credential-pipe.mjs`
- Create: `scripts/supabase/harden-service-logs.mjs`
- Create: `scripts/runtime/consume-supabase-credentials.mjs`
- Create: `scripts/supabase/reset.mjs`
- Create: `scripts/supabase/types.mjs`
- Create: `scripts/verify/env-example.mjs`
- Create: `scripts/verify/status-redaction.mjs`
- Create: `scripts/verify/service-log-redaction.mjs`
- Create: `scripts/verify/supabase-network.mjs`
- Create: `apps/web/src/lib/env/public.ts`
- Create: `apps/web/src/lib/env/server.ts`
- Create: `apps/web/src/lib/env/env.test.ts`
- Create: `apps/web/src/lib/supabase/database.types.ts`
- Create: `apps/web/src/lib/supabase/server.ts`
- Create: `bin/db`
- Modify: `.gitignore`, `Dockerfile`, `compose.yaml`, `package.json`, `apps/web/package.json`, `pnpm-lock.yaml`, `bin/check`, and `docs/development.md`

**Interfaces:**
- Public env: no Supabase URL or key in Milestone 1; only explicitly allowlisted non-sensitive build labels may use `NEXT_PUBLIC_*`
- Server env: app origin, one target-bound Supabase server URL (`http://supabase_kong_hi:8000` in bridge-networked processes or `http://127.0.0.1:54321` in either closed mode of the host-networked `e2e` service), publishable key, narrowly consumed secret key, `HI_LOG_PSEUDONYM_KEY`, `HI_INVITATION_DERIVATION_KEY`, application version, and deployment ID
- Database-test env: only the closed no-socket `db-test-bridge` child receives a pipe-delivered direct PostgreSQL URL rebound to `supabase_db_hi:5432`; application, E2E, audit-web, build, and other test targets reject that field
- Local Supabase services retained: PostgreSQL, Auth, Data API, Realtime, Storage, and Mailpit; omit Studio, image proxy, Edge Runtime, and analytics services unless a test later requires one
- Launch-time service settings suppress query/body/header/statement/parameter/value-bearing access logs where the pinned images support it. Pin Mailpit and configure its inspectable quiet/error-safe mode with HTTP/SMTP access and message-detail logging disabled; if the retained version cannot prove those settings, startup refuses. Before every stop/start/reset, remove any prior startup attestation; after launch and before app traffic, the socket-bearing process captures the complete current-boot log window from each retained service's exact Docker `State.StartedAt` through ready (creation through ready for a new container), including Mailpit, compares it in memory against the just-captured generated keys/URLs and generic credential patterns, emits only safe pass/fail codes, and refuses readiness on any leak. On success it atomically writes an ignored mode-0600 `.local/run/supabase-log-attestation.json` containing only project/container IDs, exact `State.StartedAt`, restart counts, pinned configuration digest, safe per-service inclusive log watermark/count, and pass code—never logs, URLs, keys, hashes of keys, or row data. Later request checks reject any live-state mismatch, scan the inclusive attestation-watermark-to-new-cursor gap before sending a request, and only then use that cursor for the request phase; no boot or inter-phase interval may go unscanned

- [ ] **Step 1: Write failing environment, origin, network, and redaction tests**

  Test that public parsing rejects every Supabase credential/endpoint, server parsing rejects missing required values, and `.env.example` contains names with blank values only. Test that only `supabase-tools` has the socket; only `supabase-tools` and `e2e` have host networking; neither is privileged; `supabase-tools` has the effective Docker logging driver `none`; the `e2e` service accepts only mutually exclusive normal-E2E and audit-web commands; all published local-service `HostIp` values are `127.0.0.1`; web/tools/workspace join `hi-supabase`; host-networked targets publish no port; host and E2E browser reach web at the exact `http://127.0.0.1:3000` origin; and start/status wrapper output contains none of the CLI's generated key material. Add adversarial credential-handoff tests: emitter refuses a TTY, a persistent/unknown effective log driver, unknown fields, or unknown target IDs and writes only the versioned allowlist; consumer rejects truncation, duplication, oversize/unknown fields, trailing data, non-pipe stdin, a target mismatch, bridge DNS in a host-networked target, or loopback in a bridge target; `pipefail` propagates either-side failure; attached stdout reaches only the anonymous pipe while `docker logs` and the daemon's configured storage retain nothing; injected canaries and the target-bound URL reach only the intended server child environment and never argv, host/Compose environment, files, logs, status, terminal output, browser configuration, or client chunks. For `db-test-bridge`, prove the emitter securely parses and rebinds the CLI's direct connection URL to `supabase_db_hi:5432`, two independent authenticated sessions reach the expected project/database, and the value is rejected by every other target and never retained or printed. Prove the web server in either `e2e` mode reaches Supabase through `http://127.0.0.1:54321`, while bridge-networked server processes use `http://supabase_kong_hi:8000`. Test the startup-log audit with isolated in-memory/throwaway-container positive leak fixtures that are removed before evidence capture; require each exact current boot's logs from `State.StartedAt` through readiness, exact generated-value and generic-pattern detection, safe failure output, and refusal before web/app traffic. A creation-only or post-ready cursor must fail this test after a restart. Test attestation removal before stop/start/reset plus mode/schema/atomicity; reject stale or mismatched container IDs, `StartedAt`, restart counts, config digest, or watermark, scan the inclusive watermark-to-request-cursor gap, and prove the file contains no log text, URL, key, key-derived value, or fixture identifier.

- [ ] **Step 2: Prove the Linux network topology before locking it**

  Implement and run an executable spike that applies supported log-safe settings before launch, including pinned Mailpit quiet/error-safe settings, starts the socket-bearing one-shot `supabase-tools` service with Linux host networking, effective logging driver `none`, and `SUPABASE_SERVICES_HOSTNAME=127.0.0.1`, then starts fresh Supabase containers on `hi-supabase` without `--ignore-health-check`. Prove an attached synthetic stdout canary traverses an anonymous pipe but is unavailable through `docker logs` and daemon log storage before allowing any credential emission. Before any app request, capture every retained service log from each container's current `StartedAt` through ready and prove in memory that none contains the generated keys/URLs or credential patterns. Then prove CLI post-start health succeeds through host loopback, web reaches Kong through `supabase_kong_hi:8000`, a tools-side two-connection probe reaches `supabase_db_hi:5432`, and the host-networked E2E service reaches loopback web, Auth API, and Mailpit ports. Independently prove with Docker inspection that every published Supabase port is bound only to `127.0.0.1`. On a non-Linux engine or any failed assertion, stop; do not substitute the host-gateway address, use an unproven credential transport, skip the complete startup-log window, weaken Mailpit logging, or disable health checks. Record an alternative in a new superseding ADR, update this plan, and obtain owner approval before proceeding—never rewrite accepted ADR 0002.

- [ ] **Step 3: Implement the proven loopback-only Supabase network**

  Harden `bin/network` so it idempotently creates `hi-supabase` with `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` or rejects incompatible existing options. Configure only `supabase-tools` with both Linux host networking and the socket, plus `SUPABASE_SERVICES_HOSTNAME=127.0.0.1`; E2E has host networking but no socket. Pass `--network-id hi-supabase` to every CLI operation that can start or recreate containers, including start and reset. Apply version-pinned launch-time safe log settings, keep CLI health checks enabled, remove the attestation before any stop/start/reset, and make start/reset withhold readiness until the exact current-boot scan succeeds and writes the safe attestation atomically. After every reset or restart, independently assert network membership, every published `HostIp`, hardened settings, exact IDs/`StartedAt`/restart counts, a fresh matching full-window attestation, and no stale marker.

- [ ] **Step 4: Configure local Auth and redirects**

  Enable email/password and required email confirmation, set the minimum password length to 12, and set the sole local Auth site origin to `http://127.0.0.1:3000`; do not allow wildcard or alternate-host redirects. Retain the pinned, quiet/error-safe Mailpit service with access/message-detail logging disabled and include its settings in the hardened configuration digest. Set `email_sent = 10` per hour, `sign_in_sign_ups = 30` per five minutes, `token_verifications = 30` per five minutes, and `token_refresh = 150` per five minutes. Use API `54321`, database `54322`, and Mailpit `54324`; detect collisions before start. Task 9 replaces default `ConfirmationURL` templates with exact fragment-bearing application links.

- [ ] **Step 5: Capture CLI credentials without displaying them**

  Run `supabase start/status` in machine-readable mode with shell tracing disabled and capture stdout/stderr inside the emitter. Before emitting ready or credentials, assert the emitter container's effective log driver is `none`, use the captured exact key/URL values to scan the complete in-memory startup logs for every exact project container from its current `StartedAt` onward, and fail closed with only a registered service/error code while destroying any isolated red fixture. Emit a fixed sanitized status summary on attached stderr, then send only the target ID, its exact validated bridge-or-loopback server URL, and the target's allowed credential fields as a bounded versioned payload through a non-TTY anonymous stdout pipe. Only `db-test-bridge` may receive the parsed/rebound direct PostgreSQL URL; its consumer verifies the expected project/database and exposes it only to the closed database-test child. The named consumer reads once from stdin, validates target, URL, field set, names, lengths, and completeness, closes the stream, clears its parsing buffer, and spawns the allowlisted child with those values only in child environment. The host wrapper uses a literal fixed pipeline with `pipefail`, no command substitution/redirection, and no debug tracing. Never write generated keys or URLs to a file, shell/Compose environment, argument list, daemon/container log, terminal, browser runtime configuration, or client bundle; if non-persistence cannot be proven on the selected engine, stop and record an approved non-logged IPC alternative. Test both sides with canary values, wrong-network/field targets, persistent-log-driver refusal, and forced mid-stream failures.

- [ ] **Step 6: Implement typed server-only configuration and client**

  Parse public and server environments independently with Zod and parse server values lazily at runtime so production builds need no fake secrets. Mark the Supabase module `server-only`. Use the publishable key and SSR cookies for request-scoped server clients. Do not create a browser data client or expose any Supabase endpoint through application configuration, bundles, or links. Add client-bundle scans for both forbidden key names and injected canary values.

- [ ] **Step 7: Implement local database commands**

  Make start/stop/status/reset/lint/test/type generation deterministic and always target project `hi` plus network `hi-supabase`. `types-check` generates into a temporary path and diffs it against committed `database.types.ts`.

- [ ] **Step 8: Reach green**

  Run `./bin/db start`, `./bin/db status`, `./bin/db reset`, `./bin/db lint`, `./bin/db test`, `./bin/db types`, and `./bin/db types-check`; then run env/redaction/origin/network/startup-log tests and `./bin/build`. Prove both fresh start and reset scan their entire startup log windows before readiness, CLI health works through host loopback, a bridge-networked web process reaches the API through `supabase_kong_hi:8000`, a host-networked E2E web process reaches it through `127.0.0.1:54321`, host/E2E browser page access uses the same `http://127.0.0.1:3000` origin, and no browser chunk, service startup log, or safe wrapper output contains an internal hostname, host URL, or key.

- [ ] **Step 9: Commit and re-index**

  Commit as `chore: add local supabase runtime`. Re-index Codebase Memory and verify ready status.

### Task 5: Add secret injection, scanning, and guarded local recovery

**Files:**
- Create: `scripts/supabase/backup.mjs`
- Create: `scripts/supabase/restore.mjs`
- Create: `scripts/supabase/backup-allowlist.mjs`
- Create: `scripts/supabase/backup-restore.test.mjs`
- Create: `scripts/verify/bws-boundary.mjs`
- Create: `scripts/verify/gitleaks-canary.mjs`
- Create: `scripts/verify/production-image.mjs`
- Create: `scripts/verify/backup-manifest.mjs`
- Create: `scripts/test/run-with-ephemeral-keys.mjs`
- Create: `bin/with-secrets`
- Create: `docs/operations/local-secrets.md`
- Create: `docs/operations/local-recovery.md`
- Modify: `.gitignore`, `Dockerfile`, `compose.yaml`, `package.json`, `bin/dev`, `bin/test`, `bin/db`, `bin/check`, and `docs/development.md`

**Interfaces:**
- `bin/with-secrets` accepts only `dev` and the configured Bitwarden project ID, constructs the fixed bridge-target emitter-to-consumer pipeline, and maps that target to the internal development command in a dedicated no-socket `secrets-runner` attached to `hi-supabase`. `scripts/runtime/consume-supabase-credentials.mjs` is the actual stdin consumer; inside `secrets-runner` it validates the bridge-bound payload, adds the Bitwarden allowlist under `bws run`, and spawns the child. `bin/dev` is the public caller after validated loopback/LAN mode; check, test, build, and arbitrary targets are rejected because raw checks/tests use disposable keys and production builds must never receive runtime secrets
- `bin/test` pipes target-bound CLI-generated credentials into `run-with-ephemeral-keys.mjs` inside the selected no-socket tools/E2E service. That consumer adds independent 32-byte random `HI_LOG_PSEUDONYM_KEY` and `HI_INVITATION_DERIVATION_KEY` values in memory, passes the combined allowlist only to the suite's server child processes (including its colocated E2E web process), then clears buffers/exits. Bridge-networked suites receive only the internal API URL; host-networked E2E receives only loopback. The database suite alone uses `db-test-bridge` and exposes its direct PostgreSQL URL only to the closed TypeScript concurrency-test child, which opens two independent authenticated sessions; all other child modes reject that field. `bin/check` composes those raw test commands and never reads Bitwarden
- M1 backups are data-only and governed by a reviewed registry that classifies every application-owned `public` base table as included in foreign-key-safe order or explicitly excluded with a non-empty reason. Finalization binds that exact registry to one exact migration-set digest; runtime independently recomputes the migration digest and catalogs application-owned public tables, refusing backup/restore on a new/missing/unclassified table, ordering drift, or digest mismatch. Committed migrations recreate public/private schema objects. The registry is deliberately incomplete in this task, extended with the base schema in Task 8, and finalized for the exact M1 migration digest only after invitations exist in Task 11. Any later migration automatically returns it to a refusing state until coverage/order/tests are reviewed and re-finalized. Supabase Auth users/password hashes and full hosted disaster recovery explicitly remain Milestone 5
- Restore targets only the Docker container carrying the expected project/container labels for project `hi`, never an arbitrary loopback URL

- [ ] **Step 1: Write secret-boundary tests first**

  Assert unknown Bitwarden variable names and reserved names such as `PATH`, `NODE_OPTIONS`, `DOCKER_HOST`, and `BWS_ACCESS_TOKEN` are rejected; the server child receives only the exact application allowlist plus the target-bound, pipe-delivered Supabase values; bootstrap tokens never reach it; and no socket-bearing service receives Bitwarden or application secrets. Assert raw `bin/dev` fails closed with a short non-secret message when `BWS_ACCESS_TOKEN` is absent and otherwise constructs exactly the fixed bridge-emitter-to-Bitwarden-consumer pipeline, including the validated LAN flag. Assert every emitter has effective logging driver `none`, attached stdout still feeds the consumer, and its credential canary is unavailable from Docker/daemon logs. Assert `bin/test`/`bin/check` do not inspect Bitwarden, consume credentials only from the anonymous pipe, each suite receives fresh correctly sized application keys only in child environment, E2E web and browser share one suite lifetime, E2E server uses loopback while its browser receives no Supabase URL/key, only the DB concurrency child receives the direct connection URL, and generated values never reach argv, host/Compose environment, files, snapshots, output, or retained artifacts. Open two simultaneous DB sessions and verify distinct backend identities plus the expected local project/database before running a barrier race. Generate a temporary fake credential at test time and require pinned Gitleaks to detect it.

- [ ] **Step 2: Install isolated pinned tools**

  Install `bws` `2.1.0` and the pinned Gitleaks binary/image with checksums in `tools`, never `db-tools` or `runner`. Verify versions and the positive Gitleaks canary before enabling `secret:scan` in `bin/check`.

- [ ] **Step 3: Implement constrained Bitwarden execution**

  Require a project-scoped read-only machine account and explicit project ID. Make `bin/dev` validate arguments, start Supabase through `supabase-tools` before secrets enter scope, and invoke the fixed `dev` target through `bin/with-secrets`; the LAN variant passes only a closed non-secret bind-mode flag. In `bin/with-secrets`, invoke `bws run` in `secrets-runner` with environment inheritance disabled, rebuild a minimal safe environment, accept only `dev`, and validate the injected variable-name set before starting the child. Separately, make the raw test runner generate its two random keys with Node `crypto` inside the container and spawn only the requested closed test command; for E2E it also owns the web child so both share one environment lifetime, and for DB it passes the direct URL only to the concurrency-test subprocess and clears it when that child exits. Never list values, invoke nested Docker, mount the socket, inject secrets into check/build or a non-DB test child, or run arbitrary shell text.

- [ ] **Step 4: Write backup/restore refusal tests**

  Test missing confirmation, wrong Docker labels/project ID, an incomplete/empty table registry, a finalized registry bound to a different migration digest, a new/missing/unclassified application-owned public table, invalid inclusion order, an unexplained exclusion, symlink output paths, permissive file modes, truncated/checksum-mismatched dumps, incompatible manifests, and attempted Auth/full-cluster claims. All refusal paths must leave the database untouched.

- [ ] **Step 5: Implement the limited local backup format**

  Use `umask 077`, an ignored non-symlink `.local/backups/` directory, atomic temporary-file rename, a SHA-256 checksum, and a manifest containing format version, project ID, CLI/PostgreSQL versions, ordered included-table registry, reviewed exclusions/reasons, registry digest, finalized-for migration digest, actual migration-set digest, and timestamp. Before dumping, independently query the catalog and require exact classification of every application-owned public base table plus the reviewed foreign-key-safe order; a migration or schema change fails closed until the registry is re-finalized for its digest. Dump included data only; migrations remain the schema source of truth. Treat any eventual dump as sensitive; ensure the manifest and command output contain no row values, identifiers, or emails. Suppress database credentials and URLs from argv/output, and make the command refuse until the explicit registry is current and finalized. Unit-test serialization, checksum, path/mode, coverage, drift, and data-only command construction with synthetic fixtures here; do not claim a successful application-row backup before its tables exist.

- [ ] **Step 6: Implement guarded local restore**

  Require `--confirm HI_LOCAL_RESTORE`, inspect the exact Supabase container labels/database identity, verify checksum, manifest/registry digests, finalized-for and actual migration digests, live catalog coverage, reviewed exclusions, and exact ordered allowlist before connecting, and run with `ON_ERROR_STOP` in one transaction. Restore only after migrations have recreated the schema. Implement the guarded hook that later tasks use to recreate documented fake Auth users with their original UUIDs, remove only their trigger-created empty profile rows inside the guarded transaction, and restore application rows in registered foreign-key-safe order. Test command construction and every refusal against synthetic artifacts here; Task 8 performs the first real base-row smoke and Task 11 performs the final M1 smoke. Do not claim account/password recovery.

- [ ] **Step 7: Reach green**

  Run `docker compose run --rm tools pnpm verify:bws-boundary`, the dev delegation/missing-token tests, raw test-key lifecycle tests, `docker compose run --rm tools pnpm verify:gitleaks-canary`, `docker compose run --rm tools pnpm secret:scan`, `docker compose run --rm tools pnpm verify:production-image`, and the synthetic backup/restore format plus guarded-refusal tests, then `./bin/test unit` and `./bin/build`. Assert `./bin/test unit` succeeds without Bitwarden, production build receives no runtime key, and real backup/restore commands refuse with the registered incomplete-state code. Inspect the runner for `bws`, Supabase CLI, Gitleaks, browser binaries, dev dependencies, secret canaries, and accidental environment output.

- [ ] **Step 8: Commit and re-index**

  Commit as `chore: add secret and local recovery guardrails`. Re-index Codebase Memory and verify ready status.

### Task 6: Implement safe logging, correlation, health, and readiness

**Files:**
- Create: `apps/web/src/modules/operations/server/log-event.ts`
- Create: `apps/web/src/modules/operations/server/codes.ts`
- Create: `apps/web/src/modules/operations/server/logger.ts`
- Create: `apps/web/src/modules/operations/server/request-context.ts`
- Create: `apps/web/src/modules/operations/server/pseudonymize.ts`
- Create: `apps/web/src/modules/operations/server/diagnostic-id.ts`
- Create: `apps/web/src/modules/operations/server/health.ts`
- Create: `apps/web/src/modules/operations/server/operational-event-store.ts`
- Create: `apps/web/src/modules/operations/server/logger.test.ts`
- Create: `apps/web/src/modules/operations/server/request-context.test.ts`
- Create: `apps/web/src/modules/operations/server/health.test.ts`
- Create: `apps/web/src/modules/operations/server/operational-event-store.test.ts`
- Create: `apps/web/src/proxy.ts`
- Create: `apps/web/src/app/api/health/route.ts`
- Create: `apps/web/src/app/api/readiness/route.ts`
- Create: `apps/web/tests/e2e/service-log-audit.spec.ts`
- Modify: `scripts/supabase/harden-service-logs.mjs`
- Modify: `scripts/verify/service-log-redaction.mjs`
- Create: `bin/verify-service-logs`
- Create: `docs/operations/logging.md`
- Modify: `apps/web/next.config.ts`, `apps/web/package.json`, `pnpm-lock.yaml`, `compose.yaml`, `scripts/supabase/start.mjs`, `scripts/supabase/reset.mjs`, `scripts/verify/no-console.mjs`, `bin/check`, and `docs/development.md`

**Interfaces:**
- For every public request, the root proxy discards any inbound `x-correlation-id` or private context header, generates a new lowercase UUIDv4 correlation ID server-side, forwards it to server code through a replaced private request header, and mirrors the generated value on the response; route/action wrappers initialize `AsyncLocalStorage`, `requireRequestContext()` exposes its branded value, and every server action uses `withActionContext`
- `createLogger({ operation, route, actorId?, householdId? }): AppLogger` accepts registered codes/templates, hashes branded identifiers internally, and exposes only `SafeLogEvent`; Task 6 defines the injectable `OperationalEventSink` contract, while Task 8 supplies its privileged database implementation after the table exists
- `/api/health` proves process liveness; `/api/readiness` reports a boolean dependency summary and diagnostic ID, never URLs, keys, versions of dependencies, or configuration
- Next development incoming/fetch/browser forwarding logs are disabled; the Pino adapter is the only application log path. Extend Task 4's launch/startup-log hardening so the pinned local Kong, GoTrue, PostgREST, PostgreSQL, and Mailpit services omit request query strings, bodies, headers, message details, statement text/parameters, and value-bearing error details while retaining bounded health/service errors. Every start/restart/reset still scans the exact current-boot `StartedAt`-to-ready window before app traffic and fails closed if the hardened configuration cannot be inspected and proven
- `./bin/verify-service-logs` accepts no arguments, starts or validates the hardened Supabase stack, and owns one fixed audit lifecycle. It refuses a pre-existing audit child, starts a background anonymous pipeline from the non-persistently-logged `supabase-tools` emitter to a verifier-owned child of the existing host-networked/no-socket `e2e` service under its closed audit-web command, and binds that payload to the loopback Supabase URL. The consumer validates the payload, generates its pseudonym/invitation keys inside its own process, starts Next on the exact loopback application origin, and remains alive only for this audit. After audit-web health succeeds, a separate one-shot `supabase-tools` invocation runs the socket-bearing scanner concurrently; the scanner receives no Bitwarden/application-key environment. It validates Task 4's attestation against live project/container IDs, exact `StartedAt`, restart counts, and configuration digest; scans the inclusive attestation-watermark-to-current gap; validates the verifier-owned child's exact ID/labels/`StartedAt`; scans that child's complete `StartedAt`-through-health log window; and only then records a common request-phase cursor before any audit request. It executes only the fixed no-argument `service-log-audit` command inside the owned E2E child for browser-required flows, drives remaining successful/failing loopback canaries, waits for that command, and scans every exact Supabase/Mailpit/audit-web log from the cursor through an end cursor before teardown. Later tasks extend that one closed audit spec with auth, household, and invitation flows; a post-hoc cursor never substantiates an earlier test run. The scanner emits only safe per-service pass/fail codes/counts. A trap stops and removes only the verifier-owned web child and waits for the pipeline on success, failure, or interruption. Neither process writes or echoes credentials, raw logs, or canaries. `bin/check` invokes this same public wrapper rather than reimplementing it. This narrowly audited socket use is part of the ADR 0002 exception; ordinary tools and the `e2e` child remain no-socket

- [ ] **Step 1: Write redaction-first tests**

  Fuzz every accepted field with tokens, passwords, emails, UUIDs, URL fragments, raw errors, headers, request bodies, ingredient/diet fields, control characters, invalid codes, and overlong strings. Assert none can enter JSON or pretty output. Test registered operations/routes/errors, HMAC pseudonyms, generated diagnostic IDs, server-generated lowercase UUIDv4 correlation IDs, and context propagation. Supply known user/household UUIDs through both public correlation headers and the private-header name; prove the proxy replaces them, neither supplied value reaches the response/log/sink/audit call, and the newly generated correlation ID is identical across those four destinations. Add positive canary self-tests for both the ordinary no-socket artifact scanner and the fixed socket-bearing service-log scanner, including an isolated audit child that leaks only during startup and must be rejected before request traffic; remove it before the real evidence run. Keep all deliberately leaking log fixtures isolated in memory or uniquely labeled throwaway containers, require teardown before the real stack/evidence run, and reject any fixture label/log in the retained evidence set. Assert the host wrapper accepts no arguments, `bin/check` calls that exact wrapper, the `e2e` service exposes only mutually exclusive normal-test/audit-web commands, the verifier-owned audit child is host-networked/no-socket/non-privileged and receives only loopback-bound Supabase credentials plus its own in-process application keys, the scanner is host-networked/socket-bearing/non-privileged and receives no Bitwarden/application-key environment, exact label selection rejects foreign containers, pre-existing audit children fail closed, every exit removes only the owned child and waits for the pipeline, verified exact-boot/attested-gap scans plus the owned child's validated `StartedAt`-through-health scan precede the common request cursor, the fixed audit command starts only after that cursor and completes before the end cursor/teardown, and failures output only registered code/service/count. Drive raw UUID/email/path/query/body/cookie/JWT canaries through successful and deliberately failing Next, Kong, GoTrue, PostgREST, PostgreSQL, and Mailpit requests against the already-hardened real stack. In an HTTP integration test with an injected in-memory `OperationalEventSink`, prove one readiness failure uses the same generated correlation ID in the response header, JSON log, and sink call, while the diagnostic ID returned by `error()` matches the safe response and event. Real database persistence is deliberately verified only after Task 8 creates the table.

- [ ] **Step 2: Confirm the tests fail**

  Run only the operations suite in `tools` and capture the expected missing-module/type failures.

- [ ] **Step 3: Implement the closed logging adapter**

  Wrap Pino `10.4.0` and an exact pinned Pino-pretty version without exporting raw Pino. Emit one JSON object per line outside development and readable color locally. Validate central code registries at runtime, derive actor/household references with an HMAC key inside `createLogger`, and never accept raw identifiers or actual request paths as event metadata. Set Next `logging` to `false` (including incoming requests, fetch URLs, and browser-console forwarding) and verify both development and production runners emit application events only through the adapter.

- [ ] **Step 4: Implement request and action context**

  In the root proxy, discard every inbound public correlation/private-context header and generate a new lowercase UUIDv4 exactly 36 characters long for each request. Write it to the replaced private context header, mirror it as `x-correlation-id` on the response, and reserve any upstream-ID acceptance for a future authenticated trust boundary. Implement route/action wrappers that initialize `AsyncLocalStorage` from only the proxy-written private header; every route handler/server action obtains the value through `requireRequestContext()`. Do not use global mutable request state. Task 7 must compose localization into this proxy rather than replacing correlation behavior.

- [ ] **Step 5: Implement safe health endpoints**

  Keep liveness independent of Supabase. Readiness calls a narrow dependency adapter with a short timeout and returns only `ok`/`degraded`, correlation ID, and diagnostic ID. Log failures through the abstraction.

- [ ] **Step 6: Enforce the console boundary**

  Update the source verifier so application `console.*` is allowed only inside the logger's transport implementation. Add negative verifier fixtures. Extend the version-pinned, inspectable Task 4 Supabase log hardening before start/reset returns ready: request access logs may retain only fixed service/operation names and status/duration, never URLs/query strings/headers/bodies; Mailpit access/message-detail logs and PostgreSQL statement/parameter/value-bearing error detail logs stay off. Refuse startup if any service cannot prove the setting or the complete current-boot scan. The application uses only fixed-path RPC POSTs for identifier-bearing Data API calls, so safe service paths remain useful without query data.

- [ ] **Step 7: Reach green**

  Run `./bin/test operations` once with local formatting and once with hosted JSON formatting, `docker compose run --rm tools pnpm verify:no-console`, standalone `./bin/verify-service-logs`, the `bin/check` path that calls the same verifier, live health/readiness requests with Supabase healthy and stopped, `docker compose run --rm tools pnpm lint`, `docker compose run --rm tools pnpm typecheck`, and `./bin/build`. The service-log verifier must first reject its isolated startup-leak fixture, then start the real no-socket web child, scan the attested-service gap and the owned child's full `StartedAt`-through-health window, take its common cursor, run the fixed baseline audit command and live success/failure canaries across Next/Kong/GoTrue/PostgREST/PostgreSQL/Mailpit, scan through an end cursor before teardown without printing raw inputs or suppressing the registered Pino health/readiness events, and leave no audit child, message, or credential artifact behind. Document that hosted platform access-log privacy is revalidated before Milestone 5 deployment; M1 mutates no hosted service.

- [ ] **Step 8: Commit and re-index**

  Commit as `feat: add safe operational logging`. Re-index Codebase Memory and verify ready status.

### Task 7: Build the Fresh and Airy mobile PWA shell

**Files:**
- Create: `apps/web/components.json`
- Create: `packages/ui/src/styles/tokens.css`
- Create: `packages/ui/src/lib/cn.ts`
- Create: `packages/ui/src/components/button.tsx`
- Create: `packages/ui/src/components/card.tsx`
- Create: `packages/ui/src/components/sheet.tsx`
- Create: `packages/ui/src/components/bottom-navigation.tsx`
- Create: `packages/ui/src/components/app-shell.tsx`
- Create: `packages/ui/src/components/online-status.tsx`
- Create: `packages/ui/src/components/button.test.tsx`
- Create: `packages/ui/src/components/sheet.test.tsx`
- Create: `packages/ui/src/components/bottom-navigation.test.tsx`
- Create: `packages/ui/src/components/app-shell.test.tsx`
- Create: `packages/ui/src/components/online-status.test.tsx`
- Create: `apps/web/src/i18n/routing.ts`
- Create: `apps/web/src/i18n/request.ts`
- Modify: `apps/web/src/proxy.ts`
- Create: `apps/web/src/messages/en-CA.json`
- Create: `apps/web/src/app/[locale]/layout.tsx`
- Create: `apps/web/src/app/[locale]/page.tsx`
- Create: `apps/web/public/offline.html`
- Create: `scripts/pwa/generate-offline.mjs`
- Create: `apps/web/src/app/manifest.ts`
- Create: `apps/web/src/components/pwa-registration.tsx`
- Create: `apps/web/src/lib/security/response-headers.ts`
- Create: `apps/web/src/lib/security/response-headers.test.ts`
- Create: `apps/web/public/sw.js`
- Create: `apps/web/public/icons/app-icon.svg`
- Create: `apps/web/public/icons/icon-192.png`
- Create: `apps/web/public/icons/icon-512.png`
- Create: `apps/web/public/icons/icon-maskable-512.png`
- Create: `apps/web/tests/component/mobile-shell.test.tsx`
- Create: `apps/web/tests/e2e/pwa-shell.spec.ts`
- Create: `apps/web/tests/e2e/accessibility.spec.ts`
- Create: `apps/web/tests/e2e/visual.spec.ts`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/home-phone-360-linux.png`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/home-phone-390-linux.png`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/home-phone-430-linux.png`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/home-tablet-linux.png`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/home-desktop-linux.png`
- Modify: `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/next.config.ts`, `apps/web/package.json`, `packages/ui/package.json`, `packages/ui/src/index.ts`, `playwright.config.ts`, and `pnpm-lock.yaml`
- Delete: `apps/web/src/app/page.tsx` after the locale-aware entry route replaces it

**Interfaces:**
- `AppShell` receives household identity, member identity, current route, and navigation destinations as typed props; it does not fetch data
- `OnlineStatus` exposes `online`, `offline`, and `reconnecting`; it never queues or marks a mutation successful
- All visible copy originates in `en-CA.json`; the build script deterministically generates the static `/offline.html` fallback from its dedicated offline keys; dates/numbers use locale-aware formatters
- The offline document's first executable element is a fixed, CSP-hashed inline sanitizer that only checks whether a fragment exists and immediately replaces the history entry with the same path/query and no fragment. It never reads the fragment value into application state, storage, output, or telemetry; the page tells users to reopen any private email/invitation link when online

- [ ] **Step 1: Write mobile and accessibility tests first**

  Assert navigation order, semantic landmarks, visible focus, reduced-motion behavior, safe-area classes, 44-pixel targets, no overflow at 360/390/430 widths, and a persistent reconnect message when the browser goes offline.

- [ ] **Step 2: Write PWA safety tests**

  Assert manifest name, icons, theme/background colors, standalone display, and start URL. At runtime on secure localhost, assert Cache Storage contains exactly the public versioned icon allowlist plus the static `/offline.html` fallback; old versions are removed; `sw.js` is served `no-cache`; and every runtime navigation response, `Set-Cookie` response, `/api`, `/auth`, `/invite`, `/h`, Supabase, and non-GET response is absent. With the worker installed and the network offline, navigate separately to `/auth/confirm#<generated-canary>` and `/en-CA/invite#<generated-canary>`; prove the fallback's first script removes the fragment from the visible URL and history before any other offline-page code, neither canary enters a request/log/cache/storage/artifact, and the page instructs the user to reopen the private link online rather than claiming it can retry.

- [ ] **Step 3: Define and verify semantic tokens**

  Create Fresh and Airy tokens for canvas, surface, muted surface, primary teal, text, subdued text, borders, success, warning, danger, focus ring, radii, elevation, and motion. Run automated contrast assertions before wiring components; adjust values until AA passes.

- [ ] **Step 4: Add only the required shadcn-derived sources**

  Add Button, Card, and Sheet sources plus their exact reviewed dependencies. Restyle them through tokens; retain semantics, keyboard behavior, focus management, and reduced-motion support. Add Lucide for shell icons and Motion for one purposeful shell/banner transition that becomes static under `prefers-reduced-motion`. Do not add Recharts or a component bundle.

- [ ] **Step 5: Build the responsive shell and localization boundary**

  Configure next-intl `4.14.9` for `en-CA` with a path strategy ready for `fr-CA`. Build the public welcome shell and reusable authenticated shell. Generate the static offline document from bounded escaped offline keys in `en-CA.json`; place the minimal fragment-discard script before all other executable content, pin its exact CSP SHA-256 hash in the offline response policy, and test that both generated HTML and hash regeneration are clean. Phone uses bottom navigation; larger breakpoints progressively use a sidebar without changing destination semantics. Add CSP, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, a restricted Permissions Policy, and a default strict referrer policy.

- [ ] **Step 6: Add safe online-first PWA behavior**

  Register the minimal service worker only in secure contexts, show an offline/reconnecting banner in the open app, and pre-cache only the static public `/offline.html` fallback alongside approved icons. Use that static response when a navigation fails without storing the navigation request or response. The fallback immediately discards every URL fragment; for private auth/invitation entry paths it deliberately loses the credential and asks the user to reopen the original link online. Do not add Background Sync, mutation persistence, credential recovery, or caching of navigations/household pages. Document `--lan` as trusted-network visual preview only; it makes no installability or account-email-link claim.

- [ ] **Step 7: Reach green and review visually**

  Run `./bin/test component` and `./bin/test e2e` for the axe, manifest, service-worker, secret-fragment offline sanitization, and responsive projects; then run `./bin/build`. Capture approved baseline screenshots at 360, 390, 430, tablet, and desktop widths. Inspect each phone image for bespoke Fresh and Airy styling, thumb reach, virtual-keyboard resilience, and no library-default appearance.

- [ ] **Step 8: Commit and re-index**

  Commit as `feat: add fresh and airy pwa shell`. Re-index Codebase Memory and verify ready status.

### Task 8: Create the household authorization schema and RLS harness

**Files:**
- Create: `packages/domain/src/households/ids.ts`
- Create: `packages/domain/src/households/roles.ts`
- Create: `packages/domain/src/households/context.ts`
- Create: `packages/domain/src/households/ids.test.ts`
- Create: `packages/domain/src/households/roles.test.ts`
- Create: `packages/domain/src/households/context.test.ts`
- Create: `supabase/tests/000_helpers.sql`
- Create: `supabase/tests/010_household_schema.sql`
- Create: `supabase/tests/015_function_acl.sql`
- Create: `supabase/tests/020_household_rls.sql`
- Create: `supabase/tests/030_last_owner.sql`
- Create: `supabase/tests/035_mutation_rate_limits.sql`
- Create: `apps/web/tests/database/household-concurrency.test.ts`
- Create: `apps/web/tests/database/rate-limit-concurrency.test.ts`
- Create: `supabase/migrations/20261009000100_profiles_households.sql`
- Create: `supabase/migrations/20261009000200_household_functions_rls.sql`
- Modify: `supabase/seed.sql`
- Regenerate: `apps/web/src/lib/supabase/database.types.ts`
- Modify: `apps/web/src/modules/operations/server/operational-event-store.ts`
- Modify: `apps/web/src/modules/operations/server/operational-event-store.test.ts`
- Create: `docs/architecture/household-authorization.md`
- Modify: `scripts/supabase/backup-allowlist.mjs`
- Modify: `scripts/supabase/backup-restore.test.mjs`
- Modify: `docs/operations/local-recovery.md`

**Interfaces:**
- Tables: `profiles`, `households`, `household_members`, `audit_events`, and `operational_events`
- Roles: `owner` and `member`; membership states include at least `active` and `inactive`
- Household beta values: currency is constrained to `CAD`, locale is constrained to `en-CA`, and timezone defaults to `America/Toronto`; owners may edit the name and select another valid IANA timezone
- Functions: membership/ownership predicates; fixed-path reads `get_my_profile`, `list_my_households`, `get_household_shell`, and `list_household_members`; mutations `create_household`, `update_household`, `change_household_member_role`, `remove_household_member`, and `leave_household`; plus `purge_expired_operational_events`
- Mutation results: closed outcomes plus nullable entity/version and `retry_after`; private token buckets use the exact stable-interface capacities/refill rates and never accept a caller-supplied actor or scope

- [ ] **Step 1: Write pure domain tests**

  Test branded UUID parsing, supported role transitions, explicit active-context validation, and the rule that no operation may knowingly leave a live household without an active owner. Keep these tests independent of React and Supabase.

- [ ] **Step 2: Write pgTAP tests before migrations**

  Cover UUID keys, UTC timestamps, timezone/currency/locale constraints, create idempotency, owner-only version-checked updates/conflicts, enabled RLS, profile visibility, anonymous denial, non-member denial, inactive-member denial, active-member shared reads, owner-only management, cross-household denial, and complete browser-role denial on audit, operational, and rate-bucket tables; only audited mutation functions may write audit rows and only the narrow server store may write operational rows. Exercise every fixed-path read RPC through POST bodies, prove it derives the user from `auth.uid()`, returns only its declared columns/RLS-visible rows, and exposes no identifier-bearing GET/query alternative to application code. Delete a plain member Auth account and a non-final-owner Auth account successfully: their profile/membership/rate rows disappear while households and audit rows survive with historical account references set null. Prove a final-owner Auth deletion fails atomically. Assert exact token-bucket capacity/refill math, expected-failure consumption, safe retry timestamps, independent scopes/users, and currently authenticated idempotent-replay bypass for create. For every routine, assert exact signature/result type, owner, security mode, search path, schema exposure, and ACL. Prove default function privileges are revoked; the private schema is not Data API-exposed and denies `CREATE`; `anon` has no access; `authenticated` has only `USAGE` and exact safe-predicate execution; and rate/maintenance helpers are not executable by browser roles.

- [ ] **Step 3: Add adversarial owner tests**

  Attempt last-owner account deletion, self-leave, self-demotion, owner removal, and direct table mutation in pgTAP. Contrast those refusals with successful member and non-final-owner account deletions, asserting exact cascade/set-null behavior and preserved household/audit history. For every audited function, reject a non-v4 correlation UUID and prove the exact valid correlation UUID—not its idempotency request ID—lands on the audit row. In `household-concurrency.test.ts`, open two independent PostgreSQL connections behind a barrier, race two ownership mutations, and prove one blocks/fails while the committed household retains an owner. In `rate-limit-concurrency.test.ts`, synchronize more requests than each household/membership bucket allows and prove atomic row locking admits exactly the available permits, returns bounded `rate_limited` results for the rest, and never lets expected failures roll back consumed permits.

- [ ] **Step 4: Confirm database red state**

  Reset the local database and run the pgTAP suite. Confirm failures name the absent tables/functions/policies.

- [ ] **Step 5: Implement schema and invariant**

  Create UUID-keyed tables, closed mutation outcome/composite result types, checks, indexes, update timestamps, and an Auth-user profile trigger. For the tables owned by this task, define every Auth foreign key explicitly: profile, membership, and private rate-bucket rows cascade on account deletion; household creator and audit actor references become null so durable household history survives. Implement one fixed-search-path private token-bucket helper that locks/upserts only the authenticated actor/registered scope, computes continuous refill with bounded numeric math, and returns a permit plus safe retry time; it is never exposed through the Data API. Task 11 applies the reviewed set-null semantics when it creates invitation issuer/acceptor references. Give create operations caller-supplied UUID idempotency keys with scoped unique constraints. Protect ownership with transactional functions that lock the parent household before membership changes plus a deferred database constraint trigger that also covers Auth-driven cascades, so ordinary account deletion and ownership transfer can succeed atomically while direct, concurrent, or cascading attempts cannot commit a live ownerless household.

- [ ] **Step 6: Implement deny-by-default RLS and grants**

  Active members may read their household and member display profiles. Users edit only their own profile. Owners update household settings and manage membership only through functions. Put fixed-search-path, recursion-safe membership predicates and the token-bucket helper in a private schema that is not Data API-exposed. Deny `CREATE` and broad privileges; grant `authenticated` only schema `USAGE` and `EXECUTE` on the exact safe predicates referenced by policies—not the rate helper—with no private access for `anon`. Set default privileges so future functions in exposed schemas grant no execution to `PUBLIC`, `anon`, or `authenticated`; explicitly revoke those roles on every existing invoker- and definer-security routine, fully qualify objects, and grant only exact intended signatures to authenticated or maintenance roles.

- [ ] **Step 7: Add safe audit/operation storage**

  Audit rows contain registered action/target codes, actor/household IDs, correlation ID, and an optional target UUID—never free-form metadata or payloads. Operational rows contain diagnostic/error/operation data, 30-day expiry timestamps, and pseudonymous references; browser roles cannot directly access either table. Implement the Task 6 `OperationalEventSink` contract in `operational-event-store.ts` as an explicit best-effort sink for important errors only; it internally creates the privileged client and exports no reusable bypass client. Repeat the readiness-failure correlation test against the real local table. Add a tested purge function for rows older than 30 days and prevent sink failure from recursively logging to itself. Document that hosted scheduling of this function is activated in Milestone 5.

- [ ] **Step 8: Reach green and regenerate types**

  Classify every Task 8 application-owned public table in foreign-key-safe backup/restore order while leaving the production registry explicitly incomplete until invitations exist. Bind a test-only finalized copy to the exact current migration-set digest, assert its catalog coverage, then create disposable fake Auth users with fixed UUIDs, insert related profile/household/member/audit/operational rows, back them up, reset/replay migrations, recreate those fake Auth users, remove only their trigger-created empty profiles, restore in one transaction, and prove the base rows return while Auth password data, private rate buckets, keys, and raw tokens do not. Add a temporary migration/table and prove the formerly finalized copy refuses until explicitly reclassified and rebound. Then run `./bin/db reset`, `./bin/db lint`, `./bin/test db`, `./bin/test unit`, `./bin/db types`, and `./bin/db types-check`. Review every policy with the role/cross-household matrix in the architecture document and prove normal backup/restore still refuses because the production registry is not final.

- [ ] **Step 9: Commit and re-index**

  Commit as `feat: add household authorization schema`. Re-index Codebase Memory and verify ready status.

### Task 9: Implement email-and-password authentication

**Files:**
- Create: `apps/web/src/lib/supabase/proxy.ts`
- Create: `apps/web/src/lib/supabase/cookie-options.ts`
- Create: `apps/web/src/lib/supabase/cookie-options.test.ts`
- Modify: `apps/web/src/lib/supabase/server.ts`
- Modify: `apps/web/src/proxy.ts`
- Create: `apps/web/src/modules/auth/schemas.ts`
- Create: `apps/web/src/modules/auth/security.server.ts`
- Create: `apps/web/src/modules/auth/actions.ts`
- Create: `apps/web/src/modules/auth/email-token.server.ts`
- Create: `apps/web/src/modules/auth/require-user.server.ts`
- Create: `apps/web/src/modules/auth/components/auth-form.tsx`
- Create: `apps/web/src/modules/auth/components/email-token-consumer.tsx`
- Create: `apps/web/src/modules/auth/schemas.test.ts`
- Create: `apps/web/src/modules/auth/security.server.test.ts`
- Create: `apps/web/src/modules/auth/actions.test.ts`
- Create: `apps/web/src/modules/auth/email-token.server.test.ts`
- Create: `apps/web/src/modules/auth/require-user.server.test.ts`
- Create: `apps/web/src/modules/auth/components/auth-form.test.tsx`
- Create: `apps/web/src/app/[locale]/(auth)/sign-up/page.tsx`
- Create: `apps/web/src/app/[locale]/(auth)/sign-in/page.tsx`
- Create: `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx`
- Create: `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx`
- Create: `apps/web/src/app/[locale]/(auth)/verify-email/page.tsx`
- Create: `apps/web/src/app/auth/confirm/page.tsx`
- Create: `supabase/templates/confirmation.html`
- Create: `supabase/templates/recovery.html`
- Create: `apps/web/tests/e2e/support/mailpit.ts`
- Create: `apps/web/tests/e2e/support/sensitive-navigation.ts`
- Create: `apps/web/tests/e2e/auth.spec.ts`
- Create: `scripts/verify/e2e-sensitive-artifacts.mjs`
- Modify: `scripts/verify/service-log-redaction.mjs`
- Modify: `apps/web/tests/e2e/service-log-audit.spec.ts`
- Modify: `apps/web/tests/e2e/visual.spec.ts`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/sign-in-phone-360-linux.png`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/sign-in-phone-390-linux.png`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/sign-in-phone-430-linux.png`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/sign-in-desktop-linux.png`
- Modify: `apps/web/src/messages/en-CA.json`
- Modify: `apps/web/src/app/[locale]/layout.tsx`
- Modify: `apps/web/src/app/[locale]/page.tsx`
- Modify: `apps/web/package.json`
- Modify: `package.json`
- Modify: `bin/check`
- Modify: `playwright.config.ts`
- Modify: `pnpm-lock.yaml`
- Modify: `supabase/config.toml`

**Interfaces:**
- Server actions: `signUp`, `signIn`, `requestPasswordReset`, `verifyEmailToken`, `updatePassword`, and `signOut`
- `requireUser()` returns a verified authenticated user or performs a safe redirect
- Proxy refreshes SSR cookies and performs only optimistic routing; all real authorization remains in server code and RLS
- Every chunk of the SSR session cookie uses centralized options: `HttpOnly`, `SameSite=Lax`, path `/`, no `Domain`, provider-bounded expiry, and `Secure` iff the validated application origin is HTTPS. Refresh replaces/rotates the cookie set; sign-out expires every chunk. The adapter copies the `cacheHeaders` second argument from `@supabase/ssr` `setAll(cookies, cacheHeaders)` to the actual Next response and strengthens it so any session Set-Cookie response is dynamic with `Cache-Control: private, no-store`, `Pragma: no-cache`, and expired `Expires`. No browser JavaScript client or persisted Playwright `storageState` may read/store the session
- Confirmation/recovery templates emit only `http://127.0.0.1:3000/auth/confirm#token_hash=<hash>&type=<email|recovery>`; the browser omits the fragment from initial document/static-asset requests, and the confirm client clears it at first execution before any app-triggered request or reporting, then sends the hash/type exactly once to `verifyEmailToken`, which validates the closed type and calls server-side `verifyOtp`
- Every Playwright project that authenticates runs with trace, HAR, video, and automatic failure screenshots disabled and never writes `storageState`; reviewed visual PNGs are captured manually only after URLs/forms are clean. Root `verify:e2e-artifacts` scans the normal E2E outputs, while the extended `verify:service-logs` takes its request cursor and then executes equivalent fixed verification/recovery/refresh/sign-out flows in its owned audit child before scanning through the end cursor. Both positively test with temporary confirmation/recovery hashes, JWT-shaped access/refresh credentials, session-cookie values, passwords, and invitation tokens, then reject those canaries, any authenticated-project network artifact/storage-state file, or credential canaries in Next/Kong/GoTrue/PostgREST/PostgreSQL/Mailpit logs

- [ ] **Step 1: Write schema and security tests**

  Cover normalized email, display name, a minimum 12-character password plus confirmation, safe same-origin mutation checks, allowlisted return paths, generic account-disclosure-resistant errors, preserved form values, a closed `email | recovery` verification type, strict token-hash shape/length bounds, and no password/token logging. Unit-test every chunked session cookie: host-only (no `Domain`), `HttpOnly`, `SameSite=Lax`, path `/`, bounded provider expiry, `Secure` for a validated HTTPS origin, and deliberately non-Secure only for exact local HTTP loopback. Test successful refresh rotates/replaces old cookie chunks, revoked/expired refresh clears all chunks, and sign-out emits matching expirations without exposing values to client JavaScript or output. Contract-test the `setAll(cookies, cacheHeaders)` second argument and prove that public, auth, and protected routes all become dynamic with `Cache-Control: private, no-store`, `Pragma: no-cache`, and expired `Expires` whenever they set/refresh/clear any session chunk; the same routes may not enter CDN, browser, Next, or service-worker caches. Add `Referrer-Policy: no-referrer` on every auth/confirm response. Prove any caller-supplied origin/forwarded scheme, cache header, return path, email, user identity, or verification type outside the closed set cannot weaken these options and is ignored or rejected server-side.

- [ ] **Step 2: Write component tests**

  Cover labels, autocomplete attributes, error summaries, focus placement, pending/disabled states, 44-pixel controls, password-manager compatibility, offline refusal, and retry after recoverable errors.

- [ ] **Step 3: Write end-to-end auth tests**

  Run auth/Mailpit tests serially with a unique synthetic recipient scope. Assert no matching message exists at suite start. Fetch each delivered confirmation/recovery message into bounded memory, extract only its `href`, delete that message by ID before returning the link, clear the body buffer, and have the host-networked Playwright browser navigate the link byte-for-byte without hostname, port, or link rewriting. A `try/finally` cleanup queries only the suite recipient scope, deletes any remainder on failure/interruption, and asserts that scope is empty without printing or attaching message bodies. Assert the template produced only the exact `http://127.0.0.1:3000/auth/confirm` origin/path with `token_hash` and closed flow type in the fragment—never a provider `ConfirmationURL`, query parameter, or Supabase URL. Use a `sensitive-navigation` helper that keeps the link out of test titles/attachments and replaces navigation exceptions with a registered safe code before they reach reporter output. Every auth test, including the visually reviewed sign-in project after it authenticates, uses an ephemeral context with trace, HAR, video, automatic failure screenshots, and `storageState` output disabled; manual screenshots occur only on clean token-free screens. Allow the necessary initial document and static-asset loads, but prove their URLs, headers, and bodies omit the fragment/hash and that no app-triggered fetch, action, telemetry, or error report begins before replacement. Then prove exactly one same-origin action request contains the token hash and exactly one server-to-Auth `verifyOtp` POST body receives it. Test register, verify, sign in, cookie flags/JS inaccessibility, revoked/expired session, refresh cookie rotation, sign-out cookie deletion, forgot password, reset password, invalid/expired token, unverified account behavior, email changed after token issuance, repeat submission, and safe return destinations at a 390-pixel viewport. Programmatically assert cookie metadata without attaching or printing values. Confirm the clean URL and same-origin cookies persist as intended and captured in-memory confirmation/session canaries are absent from browser history, Cache Storage, Next/Kong/GoTrue/PostgREST/PostgreSQL/Mailpit logs, reporter output, retained messages, and retained artifacts; the bounded message extraction and live Cookie/Set-Cookie exchange are the explicit transient sources. Add reviewed token-free sign-in baselines at 360, 390, 430, and desktop widths.

- [ ] **Step 4: Confirm red state**

  Run auth unit/component/E2E tests and observe missing routes/actions.

- [ ] **Step 5: Implement SSR session infrastructure**

  Use `@supabase/ssr` `0.12.7` cookie APIs through the centralized cookie adapter. Derive `Secure` only from the validated configured application origin, never forwarded/user headers. Apply the full host-only/HttpOnly/SameSite/path/expiry policy to every chunk on set, refresh, and delete; verify rotation replaces prior credentials and sign-out/revocation expires all chunks. When `setAll` receives cache headers, merge them onto the actual response without weakening them and always enforce the stronger private/no-store/no-cache/expired policy before any Set-Cookie leaves Next; mark that response dynamic even on an otherwise public route. Keep the proxy limited to refresh and optimistic redirects. `requireUser` calls Supabase `auth.getUser()` for server-verified authorization; never authorize from `getSession()` or caller-supplied claims. Never use the secret key for ordinary user auth, expose a browser auth client, or make session credentials readable to Client Components.

- [ ] **Step 6: Implement forms and actions**

  Use React Hook Form/Zod client feedback plus authoritative server parsing. Configure confirmation and recovery templates to use `SiteURL`, `TokenHash`, and a literal closed flow type in fragment-only application links. On `/auth/confirm`, synchronously capture the fragment into component memory and replace the history entry before fetch, Server Action, hydration-side telemetry, or error reporting can run. Submit it once to the same-origin action; validate it again, call server-side `verifyOtp`, rotate/set SSR cookies, discard the hash, and redirect to a clean allowlisted destination. Do not log request bodies, action arguments, URLs, or provider errors. Retain user-entered non-secret fields after recoverable form failure and emit only safe operation logs with diagnostic IDs.

- [ ] **Step 7: Reach green**

  Run `./bin/test component`, `./bin/test e2e` including the auth visual project, `docker compose run --rm tools pnpm verify:e2e-artifacts`, the auth-extended `./bin/verify-service-logs`, `./bin/test operations`, `./bin/test db`, `docker compose run --rm tools pnpm lint`, `docker compose run --rm tools pnpm typecheck`, and `./bin/build`. The artifact scanner checks normal E2E outputs; independently, the service-log verifier takes its cursor first, executes the fixed successful/failed verification, recovery, refresh, and sign-out audit flows inside its owned child, deletes every suite-scoped Mailpit message after extraction and in `finally`, scans Next/Kong/GoTrue/PostgREST/PostgreSQL/Mailpit logs through the end cursor, and only then tears down. Each scanner must first detect temporary generated confirmation, password, JWT-shaped access/refresh, session-cookie, and storage-state canaries. Assert no authenticated project produced trace/HAR/video/automatic-failure images or storage-state files and no suite-scoped Mailpit message remains. For public, auth, and protected routes, force refresh/clear paths and prove every response carrying any session Set-Cookie is dynamic/private/no-store/no-cache/expired and absent from all caches. Inspect each reviewed baseline plus redacted cookie metadata, response headers, URLs, caches, safe verifier results, client bundles, and retained artifacts to confirm the auth experience is intentional and no privileged key, confirmation/recovery hash, session credential, or password appears outside bounded Mailpit-memory extraction, transient action/Next/Auth boundaries, and live Cookie/Set-Cookie boundaries.

- [ ] **Step 8: Commit and re-index**

  Commit as `feat: add email password authentication`. Re-index Codebase Memory and verify ready status.

### Task 10: Add household creation, selection, and explicit route context

**Files:**
- Create: `apps/web/src/modules/households/schemas.ts`
- Create: `apps/web/src/modules/households/queries.server.ts`
- Create: `apps/web/src/modules/households/actions.server.ts`
- Create: `apps/web/src/modules/households/context.server.ts`
- Create: `apps/web/src/modules/households/components/household-form.tsx`
- Create: `apps/web/src/modules/households/components/household-switcher.tsx`
- Create: `apps/web/src/modules/households/components/member-list.tsx`
- Create: `apps/web/src/modules/households/actions.server.test.ts`
- Create: `apps/web/src/modules/households/context.server.test.ts`
- Create: `apps/web/src/modules/households/components/household-form.test.tsx`
- Create: `apps/web/src/modules/households/components/household-switcher.test.tsx`
- Create: `apps/web/src/app/[locale]/households/page.tsx`
- Create: `apps/web/src/app/[locale]/households/new/page.tsx`
- Create: `apps/web/src/app/[locale]/h/[householdId]/layout.tsx`
- Create: `apps/web/src/app/[locale]/h/[householdId]/page.tsx`
- Create: `apps/web/src/app/[locale]/h/[householdId]/add/page.tsx`
- Create: `apps/web/src/app/[locale]/h/[householdId]/inventory/page.tsx`
- Create: `apps/web/src/app/[locale]/h/[householdId]/shopping/page.tsx`
- Create: `apps/web/src/app/[locale]/h/[householdId]/meals/page.tsx`
- Create: `apps/web/src/app/[locale]/h/[householdId]/settings/household/page.tsx`
- Create: `apps/web/tests/e2e/households.spec.ts`
- Modify: `apps/web/tests/e2e/visual.spec.ts`
- Modify: `apps/web/tests/e2e/service-log-audit.spec.ts`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/household-phone-360-linux.png`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/household-phone-390-linux.png`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/household-phone-430-linux.png`
- Create: `apps/web/tests/e2e/visual.spec.ts-snapshots/household-desktop-linux.png`
- Modify: `packages/ui/src/components/app-shell.tsx`
- Modify: `packages/ui/src/components/bottom-navigation.tsx`
- Modify: `apps/web/src/messages/en-CA.json`
- Modify: `apps/web/src/modules/auth/actions.ts`
- Modify: `apps/web/src/app/[locale]/page.tsx`

**Interfaces:**
- `listHouseholdsForCurrentUser()` calls the fixed-path `list_my_households` RPC with no caller identity and returns only active RLS-visible memberships
- `requireHouseholdContext(householdId)` returns verified user ID, household ID, and role
- `createHousehold` uses the transactional database function and redirects to the canonical household URL only when its composite outcome is `succeeded`
- `updateHousehold({ householdId, name, timezone, expectedVersion })` uses optimistic version checking and returns the new version or a typed conflict; both actions map every closed database outcome, including `rate_limited`, to a safe application result

- [ ] **Step 1: Write action/context tests**

  Cover invalid UUID, no membership, inactive membership, owner/member context, zero/one/multiple household routing, Canadian defaults, valid IANA timezone input, create idempotency, update success/version conflict, member update denial, safe duplicate submission, same-origin rejection, cross-household path tampering, and all closed composite outcomes. Prove an exact create replay reauthenticates its actor before bypassing a permit and that no update/ownership result can be replayed after authorization is lost. Prove `rate_limited` preserves safe input, displays a bounded relative retry time derived only from the database result, and never redirects or claims success. Prove actions take the actor and correlation ID only from authenticated request context, pass correlation separately from the idempotency request ID, and reject any caller field that attempts to supply actor, rate scope, retry time, or correlation.

- [ ] **Step 2: Write component tests**

  Cover household form errors, accessible timezone selection, switcher keyboard behavior, role labels, owner-only controls, loading/empty/error states, and preservation of input after validation, conflict, dependency, and rate-limited failures.

- [ ] **Step 3: Write E2E tests**

  In an authenticated project with trace, HAR, video, automatic failure screenshots, and persisted `storageState` disabled, verify a new account creates a household, becomes its owner, updates its name/timezone, receives a visible conflict rather than overwriting a concurrent update, sees the household identity in the shell, creates a second household, switches by URL, and cannot force access to another household ID. With controlled database time, exhaust `household.create` and `household.update` independently and prove the next action returns the friendly rate-limited state with no write/audit-success row; advance refill time and prove recovery. For one successful audited mutation, capture only the action response's safe `x-correlation-id` and prove the same value appears in the structured Next log and resulting audit row. Assert every household response is dynamic and `private, no-store`. Add reviewed populated-household-shell baselines at 360, 390, 430, and desktop widths using sanitized deterministic fixture data; capture PNGs manually after the page URL/form is clean and never serialize its session context.

- [ ] **Step 4: Confirm red state**

  Run targeted unit/component/E2E tests and see missing-context failures.

- [ ] **Step 5: Implement server-first household access**

  Load membership and page data in Server Components through only the fixed-path POST read RPCs. Validate the route ID, authenticate with `getUser()`, and verify membership before rendering; never put a raw user/household identifier in a Data API URL or query string. For mutations, exhaustively switch on the closed composite outcome, validate nullable entity/version/retry fields against that outcome, and render a safe diagnostic or relative retry message without leaking database text. Mark household layouts/pages dynamic and `private, no-store`. Do not authorize from a client store, path string, remembered selection, or `getSession()`.

- [ ] **Step 6: Implement onboarding and switching**

  Send accounts with no household to create one, accounts with one directly to its canonical URL, and accounts with several to an accessible chooser. Switching navigates to another explicit route and rechecks RLS.

- [ ] **Step 7: Mount the real household shell**

  Pass household/member data into `AppShell`. Keep Inventory, Add, Shopping, and Meals as clearly labeled later-milestone placeholders with no fake counts, mutations, or success messages.

- [ ] **Step 8: Reach green**

  Run `./bin/test unit`, `./bin/test db` including token-bucket math/concurrency, `./bin/test component`, `./bin/test e2e` including the household visual project and rate-limit recovery, `docker compose run --rm tools pnpm verify:e2e-artifacts`, the household-extended `./bin/verify-service-logs`, `./bin/test operations`, and `./bin/build`. Assert the normal authenticated projects emitted no network/state artifacts and no generated access/refresh/session or undeclared raw UUID/email canary is retained; the canonical active-household route segment is the explicit reviewed exception. Inspect every new shell baseline. Independently, make the owned service-log audit command repeat household creation/update and cross-household attempts through fixed-path Data API RPC bodies and Next routes after its cursor and before its end scan/teardown; prove Next/Kong/GoTrue/PostgREST/PostgreSQL/Mailpit logs emit no raw identifier outside the canonical browser route boundary.

- [ ] **Step 9: Commit and re-index**

  Commit as `feat: add household onboarding and context`. Re-index Codebase Memory and verify ready status.

### Task 11: Add secure invitations and owner membership management

**Files:**
- Create: `packages/domain/src/households/invitations.ts`
- Create: `packages/domain/src/households/invitations.test.ts`
- Create: `supabase/tests/040_invitation_lifecycle.sql`
- Create: `supabase/tests/050_membership_management.sql`
- Create: `apps/web/tests/database/invitation-concurrency.test.ts`
- Create: `supabase/migrations/20261009000300_household_invitations.sql`
- Create: `supabase/migrations/20261009000400_invitation_membership_functions.sql`
- Create: `apps/web/src/modules/households/invitation-token.server.ts`
- Create: `apps/web/src/modules/households/invitation-actions.server.ts`
- Create: `apps/web/src/modules/households/invitation-actions.server.test.ts`
- Create: `apps/web/src/modules/households/components/invite-member-form.tsx`
- Create: `apps/web/src/modules/households/components/invitation-list.tsx`
- Create: `apps/web/src/modules/households/components/member-actions.tsx`
- Create: `apps/web/src/modules/households/components/invitation-controls.test.tsx`
- Create: `apps/web/src/app/[locale]/invite/page.tsx`
- Create: `apps/web/src/modules/households/components/invite-acceptance.tsx`
- Create: `apps/web/tests/e2e/invitations.spec.ts`
- Modify: `scripts/verify/e2e-sensitive-artifacts.mjs`
- Modify: `scripts/verify/service-log-redaction.mjs`
- Modify: `apps/web/tests/e2e/service-log-audit.spec.ts`
- Modify: `apps/web/src/app/[locale]/h/[householdId]/settings/household/page.tsx`
- Modify: `apps/web/src/messages/en-CA.json`
- Modify: `supabase/seed.sql`
- Regenerate: `apps/web/src/lib/supabase/database.types.ts`
- Modify: `docs/architecture/household-authorization.md`
- Modify: `scripts/supabase/backup-allowlist.mjs`
- Modify: `scripts/supabase/backup-restore.test.mjs`
- Modify: `docs/operations/local-recovery.md`

**Interfaces:**
- Invitation fields: household, invited email, role, token digest, issuer, created/expiry/accepted/revoked timestamps, accepted account, and idempotency key
- Server actions: `createInvitation`, `revokeInvitation`, `acceptInvitation`, `changeMemberRole`, `removeMember`, and `leaveHousehold`
- `deriveInvitationToken({ issuerId, householdId, normalizedEmail, role, requestId }, key)` returns the same 32-byte base64url token for the same canonical tuple and a different token if any tuple field changes; `digestInvitationToken(token)` returns a lowercase 64-character SHA-256 digest
- Invitation lists use only owner-checked `list_household_invitations`; authenticated roles cannot select the base table or recover a digest/idempotency key
- Default invite role is `member`; owners may deliberately invite another owner
- Accepted invitations are terminal: a same-account retry returns the prior household ID without touching membership or role, a different account is rejected, and an owner removal or member leave cannot be reversed by replay
- The raw invitation token may cross only declared transient boundaries: an authorized same-origin creation/replay action response to the owner, the owner's in-memory copy/share fragment value and user-invoked clipboard/share handoff, the recipient's fragment/in-memory value, and one same-origin acceptance-action request. All such responses are `private, no-store`; no trace/HAR/video/storage-state artifact is permitted

- [ ] **Step 1: Write pure expiry and token tests**

  Test the exact seven-day boundary, normalized-email matching, the fixed HMAC test vector, 32-byte base64url token shape, same-input deterministic retry, changed-field separation, valid lowercase digest format, and the rule that raw tokens never enter serializable log/audit events or the mocked Supabase client.

- [ ] **Step 2: Write adversarial pgTAP tests**

  Cover owner creation/safe-list/revoke, member denial, non-member denial, cross-household denial, current verified-email match from `auth.users`, unverified/email-changed account rejection, exact expiry boundary, revocation, one-time use, accepted-by-same-account retry without duplicate or membership mutation, different-account replay rejection, strict lowercase 64-hex digest validation, token-digest uniqueness, duplicate request return for exactly matching fields/digest, duplicate-request conflict for changed data, exact routine ACLs, and 30-day stale-invite purge. After an owner creates an invitation, demote/remove that owner and prove an exact create replay is forbidden before any link is returned or permit bypassed; repeat the current-authorization assertion under a concurrent role change. Remove and, separately, self-leave the accepted member, replay the consumed invitation, and prove the retry returns the prior household ID while membership remains inactive and its role unchanged. For `invitation.create`, `invitation.accept`, and `invitation.revoke`, prove the exact stable token-bucket capacities, continuous-refill math, bounded retry timestamp, per-actor/per-scope isolation, consumption by expected invalid/forbidden/conflict attempts that reach the function, and currently authorized exact-replay bypass. Delete issuer and accepted-account Auth fixtures and prove the invitation/history survives with those references set null while accepted state remains. Direct Data API tests must prove even an owner cannot select the base invitation row, digest, idempotency key, or rate-bucket row and that the list function exposes only its declared summary columns. Task 7's two-connection suite supplies the concurrent transition proof that pgTAP cannot.

- [ ] **Step 3: Write UI and E2E tests**

  In one authenticated project with trace, HAR, video, automatic failure screenshots, and persisted `storageState` disabled, verify an owner creates a member or owner invitation and receives a copy/share link. Assert the only server-to-owner raw-token transport is the successful same-origin creation/replay action response, marked `private, no-store`; simulate the database commit followed by connection loss before response-body emission, retry with the same request ID, and prove the exact same link is delivered without a second row or permit. Changing fields under that ID returns a typed conflict and consumes a permit; demotion/removal before an exact retry returns no token. A signed-out recipient is told to sign in and reopen it; the matching verified account accepts it, a same-account retry returns the prior household unchanged, a different-account replay rejects, and a member cannot expose owner controls. Reuse the safe-navigation helper and clear the fragment before any manual screenshot. Test `private, no-store`/`no-referrer`, fragment removal before submission, and that the raw token crosses only the declared creation-response, user-invoked copy/share fragment/in-memory, recipient fragment/in-memory, and one acceptance-action request boundaries: never an HTTP request URL, referrer, retained history entry, cache, telemetry, reporter output, retained artifact, later request, or Supabase RPC. Exhaust each invitation and membership-management bucket with controlled database time, show a safe relative retry message without false success, then advance refill time and prove recovery. Also cover remove, role change, leave, and every last-owner refusal.

- [ ] **Step 4: Write server-action security tests**

  Directly test create, revoke, accept, role-change, remove, and leave actions for same-origin enforcement, missing/unverified authentication, authoritative server validation, exhaustive closed-outcome mapping, safe error mapping, idempotent same-account retry, and rejection of caller-supplied actor, rate scope/retry time, email-verification, correlation, or household-role claims. Assert every replay reauthenticates and rechecks current authorization before rate bypass or token derivation/return; a former owner gets a generic forbidden result and no raw token. Assert `rate_limited` never redirects or claims success, preserves safe input where applicable, and exposes only a bounded relative retry time. Assert every audited RPC receives the request-context correlation ID, creation sends only the deterministic digest to Supabase and returns the raw token solely in its no-store action result, and acceptance hashes the in-memory raw token before its mocked Supabase call.

- [ ] **Step 5: Confirm red state**

  Run invitation domain/database/component/E2E tests and observe missing schema/functions/UI.

- [ ] **Step 6: Implement digest-only transactional invitations**

  Canonicalize only server-verified invitation fields, validate the random UUIDv4 request ID, derive the opaque token with the server-only HMAC key, hash it with SHA-256, and pass only the digest and normalized invited email to the database. Define issuer and accepted-account Auth foreign keys as nullable with `ON DELETE SET NULL`, preserving the invitation timestamps/state. Set expiry in PostgreSQL rather than trusting a client timestamp. An exact duplicate request returns the existing ID only if every canonical field and digest matches and the authenticated issuer is still an active owner at the locked authorization check; only then may the Next action re-derive and return the same token in a private no-store response. During acceptance, hash the transient raw token immediately in the Next server, discard it, pass only the validated digest and request-context correlation ID to the function, lock the invitation row before testing accepted/revoked/expiry state, recheck verified email and the exact database-time expiry boundary under that lock, and write at most one first-transition membership/acceptance/audit set in one transaction. Branch on accepted state before membership writes: the same accepted account receives the prior household ID unchanged, while every different-account replay rejects; an accepted retry never reactivates or changes a membership. Revoke takes the same row lock so accept versus revoke has one deterministic terminal winner.

- [ ] **Step 7: Implement bounded owner operations**

  Make invitation creation and safe listing owner-only and grant browser roles no base-table invitation access. Reuse the private continuous-refill helper for the exact stable scopes: `invitation.create` at 10/hour, `invitation.accept` at 20/15 minutes, `invitation.revoke` at 30/hour, and shared `membership.manage` at 30/hour for role change/remove/leave. Each function derives its actor/scope internally, consumes before expected validation/authorization, returns the typed `rate_limited` outcome so the bucket update commits, and bypasses consumption only after reauthentication, a locked current-authorization/replay-eligibility check, and proof of an exact idempotent replay. In `invitation-concurrency.test.ts`, use the pipe-delivered DB-test credential and barriers across two independently authenticated connections to race: two same-token acceptances by the matching account; matching-account acceptance against an attacker/different account; acceptance against owner revocation in both lock orders; and acceptance at/beyond the exact controlled expiry boundary. Prove exactly one first transition, membership, and acceptance audit row; the losing/retry outcomes are deterministic and terminal; no replay changes or reactivates membership. Also synchronize more calls than every scope permits to prove row locking admits exactly the available permits, prevents burst oversubscription, isolates actors/scopes, refills continuously, and cannot race a role change into a stale authorized replay. Use safe generic recipient errors. Membership mutation functions must reuse the household lock/last-owner invariant and emit payload-free audit rows.

- [ ] **Step 8: Implement copy/share UX**

  Prefer the Web Share API when available and fall back to clipboard with an accessible confirmation. Put the token after `#`, copy it into in-memory component state, clear the address bar with `history.replaceState` before the network call, and never place it in HTTP URLs, referrers, logs, analytics, screenshot fixtures, invitation lists, or persisted client storage. If the recipient is not already signed in, instruct them to sign in and reopen the private link rather than persisting the bearer token through auth.

- [ ] **Step 9: Add tested invitation retention**

  Implement `purge_stale_household_invitations()` for expired, unaccepted invitations older than 30 days, restrict execution to the maintenance role, and test with controlled database time. Document that the hosted scheduler enabling this function is part of Milestone 5 deployment; no unscheduled-cleanup claim is made in Milestone 1.

- [ ] **Step 10: Reach green and regenerate types**

  Add `household_invitations` to the exact foreign-key-safe registry, prove every application-owned public base table is included or reviewed/excluded, and finalize that exact registry only for the exact M1 migration-set digest. Run the real guarded backup/reset/restore smoke with fixed fake Auth UUIDs plus profiles, households, members, invitations, audit events, and operational events. Prove migrations recreate schema/private objects, trigger-created empty profiles are removed narrowly, application rows and accepted-invitation history return, and Auth passwords, private rate buckets, keys, and raw tokens do not; then add a temporary migration/table and prove backup/restore refuse until registry review/re-finalization. Run `./bin/db reset`, `./bin/db lint`, `./bin/test db`, `./bin/db types`, `./bin/db types-check`, `./bin/test unit`, `./bin/test component`, `./bin/test e2e`, `docker compose run --rm tools pnpm verify:e2e-artifacts`, the invitation-aware `./bin/verify-service-logs`, and `./bin/build`. The public verifier must take its cursor first, then have its fixed audit command create/replay/share/accept/revoke an invitation and exercise membership failures with generated canaries, scan every service through the end cursor, and only then tear down; it may not claim the preceding normal E2E logs. Use invitation and session-credential canaries to prove both scanners' positive paths, normal authenticated projects produce no network/state artifacts, the raw invitation token stays within its declared transient action/share/acceptance boundaries, mocked/observed Supabase RPC payloads contain only its digest, and the owned audit window's Next/Kong/GoTrue/PostgREST/PostgreSQL/Mailpit logs plus retained/build artifacts contain no raw token or session credential before declaring green.

- [ ] **Step 11: Commit and re-index**

  Commit as `feat: add secure household invitations`. Re-index Codebase Memory and verify ready status.

### Task 12: Prove the complete Milestone 1 endpoint and document handoff

**Files:**
- Create: `docs/verification/milestone-1.md`
- Modify: `docs/operations/local-recovery.md`
- Create: `docs/operations/auth-and-household-support.md`
- Modify: `docs/development.md`
- Modify: `docs/architecture/household-authorization.md`
- Modify: `docs/operations/local-secrets.md`
- Modify: `docs/operations/logging.md`
- Modify: `docs/superpowers/plans/2026-10-09-platform-household-shell.md` to check completed steps only as they are evidenced

**Interfaces:**
- Produces: reproducible command transcript, role/access matrix, phone/browser matrix, known limitations, and owner support notes
- Does not deploy, create hosted projects, push, open a PR, or mark later milestones complete

- [ ] **Step 1: Run clean container verification**

  From a clean checkout/worktree with fresh repository-owned volumes, use only Git and Docker commands to build the tools image, install with the frozen lockfile, start/harden Supabase, reset migrations/seed, generate/check types, start the acceptance web process through the disposable-key E2E runner, and build the production image with no runtime secrets. Separately prove interactive `./bin/dev` refuses without `BWS_ACCESS_TOKEN` and delegates only to the dev-only Bitwarden runner when a test double supplies it; do not require or expose a real Bitwarden credential in captured verification evidence.

- [ ] **Step 2: Run the aggregate gate**

  Execute raw `./bin/check` without Bitwarden and capture exact versions, commands, durations, and summarized outcomes without environment values. Prove each test suite creates and destroys its own process-local keys while the build subprocess receives none. The gate must include format, lint, types, boundaries, unit, component, operations, pgTAP, E2E, accessibility, visual, the exact public `./bin/verify-service-logs` lifecycle, secret scan, and production build.

- [ ] **Step 3: Exercise the acceptance journey**

  In an ephemeral authenticated browser project that cannot retain trace/HAR/video/automatic-failure screenshots or `storageState`, at 390 pixels: register and verify Owner A, create Household One, invite Member B, verify/sign in/accept as B, prove B cannot manage membership, create Household Two as A, switch context, prove cross-household access fails, promote B, and prove the final owner still cannot leave or demote. Also exercise recovery, refresh rotation, sign-out cookie deletion, one friendly mutation-rate-limit response, and successful retry after controlled refill without a false success or duplicate write.

- [ ] **Step 4: Verify operational failure paths**

  For a successful audited mutation, prove one correlation ID is identical in the response header, structured Next log, database call, and audit row. With the database/event sink still writable, inject a readiness dependency failure and prove the response, structured log, and persisted operational event share the exact correlation and diagnostic IDs. Separately stop Supabase during a safe request: require the response and structured log to share those IDs, prove best-effort event persistence fails gracefully without recursion or a false stored-event claim, then test offline/reconnect, failed mutation rollback, readiness degradation, and recovery after Supabase returns.

- [ ] **Step 5: Inspect generated artifacts and networking**

  Prove the production container runs non-root; forbidden dev tools and secrets are absent; public Supabase ports are loopback-only; and LAN mode exposes only Next.js. After successful authenticated navigation, API calls, mutations, failed navigation, refresh, sign-out, and offline fallback, inspect Cache Storage directly and prove its keys remain exactly the versioned public icon files plus `/offline.html`, with no authenticated, Set-Cookie, API, Supabase, mutation, or runtime navigation response. Positively test the retained-artifact scanner against normal E2E outputs. Separately invoke the public service-log verifier: after its cursor, its owned closed audit command must replay the exact M1 auth/household/invitation-sensitive flows, delete scoped Mailpit messages, scan Next/Kong/GoTrue/PostgREST/PostgreSQL/Mailpit logs through its end cursor, and tear down only afterward. Scan retained artifacts and sanitized safe outputs for generated raw UUID, email, path/query/body, confirmation/recovery, invitation, JWT access/refresh, and session-cookie canaries. Verify every authenticated project produced no trace/HAR/video/automatic-failure image or `storageState`; permit only reviewed clean manual PNGs, and assert no suite-scoped Mailpit message remains. Prove the client bundle contains no service/secret key and no page overflows at 360–430 pixels.

- [ ] **Step 6: Verify local recovery safely**

  Create a mode-0600 data-only backup only after proving the finalized registry is bound to the exact current migration digest and classifies every application-owned public base table; prove its manifest/output reveal no row data. Then reset locally, replay migrations, recreate the documented fake Auth principals with original UUIDs, restore with the explicit confirmation flag, and prove the scoped public rows return. Add a temporary migration/table and prove both backup and restore refuse the stale registry before cleaning up that fixture. Record that Auth/password recovery, hosted backup scheduling, and the full beta recovery drill remain Milestone 5.

- [ ] **Step 7: Complete handoff documentation**

  Document that interactive startup requires the external `BWS_ACCESS_TOKEN` and uses `./bin/dev`, while raw test/check commands use disposable keys and builds receive none. Also document phone access, Mailpit verification, common auth/invite failures, safe pseudonymous log lookup, local backup/restore, session-cookie boundaries, limitations, and the exact boundary where Milestone 2 begins. Do not write end-user inventory instructions before Inventory exists.

- [ ] **Step 8: Request code review and resolve findings**

  Use `superpowers:requesting-code-review`. Review against the plan's Review Focus, fix findings with tests in follow-up commits only, and re-index after every such commit.

- [ ] **Step 9: Run final verification and commit**

  Re-run `./bin/check` after the last fix. Commit documentation/evidence as `docs: record milestone one verification` without amending. Re-index Codebase Memory and verify the final `HEAD` is ready.

## Milestone 1 Completion Gate

Milestone 1 is complete only when all of the following are true:

- A fresh local setup succeeds with Git and Docker as the only host prerequisites.
- A verified account can create, select, and switch households from the phone-first shell.
- An owner can create a seven-day digest-only invitation, and the matching verified account can accept it exactly once without duplicate membership.
- Database tests prove the complete role and cross-household matrix plus the last-owner invariant.
- Auth registration, verification, sign-in, recovery, reset, refresh, and sign-out pass locally through Mailpit.
- Logs, operational errors, health, and readiness are correlated and demonstrably free of protected content.
- The PWA shell passes mobile, accessibility, offline/reconnect, manifest, safe-area, and production-build checks.
- Local Supabase, secret injection, secret scan, type generation, backup, and guarded restore use documented container commands.
- No hosted system was mutated, no later product capability was implemented, all commits were additive, and Codebase Memory is ready at the final commit.

## Primary Implementation References

- [Next.js App Router documentation](https://nextjs.org/docs/app)
- [Next.js Proxy documentation](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Next.js `NextResponse` documentation](https://nextjs.org/docs/app/api-reference/functions/next-response)
- [Next.js logging configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/logging)
- [Docker host network driver](https://docs.docker.com/engine/network/drivers/host/)
- [Supabase local development](https://supabase.com/docs/guides/local-development)
- [Supabase CLI reference](https://supabase.com/docs/reference/cli)
- [Supabase database testing](https://supabase.com/docs/guides/local-development/cli/testing-and-linting)
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase local email template configuration](https://supabase.com/docs/guides/local-development/customizing-email-templates)
- [Supabase JavaScript `verifyOtp`](https://supabase.com/docs/reference/javascript/auth-verifyotp)
- [Supabase server-side auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database function security](https://supabase.com/docs/guides/database/functions)
- [Bitwarden Secrets Manager CLI](https://bitwarden.com/help/secrets-manager-cli/)
