# ADR-0003: Household context, invitations, and PWA privacy

- Status: Accepted
- Date: 2026-10-10
- Deciders: Project owner and implementing agent
- Supersedes: None
- Superseded by: None

## Context

Households are the shared boundary for family members. A member may belong to multiple households, so the app needs explicit navigation context without treating a URL as authorization. Email-provider integration and offline private data would expand the first milestone's operational and security scope.

## Assertions (implementation must prove)

- Household pages use the canonical `/<locale>/h/<householdId>/...` path. The server verifies the signed-in user and household membership/role for every operation; the route identifier is context, never proof of access.
- Invitation tokens are deterministic on exact retries from a server-verified canonical tuple and idempotency key, but changing an input under that key conflicts. Only a SHA-256 digest is stored/sent to Supabase; raw tokens cross only declared transient owner/recipient fragment, in-memory, clipboard/share, and same-origin action boundaries. Invitations are single-use and expire after seven days.
- The invite acceptance route is `private, no-store` with `Referrer-Policy: no-referrer`; it moves the token from `/invite#<token>` into memory and clears the fragment before submitting.
- Account email links target exact loopback confirmation routes for local E2E, with short-lived token hashes and flow type in the fragment only. Fragments are cleared before app-triggered requests.
- In Milestone 1, browser data access is server-mediated; no browser Supabase client or Realtime subscription is allowed without a later review.
- Private/authenticated responses and session-cookie responses are dynamic and `private, no-store`. The service worker may cache only versioned public shell assets and an offline page; never authenticated HTML, API/Supabase responses, or mutations.
- Session credentials persist only in host-only `HttpOnly`, `SameSite=Lax`, path `/` cookies with no `Domain`, bounded lifetime, and `Secure` iff the validated origin is HTTPS. Cookie-setting/refresh/clearing responses also carry `Pragma: no-cache` and expired `Expires`.

## Decision

Use explicit household route context, verified server-side authorization, retry-safe digest-only invitations, and an online-first PWA. Keep authenticated and household data out of persistent offline caches. The app may provide a public shell/offline page, but offline writes or private household snapshots are out of scope.

## Alternatives considered

- Implicit last-selected household stored only in a cookie: less visible and shareable, and risks stale or ambiguous context for multi-household members.
- Treating the household route ID as authorization: simpler routing, but insecure and incompatible with RLS requirements.
- Email-provider invitations: deferred to avoid provider setup; a deliberate copy/share handoff is sufficient for a family beta.
- Browser-side database access/Realtime in the first milestone: reduces server action plumbing but exposes more authorization/cache/session surface before it is needed.
- Offline caching of private data: improves offline utility but creates persistent-data and shared-device privacy risks.

## Consequences

Household IDs are visible in canonical URLs and browser history but are never authorization credentials. Server actions and database RLS remain the authorization authorities. Invite delivery requires the owner to hand off a transient link. The first PWA is online-first; private household state is unavailable offline. Future Realtime, browser clients, email delivery, or private offline data require separate review and updated tests.

## Verification

Tests cover tampered/cross-household routes and membership checks, invitation exact retry/input conflict/digest-only persistence/single-use behavior, exact loopback confirmation URLs and fragment clearing, cookie attributes, response cache headers, and worker allowlisting. E2E must not persist authentication storage state or retain credential-bearing traces/HAR/video.

## Reversal path

Any change to household URL semantics, invitation delivery/token boundaries, browser-side database access, Realtime, or private caching must be proposed in a superseding ADR with a threat review and concrete authorization, privacy, and regression tests.
