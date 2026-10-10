# Household Inventory Agent Rules

These rules apply to every agent working in this repository.

## Authority and source of truth

- Platform and system policies always apply.
- Within this project, follow the owner's current request, then the approved design specification, then this file and supporting documentation.
- The approved product and architecture source is `docs/superpowers/specs/2026-10-09-household-food-inventory-design.md`.
- MCP selection, permissions, and setup are documented in `docs/agent-tooling.md`; read it before using an external service.
- Do not silently change approved scope, architecture, security boundaries, or product behavior. Record an intentional change in the specification and its tests.

## Product boundaries

- Build a polished, phone-first household food and spice inventory web application.
- The beta stack is Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Supabase, and Vercel.
- Keep one modular application with clear authentication, household, inventory, shopping, dietary, meals, pricing, and operations boundaries.
- Keep domain rules independent of React and Supabase clients.
- Do not introduce microservices or scaffold a native client until the owner requests executable work for them.
- English is first, but UI copy and formatting must remain localization-ready for Canadian French.

## Local development and containers

- Git and Docker with Docker Compose are the only required host development dependencies.
- Run the application toolchain, package manager, Supabase CLI, tests, builds, database tools, and browser automation inside the repository's containers.
- Global coding-agent clients and their MCP launchers are operator tooling and are exempt from the application-container rule.
- Do not install application dependencies globally on the host.
- Pin dependency and tool versions. Review intentional upgrades and commit the lockfile.
- Once repository commands exist, use the same container-backed entry points locally and in CI.

## Work and Git discipline

- Inspect `git status` before editing. Preserve unrelated and user-authored changes.
- Make small, focused commits with clear messages.
- Never amend, rebase, reset, force-push, squash, or otherwise rewrite existing history unless the owner explicitly asks for that exact operation.
- Record corrections as follow-up commits.
- Local commits are part of normal implementation work. Do not push, create or merge a pull request, delete a branch, publish a release, or change repository settings unless the current request authorizes that external action.
- GitHub MCP writes are available for remote-control work. Availability is not authorization: limit every write to the repository and operation the owner requested.
- Never use destructive filesystem or Git commands against a broad or unresolved path.

## Implementation workflow

- Use the approved specification and the current milestone plan before implementation.
- Use test-driven development for product behavior, bug fixes, domain rules, authorization, and regressions: establish a failing test, implement the smallest passing change, then refactor while green.
- Configuration and documentation changes require executable validation or deterministic assertions, even when a unit test is not appropriate.
- Prefer pure, focused modules and explicit interfaces. Avoid speculative abstractions and dependencies.
- A new dependency requires a concrete product or engineering justification and a review of maintenance, bundle, security, and container impact.
- Use `rg`/`rg --files` for literal and exhaustive repository searches. Use Codebase Memory for structural and impact analysis after the repository is indexed.

## Database, authentication, and authorization

- Define schema, policies, functions, triggers, grants, and seed changes in committed Supabase migrations. Hosted dashboard drift is not accepted.
- A remotely applied migration must first exist in the repository and must be applied exactly as reviewed.
- Scope steady-state Supabase MCP access to this project's `project_ref`. Use only the feature groups needed for the task.
- Direct hosted SQL, migration application, project administration, and Edge Function deployment require explicit authorization in the current request.
- Never enable `skip_elicitations` for Supabase MCP.
- Row-level security denies by default. Test anonymous, non-member, active-member, owner, and cross-household cases.
- Keep service-role credentials server-only. Never expose them to browsers, client bundles, fixtures, or logs.
- Preserve transactional, idempotent behavior for the workflows identified in the specification.

## Security, privacy, and secrets

- Bitwarden Secrets Manager is the source of truth for non-OAuth development secrets. Inject secrets at runtime through the approved container workflow.
- Client-managed OAuth storage is acceptable. PATs and API keys must not be embedded in MCP configuration, repository files, shell history, Docker layers, logs, prompts, or responses.
- Never print or relay secret values. Use variable names and redacted metadata when diagnosing configuration.
- Treat email addresses, dietary information, household inventory, ingredient lists, prices, AI prompts/responses, and identifiers as sensitive.
- Send only sanitized mock data to external design or component-generation services.
- Do not use production credentials or a personal browser profile for browser automation.
- Never weaken a permission, confirmation, RLS, or secret boundary merely to make a test or tool call pass.

## Logging and operations

- Use one server-only logging abstraction: structured JSON in hosted environments and readable colorized output locally.
- Propagate correlation and diagnostic IDs across request, database, and AI boundaries.
- Never log passwords, tokens, email addresses, raw request bodies, ingredient lists, dietary facts, AI prompts, or model responses.
- Do not add ad-hoc production `console.*` calls outside the logging abstraction.
- Test redaction and safe error metadata.
- Keep health and readiness output free of configuration and secret values.

## UI and accessibility

- Design the 360–430 CSS-pixel phone experience first, then progressively enhance tablet and desktop layouts.
- Use semantic design tokens and substantially restyle shadcn/ui; do not ship an unmodified component-library appearance.
- Maintain WCAG 2.2 AA targets, keyboard behavior, visible focus, semantic labeling, reduced motion, safe-area handling, and touch targets of at least 44 by 44 CSS pixels.
- Review every imported registry component for dependencies, accessibility, mobile behavior, and visual consistency.

## Verification and completion

- Run every applicable formatting, lint, type-check, unit, database, component, end-to-end, accessibility, and production-build check through repository-owned container commands.
- Before those commands exist, run all checks available for the files changed and report what could not yet run.
- Read command output and distinguish configured, authenticated, connected, healthy, and authorized states.
- Do not claim a change is complete, passing, deployed, or healthy without current evidence.
- Report exact verification commands, meaningful results, remaining manual steps, and known limitations.
- Never deploy, push, mutate hosted data, or spend money merely as a completion check.

## Documentation

- Keep the specification, migration history, operational runbooks, environment examples, and agent tooling documentation synchronized with behavior.
- Document consequential architectural decisions and security exceptions.
- Keep always-loaded instruction files concise. Put detailed, task-specific procedures in referenced documentation or skills.

## Project-owner additions

<!-- Add durable owner-specific workflow rules below this line. Preserve this section during unrelated edits. -->

- No additional owner rules have been recorded yet.
