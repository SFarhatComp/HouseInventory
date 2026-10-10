# Agent Toolbox Dashboard — Design Specification

- **Date:** 2026-10-09
- **Status:** Awaiting written-spec review
- **Location:** `tools/agent-dashboard/`
- **Audience:** Repository owner

## Purpose

Provide one attractive, phone-friendly view of the MCP servers and skills available across Codex, Claude, and Cursor. The dashboard should explain what each capability does, where it comes from, and whether it is configured, without exposing credentials or changing agent configuration.

This is personal developer tooling and remains separate from the household inventory product.

## Scope

Version one is a read-only static dashboard with a containerized inventory generator.

It will show:

- MCP name, purpose, client, transport, scope, version when detectable, and configured state.
- Whether an MCP is read-only or potentially write-capable.
- Skills with their name, short description, source, and supported client.
- Shared capabilities, client-only capabilities, disabled entries, and deferred tools.
- A last-refreshed timestamp and clear distinction between configured and health-checked states.

It will not:

- Enable, disable, install, remove, authenticate, or invoke MCPs or skills.
- Display tokens, headers, OAuth material, raw configuration, or complete command environments.
- Perform live health checks, network calls, or background polling.
- Become part of the household inventory application.

## Architecture

The tool has two isolated parts:

1. A small Python standard-library generator runs in a container. It reads explicitly mounted configuration and skill directories as read-only inputs and writes a sanitized `inventory.json` snapshot.
2. A static HTML, CSS, and JavaScript frontend reads that snapshot and renders the dashboard. The same container can serve the files with a minimal local HTTP server.

No package-manager dependencies are required for version one. Docker and Git remain the only required host development tools.

The generated snapshot is machine-specific and ignored by Git. Committed fixtures provide safe test data and a useful empty/demo state.

## Data collection and sanitization

Readers are client-specific and allowlist fields rather than copying configuration objects:

- Codex: MCP declarations and installed skill metadata.
- Claude: direct MCP declarations, project plugin state, plugin-provided MCP names, and skill metadata.
- Cursor: MCP declarations when present.
- Shared agent skill directories: `SKILL.md` frontmatter and source package metadata.

The generator may emit only approved metadata such as names, client labels, enabled state, transport type, package/image version, endpoint hostname, and a short purpose. It must strip URL query values except explicitly safe feature names, normalize local paths, and never serialize environment values or headers.

Secret-pattern detection runs against the generated snapshot. Generation fails closed if a suspicious value is found.

## Interface

The visual direction is fresh, airy, modern, and polished, optimized first for 360–430 CSS-pixel screens.

The page contains:

- A compact header with counts for MCPs, skills, clients, and items needing attention.
- Client filters for Codex, Claude, Cursor, and shared capabilities.
- An MCP matrix showing which client has each server.
- MCP cards with state, access level, source, version, purpose, and reason for inclusion.
- A searchable skills catalogue with concise descriptions and provenance.
- Separate disabled and deferred sections so inactive tools are not mistaken for available ones.
- A small legend explaining MCPs, skills, and plugins.

The interface uses semantic HTML, CSS custom properties, visible focus states, reduced-motion support, and touch targets of at least 44 by 44 CSS pixels. JavaScript enhances filtering and search; the inventory remains readable without it.

## Refresh and serving workflow

Repository-owned container commands will provide:

- A refresh command that regenerates the sanitized snapshot.
- A serve command that opens the static dashboard locally.

Serving binds to loopback by default. An explicit LAN mode may bind to `0.0.0.0` for phone access because the served snapshot contains no secrets. The page displays the bind-mode warning and refresh timestamp.

## Failure behavior

- Missing client configuration produces an unavailable-client card, not a failed build.
- A malformed source file identifies the client and file category without printing its contents.
- A possible secret aborts generation and leaves the previous safe snapshot untouched.
- Unknown fields are ignored by default.
- An absent snapshot shows setup instructions rather than a blank or broken page.

## Verification

Tests use committed synthetic fixtures and cover:

- Parsing each supported client shape.
- Deduplicating the same MCP across clients without merging their configuration state.
- Skill discovery and provenance.
- Redaction of headers, environment values, URL secrets, absolute home paths, and token-like strings.
- Failure-closed behavior when a secret pattern is detected.
- Valid snapshot structure and static-page loading.
- Responsive, keyboard, reduced-motion, and basic accessibility behavior.

No test may read or snapshot real credentials.

## Future possibilities

Live health checks, configuration management, install/remove controls, and remote hosting are deliberately deferred. Each would require a separate design because it expands privileges and the attack surface.
