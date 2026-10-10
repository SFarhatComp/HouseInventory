# MCP Hardening and Agent Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce MCP permissions and secret exposure, replace legacy connections, and add one version-controlled source of project instructions for coding agents.

**Architecture:** Global MCP clients retain only broadly useful operator integrations with least-privilege defaults. Project behavior is governed by a concise root `AGENTS.md`, imported by Claude through `CLAUDE.md`, while detailed tool routing lives in `docs/agent-tooling.md`.

**Tech Stack:** Codex CLI, Claude Code CLI, Docker, MCP, Markdown, Git

**Spec:** `docs/superpowers/specs/2026-10-09-household-food-inventory-design.md`

## Global Constraints

- Do not display, copy into the repository, or log credential values.
- Preserve a mode-`0600` recovery copy before changing global client configuration.
- Prefer OAuth, minimal toolsets, pinned container images, and explicit authorization for remote writes.
- The application toolchain remains containerized; agent-client MCP configuration may remain global.
- Do not amend or rewrite commits; corrections use follow-up commits.

## Review Focus

- Existing plaintext credentials must not appear in command output, diffs, or repository files.
- Removing a legacy server must leave a recoverable configuration snapshot until credentials are rotated or stored safely.
- GitHub write tools may be available for remote-control work, but project rules must prohibit unrequested pushes, merges, releases, deletions, and history rewrites.
- Supabase bootstrap access must not remain the default daily connection once project-scoped access is possible.
- Rules must distinguish configured, authenticated, healthy, and authorized-to-mutate states.

---

### Task 1: Harden global MCP configuration

**Files:**
- Modify outside repository: `~/.codex/config.toml`
- Modify outside repository: `~/.claude.json`
- Modify outside repository if required: `~/.claude/settings.local.json`
- Create outside repository: mode-`0600` timestamped recovery copies

**Interfaces:**
- Consumes: currently configured Codex and Claude MCP entries
- Produces: least-privilege GitHub MCP, reduced legacy/secret-bearing connections, and a documented temporary Supabase bootstrap boundary

- [ ] **Step 1: Save protected recovery copies without printing their contents**

Run explicit copy and permission commands for the known configuration files. Verify each recovery file exists with mode `0600`.

- [ ] **Step 2: Replace Claude's archived GitHub package**

Remove the user-scoped `github` entry and add GitHub's official Docker image at a pinned version with OAuth callback port `8085` published only to `127.0.0.1`, lockdown mode, and only `context,repos,issues,pull_requests` toolsets. Keep writes available for explicitly requested remote-control work; headless clients may fall back to device-code authorization.

- [ ] **Step 3: Add the same hardened GitHub server to Codex**

Configure the pinned official Docker image with the same non-secret environment and toolset restrictions. Do not enable server-wide read-only mode; project policy supplies the explicit-write guardrail.

- [ ] **Step 4: Remove or deactivate obsolete secret-bearing UI MCP entries**

Remove the legacy Magic/21st entry from active Claude configuration. Deactivate Stitch until its API key is migrated to an approved secret-injection path; retain recovery only in the protected snapshot.

- [ ] **Step 5: Reduce Supabase's steady-state access**

Replace the broad connection with `supabase-bootstrap`, exposing only `docs,account` while no project exists. After project creation, replace it with `supabase-admin`, require `project_ref`, enable only `docs,database,debugging,development,functions`, and keep writes available solely for explicitly requested remote work. Never enable `skip_elicitations`.

- [ ] **Step 6: Pin local stdio MCP packages where a stable version is available**

Replace `@latest` for Next DevTools with the verified current version. Do not introduce a host dependency beyond the existing agent-client runtime.

- [ ] **Step 7: Remove broad implicit GitHub write permission**

Remove any global allow rule for PR creation while preserving unrelated user permissions.

- [ ] **Step 8: Verify configuration without external mutation**

Run sanitized list/get checks, confirm Docker can resolve the pinned image, and perform only read-only smoke tests after restarting clients. Record any OAuth/device-code step that still requires the owner.

### Task 2: Add shared project agent policy

**Files:**
- Create: `AGENTS.md`
- Create: `CLAUDE.md`
- Create: `.claude/settings.json`
- Create: `docs/agent-tooling.md`
- Modify: `docs/superpowers/specs/2026-10-09-household-food-inventory-design.md`

**Interfaces:**
- Consumes: the approved design specification and hardened MCP inventory
- Produces: shared project rules, a Claude import bridge, and detailed MCP routing guidance

- [ ] **Step 1: Add the authoritative root instructions**

Create `AGENTS.md` covering architecture boundaries, container-backed development, Git history policy, TDD, migrations/RLS, secrets/privacy, logging, verification, dependencies, documentation, MCP least privilege, and an extensible project-owner section.

- [ ] **Step 2: Add the Claude bridge**

Create a minimal `CLAUDE.md` that imports `AGENTS.md` with `@AGENTS.md` and duplicates no policy.

- [ ] **Step 3: Document agent tooling and MCP routing**

Create `docs/agent-tooling.md` with purpose, permission boundary, secret handling, health checks, and fallback guidance for each approved or optional tool.

- [ ] **Step 4: Add project-level Claude capability denials**

Create `.claude/settings.json` that disables unrelated infrastructure/browser MCP plugins for this repository and denies high-risk Vercel operations until the owner deliberately changes project settings. Preserve useful documentation and development skills. GitHub remains write-capable but has no auto-allow rule, so its writes still require normal client approval and current-request authority.

- [ ] **Step 5: Correct approved-spec status**

Change the specification status from `Awaiting written-spec review` to `Approved`; do not alter product requirements.

- [ ] **Step 6: Validate instruction files**

Run Markdown hygiene checks available in the repository, search for accidental secret patterns, verify all referenced paths and MCP names, and inspect the final diff.

- [ ] **Step 7: Commit the repository changes**

Create a new focused commit without amending existing history.
