# Household Food and Spice Inventory — Design Specification

- **Date:** 2026-10-09
- **Status:** Approved
- **Initial audience:** One Canadian family household
- **Launch model:** Private, non-commercial beta

## 1. Product summary

The product is a polished, phone-first web application that gives a family one shared source of truth for food and spice inventory. It connects four daily needs: knowing what is at home, reducing waste, coordinating shopping, and deciding what to cook.

The family beta validates the complete household loop before any public launch. The system remains product-ready through household isolation, individual accounts, modular domain logic, migration-controlled data, portable containers, and a backend that can serve a later native mobile client.

## 2. Goals and success criteria

The product succeeds when the beta household can:

1. Maintain an accurate shared inventory without burdensome data entry.
2. See what should be used soon and correct any estimated expiry date.
3. Prevent duplicate purchases and move depleted staples into a shared shopping flow.
4. Generate useful meal ideas from available food while respecting declared dietary restrictions.
5. Understand household food spending and an item's purchase-price history.
6. Use every core flow comfortably on a modern phone browser.

The beta is technically successful when household data is isolated by tested database policies, core workflows survive retries and concurrent edits, sensitive data is absent from logs and AI payloads, and the application can run locally with only Git and Docker installed on the host.

## 3. Launch constraints

- Canada is the initial market context.
- Currency is CAD.
- English is the launch language; all interface copy and formatting are localization-ready for later French support.
- The beta is invitation-only and used by the owner's family.
- Hosting should remain at $0 per month where practical.
- Vercel Hobby hosts the non-commercial Next.js beta.
- Supabase Free provides hosted PostgreSQL, authentication, generated APIs, Realtime, and storage.
- Canadian service regions are selected when the free plans expose them. Region selection is a data-location control, not a compliance claim.
- AI usage is on-demand, metered, and protected by a strict spending cap.
- A custom domain is optional and is not required for beta acceptance.

## 4. Scope

### 4.1 Family beta

- Email-and-password registration, verification, sign-in, recovery, and sign-out
- Individual accounts grouped into an invitation-only household
- Owner and member roles
- Manual inventory entry
- Consolidated items backed by separate purchase batches
- Number-plus-unit quantities
- Purchase date, total purchase price, optional notes, and estimated expiry
- Curated food-type matching for average expiry estimates
- Quantity adjustments and a one-tap **Used up** action
- Dashboard-only expiry attention states
- Shared shopping list with household synchronization
- Prompt to add a used-up item to Shopping
- Purchase-to-inventory handoff from Shopping
- Separate dietary and allergy settings for each account
- Dietary-conflict and unknown-information warnings in Shopping and Meals
- AI meal suggestions with a per-request choice between inventory-only and allowing missing ingredients
- Missing meal ingredients added to Shopping on request
- Purchase-price display, household spending totals, and item price history
- Household export and deletion controls
- Structured operational logging, audit history, health checks, and documented backups
- Installable progressive web application shell

### 4.2 Deliberately later

- Barcode scanning
- Receipt and food-photo recognition
- Voice dictation, speech-to-text, and AI text parsing
- Storage locations such as pantry, refrigerator, and freezer
- Browser push, email, and native notifications
- Native iOS or Android clients
- Public registration, billing, subscriptions, or commercial use
- Offline inventory mutations and conflict reconciliation
- Nutritional or medical guarantees

Future capture methods must call the same validated purchase-batch operation as manual entry; they do not receive parallel data models.

## 5. Experience and visual design

### 5.1 Design direction

The approved visual direction is **Fresh and Airy**: modern, slick, bright, and calm. It uses pale mint surfaces, crisp white cards, deep teal text and actions, generous whitespace, restrained shadows, and subtle motion. It must feel bespoke rather than like an unmodified component-library dashboard.

The component foundation is shadcn/ui, but the application owns and restyles its source components through semantic design tokens. Tailwind CSS provides responsive layout and token utilities. Motion for React adds purposeful transitions and feedback while respecting reduced-motion preferences. Lucide provides a consistent icon language.

### 5.2 Mobile-first structure

The phone web experience is the source design. Tablet and desktop layouts progressively expand it; they do not dictate mobile structure.

The primary phone navigation contains:

- Home
- Inventory
- A central Add action
- Shopping
- Meals

Account, household settings, and deeper Insights are accessible from the profile area and contextual dashboard links. Primary touch targets are at least 44 by 44 CSS pixels and important actions remain in comfortable thumb reach.

The approved Home layout is a mobile Command Centre:

1. Household identity and member avatar
2. Prominent manual-add action
3. Use-soon and Shopping summary cards
4. A short prioritized expiry list
5. A meal-planning call to action

Inventory prioritizes search, filter chips, scannable quantities, and expiry state. Manual entry uses a focused, thumb-friendly bottom sheet or full-height sheet depending on viewport and virtual-keyboard space.

### 5.3 Larger breakpoints

Tablet and desktop retain the same priority order while expanding into a sidebar and multi-column Command Centre. The extra space exposes spending summaries and more household activity without changing route semantics.

### 5.4 PWA and accessibility

The beta includes a web manifest, install icons, standalone display support, responsive safe-area handling, and an application shell suitable for home-screen installation. The beta is online-first; loss of connectivity produces a clear reconnect state and never pretends that an unsaved mutation succeeded.

The target is WCAG 2.2 AA for colour contrast, focus behavior, labeling, keyboard operation at larger breakpoints, reduced motion, and screen-reader semantics.

## 6. Core workflows

### 6.1 Onboarding and household access

A user registers with email and password, verifies the address, and either creates a household or accepts a hashed, single-use, expiring invitation. The household stores a name, CAD currency, `en-CA` locale, and a configurable timezone.

Invitations expire after seven days. Only owners invite or remove accounts. A household may have multiple owners but must always retain at least one; the last owner cannot leave, delete their account, or demote themselves until ownership is transferred or the household is deleted. An account may belong to more than one household, and every request carries an explicit active-household context.

All active members can operate shared Inventory, Shopping, and Meals. Each account manages its own dietary profile; the declared restrictions are visible within the household because they affect shared food-safety warnings.

### 6.2 Manual inventory entry

The manual form captures:

- Item name
- Numeric quantity
- Unit
- Purchase date
- Total purchase price in CAD
- Optional notes

Quantity, unit, purchase date, and a non-negative price are required; `$0.00` is a valid price. The name field searches the household's existing items first and the curated food catalog second. A catalog match supplies a food type and average shelf-life rule. For an unmatched name, the user must choose a broad food type or enter an estimated expiry date; the system does not invent a precise match.

Before saving, the form previews the average expiry estimate and explains that it is editable. Saving a known compatible item creates a new purchase batch beneath the existing consolidated item. Saving a new name or an incompatible measurement variant creates the consolidated item and its first batch atomically.

### 6.3 Inventory maintenance

The inventory list shows consolidated remaining quantity, batch count, and nearest estimated expiry. Opening an item reveals its batches, prices, dates, and adjustment history.

A downward consolidated adjustment consumes the batch with the nearest expiry first. **Used up** consumes all remaining batches in one transaction. Both operations record the actor and change in an immutable inventory event. The interface offers undo for ten seconds. Undo appends a compensating event and succeeds only when no later event has changed any affected batch; otherwise it refuses to overwrite newer household work and directs the user to make an explicit adjustment. After **Used up**, the interface asks whether to add the item to Shopping.

### 6.4 Shopping

Shopping entries may originate from direct entry, a used-up item, or missing meal ingredients. Family changes synchronize through Supabase Realtime and degrade to ordinary refresh if Realtime is unavailable.

When an entry is marked purchased, the app opens a prefilled manual-inventory sheet. The user confirms quantity, unit, purchase date, and price before a purchase batch is created. Known dietary conflicts are prominent. When product information is insufficient, the item is marked unverified rather than safe.

Warnings use the curated dietary taxonomy plus item facts explicitly supplied by the household or a verified catalog source. A simple ingredient name may match a known restriction directly; a composite or ambiguous product remains unverified until facts are available. Future barcode and receipt sources may enrich the same fact records but cannot downgrade an unknown or conflict without traceable evidence.

### 6.5 Meals

The user selects participating household members and chooses either:

- Use inventory ingredients only, or
- Allow missing ingredients

The application sends a minimized, structured request to the configured AI provider. Results distinguish available, expiring-soon, missing, conflicting, and unknown ingredients. Missing ingredients may be added to Shopping. Generated results remain suggestions, not medical or food-safety guarantees.

### 6.6 Dashboard and Insights

The dashboard highlights use-soon items, household shopping activity, quick actions, and meal entry points. The first release has no outbound expiry notifications.

Insights derives spending totals from required batch prices and displays item-level price history. Price comparisons always state whether their basis is normalized mass, volume, count, or package.

## 7. Technical architecture

### 7.1 Stack

- Next.js App Router, React, and TypeScript
- Tailwind CSS and shadcn/ui
- Motion for React and Lucide
- React Hook Form and Zod
- next-intl
- Recharts for approved spending and price-history charts
- Supabase PostgreSQL, Auth, Data API, Realtime, and Storage
- Vercel for the private beta web deployment
- Bitwarden Secrets Manager for local-development secrets

Dependencies are pinned in the lockfile and container image. New dependencies require a concrete product or engineering justification.

### 7.2 Modular application

The first release is one modular application, not a collection of microservices. Product capabilities are isolated into authentication, households, inventory, shopping, dietary safety, meals, pricing, and operations modules.

Next.js Server Components load authenticated page data by default. Focused Client Components handle interactive controls. Straightforward operations use typed Supabase access under row-level security. Multi-step, privileged, expensive, or secret-bearing operations use protected server actions, route handlers, or transactional database functions.

Domain rules are independent of React and Supabase clients. Unit conversion, batch consumption, expiry estimation, dietary classification, money calculations, and structured AI validation are pure or narrowly stateful modules with direct tests.

No background worker is required for the beta. Dashboard expiry state is calculated from stored dates at request time. A worker or queue is added only when outbound notifications or heavy asynchronous capture processing enter scope.

### 7.3 Repository layout

```text
apps/
  web/                    Next.js application
  mobile/                 future native-client boundary; no beta implementation
packages/
  domain/                 framework-independent business rules
  ui/                     shared design system
  config/                 TypeScript, lint, test, and formatting configuration
supabase/
  migrations/             versioned schema, policies, functions, and grants
  tests/                  database and row-level-security tests
  seed.sql                deterministic local fixtures
docs/
  superpowers/specs/      approved design specifications
AGENTS.md                 version-controlled project and agent rules
```

The repository uses pnpm workspaces. An empty future-client package is not scaffolded until it has executable work; the directory boundary above documents the intended placement.

## 8. Development, containers, and hosting

### 8.1 Local prerequisites

The host needs only Git and Docker with Docker Compose. Containers provide Node.js, pnpm, Supabase CLI and local services, database tools, linters, type checking, unit and integration runners, Playwright, and browser dependencies.

The repository contains:

- A development `compose.yaml`
- A `.devcontainer/` configuration
- A multi-stage production `Dockerfile`
- Named dependency and database volumes
- Health checks and dependency-aware startup
- Repository commands for development, migrations, tests, builds, logs, backup, and restore

The same container-backed commands run locally and in CI. The production web image remains portable even though the beta deploys to Vercel.

### 8.2 Free-tier production

The family beta uses Vercel Hobby and Supabase Free without paid add-ons. Usage is monitored against both plans. Supabase may pause a low-activity project; this is acceptable for the private beta and is documented for the household owner.

The free plan does not replace an application-owned backup process. A containerized command performs a logical database export, and restore instructions are verified before beta handoff.

Commercial use, public registration, material traffic, stronger uptime needs, or automatic backup requirements trigger a hosting review before launch.

## 9. Secret management

Bitwarden Secrets Manager is the local-development source of truth. Its `bws` CLI is pinned inside the development tools image. A project-scoped, read-only machine account exposes only the secrets needed by this repository.

Secrets are injected into trusted processes at runtime and are never written into Git, Docker layers, client bundles, or logs. `BWS_ACCESS_TOKEN` is the sole bootstrap secret and remains outside the repository. `.env.example` documents names and safe descriptions without values; ignored local environment files are an emergency fallback only.

Vercel and Supabase production secrets live in their encrypted platform stores. Bitwarden remains the authoritative operator copy. Secret scanning runs in local checks and CI.

## 10. Data model

All primary keys are UUIDs. Technical timestamps are stored in UTC. Purchase and expiry values are calendar dates interpreted in the household timezone.

| Entity | Purpose |
|---|---|
| `profiles` | Account display data and localization preferences linked to Supabase Auth |
| `households` | Household name, currency, locale, timezone, and lifecycle state |
| `household_members` | User-to-household membership, owner/member role, and status |
| `household_invitations` | Hashed invitation token, invited email, role, expiry, issuer, and acceptance state |
| `member_dietary_rules` | Per-account allergy or dietary labels and severity/category metadata |
| `food_catalog_entries` | Curated normalized food types, aliases, categories, default units, and matching metadata |
| `food_items` | Household-scoped consolidated item, normalized name, display name, canonical unit, and category |
| `purchase_batches` | Original and remaining quantity, purchase date, price cents, estimated expiry, user override, and creator |
| `inventory_events` | Immutable adjustments, reasons, actor, target batch or item, idempotency key, and undo linkage |
| `shelf_life_rules` | Versioned average shelf-life values by normalized food type |
| `food_dietary_facts` | Household item dietary/allergen tags with source and verification state |
| `shopping_items` | Shared list entry, quantity/unit, source link, status, and purchasing metadata |
| `meal_suggestion_runs` | Minimal request metadata, provider status, cost/usage metadata, and short-lived structured result |
| `saved_meals` | Household-approved generated meal kept for later reuse |
| `audit_events` | Security and business-action audit records without sensitive payloads |
| `operational_events` | Bounded-retention error and health events for beta diagnostics |

Every household-owned row carries or resolves to a `household_id`. Database foreign keys prevent cross-household references.

### 10.1 Quantities and units

Quantities use exact decimal storage, never binary floating point. The beta supports a curated Canadian household unit set covering count/package, mass, and volume. Compatible units normalize to an item's canonical unit.

A consolidated item has one measurement dimension. A purchase in an incompatible dimension does not silently join its total; the entry flow asks for a compatible unit or creates a clearly labeled variant, such as `Milk · litres` and `Milk · cartons`. Counted packages may optionally record package count and net contents. Net contents enable comparison in a mass or volume basis; absent net contents, the app compares price per package only. It never assumes package size, density, or a mass-to-volume conversion.

### 10.2 Purchase batches and price

The inventory total is derived from active batches. Each batch keeps its purchase context even when the consolidated item changes. Price is stored as integer CAD cents for the whole batch. A normalized unit price is shown only when the batch has a compatible normalized quantity; otherwise the basis is explicitly price per count or package.

### 10.3 Expiry estimates

A versioned average shelf-life rule produces an editable estimated date when a batch is created. Catalog entries resolve to item-specific rules before category-level rules. Unmatched names require a category choice or a user-entered estimate. The resulting estimate and rule version are stored on that batch so later rule changes do not rewrite history. The interface labels it as an estimate and shows user corrections distinctly.

Storage location is not collected in the beta, so estimates do not claim location-specific precision.

## 11. Authentication, authorization, and privacy

Supabase Auth handles email/password identity, verification, recovery, sessions, and JWTs. Application authorization is household-based.

Row-level-security policies and grants are defined in migrations and tested for `anon`, authenticated non-member, active member, and owner roles. Policies deny by default. The service-role key never reaches a browser. Views, functions, and storage buckets receive explicit authorization review.

Sensitive and multi-step endpoints use the supported Supabase SSR cookie flow and enforce authentication, explicit household membership, schema validation, same-origin checks on mutations, and rate limits. Invitations are hashed, single-use, valid for seven days, and accepted transactionally.

The application minimizes stored personal data. Household export and deletion are owner-only operations. Deletion requires recent owner reauthentication and typed confirmation, then removes all household-owned records, storage objects, audit events, inventory events, saved meals, and operational events. Immutability applies during the household's lifetime, not after an authorized privacy deletion. Supabase Auth accounts remain independent; an account is deleted separately and cannot be deleted while it is the last owner of a household.

Expired and unused invitation records are removed after 30 days. Unsaved AI meal results are removed after seven days. Saved meals, audit history, inventory history, and purchase history remain until household deletion. Operational events are removed after 30 days. Dietary information is treated as sensitive household data and is never used to promise medical safety.

## 12. AI boundary and dietary safety

AI-provider calls occur only on the server through a replaceable adapter. The browser never receives a provider credential.

The provider receives only what the request needs:

- Normalized ingredient names and usable quantities
- Relevant expiry priority
- Dietary labels for selected participants
- Inventory-only or missing-ingredients mode
- Meal constraints explicitly selected in the request

Names, emails, household identifiers, prices, audit history, and unrelated profile data are excluded.

Model output must satisfy a versioned structured schema before use. Invalid, timed-out, or rate-limited responses produce a recoverable error without affecting Inventory or Shopping. Deterministic post-processing classifies every relevant ingredient as known conflict, no known conflict, or insufficient information. Unknown is never converted to safe. The interface tells users to verify product labels and professional guidance where appropriate.

The beta defaults to at most five meal-generation requests per household per hour and twenty per day. Each request may ask for at most three suggestions and is limited to 6,000 input tokens and 2,000 output tokens. A global provider ledger reserves the maximum estimated cost before dispatch and enforces a hard US$5 calendar-month cap across the beta deployment. Reaching a rate or spending limit disables only AI generation, displays the reset time, and leaves Inventory, Shopping, and saved meals available. Operators may lower these limits through deployment configuration; raising the monthly cap requires an explicit configuration change and redeployment.

## 13. Logging and observability

The server emits structured JSON in hosted environments and human-readable colourized output locally through one server-only logging abstraction. Each request or action carries a correlation ID through Next.js, database operations, and AI adapters.

Standard fields include:

- Timestamp and severity
- Environment, application version, and deployment identifier
- Correlation/request ID
- Route and named operation
- Duration and outcome
- Stable pseudonymous actor and household references when required
- Safe error code and diagnostic identifier

Logs never contain passwords, tokens, email addresses, raw request bodies, ingredient lists, dietary details, AI prompts, or model responses. Redaction behavior is tested.

`audit_events` persists significant household and security actions until household deletion. `operational_events` persists important errors for 30 days for beta diagnostics. Routine hosted logs remain on standard output for platform collection. AI telemetry records provider, model identifier, latency, token usage, estimated cost, and status without payload content.

Health and readiness endpoints report safe dependency state without configuration values. User-facing failures show a diagnostic identifier that maps to operational logs.

## 14. Reliability and error handling

Validation occurs in the form, at the server boundary, and through database constraints. Purchase creation, consolidated adjustment, **Used up**, shopping conversion, invitation acceptance, and undo operations are transactional and idempotent.

Optimistic UI is allowed only when a failed write can visibly roll back. Entered form values survive recoverable errors. Concurrent mutations use transactions and version checks rather than silent last-write-wins behavior.

Realtime is an enhancement, not a correctness dependency. If the subscription disconnects, the interface shows stale/reconnecting state and refreshes authoritative data. An offline phone never reports an inventory mutation as saved.

## 15. Testing strategy

All tests run through the containerized toolchain against local services.

- **Unit:** unit conversion, nearest-expiry-first consumption, expiry estimation, money, dietary classification, and authorization helpers
- **Database:** migrations, grants, row-level-security allow/deny cases, constraints, transactional functions, idempotency, and concurrency
- **Component:** forms, validation, keyboard and touch behavior, loading/empty/error states, and responsive rendering
- **End to end:** registration, invitation, manual entry, batch consolidation, adjustment, **Used up**, Shopping handoff, purchase conversion, meal request, warning states, and Insights
- **Contract:** AI adapter and future capture adapters using deterministic fixtures with no paid calls
- **Visual/accessibility:** phone-first screenshots, tablet/desktop expansion, reduced motion, focus, contrast, and automated accessibility scans
- **Operations:** structured-log schema, redaction, correlation propagation, health checks, secret scanning, backup, and restore

Every change must pass formatting, linting, TypeScript checks, relevant unit/integration/end-to-end tests, and a production build. CI calls the same repository commands used locally.

## 16. Git and agent workflow

The repository starts on `main` with small, focused commits. Existing commits are not amended or otherwise rewritten by default; corrections are recorded as explicit follow-up commits unless the project owner asks for history rewriting. Schema and authorization changes are reviewed as migrations; production dashboard drift is not an accepted schema-management path. The remote Git and CI provider may be selected later because all workflow entry points are repository-owned and provider-portable.

The root `AGENTS.md` establishes:

- Approved architecture and module boundaries
- Container-backed commands
- Test-driven implementation expectations
- Migration and row-level-security discipline
- Secret, privacy, and logging rules
- Dependency and refactoring constraints
- Verification required before completion claims
- Documentation expectations

The file includes a clearly separated project-owner section so additional user rules can be added later. A new rule that changes product behavior or architecture requires a corresponding spec and test review.

## 17. Delivery decomposition

All five milestones below are required for the family beta, but they are planned and executed one at a time so each has a reviewable scope and a working endpoint:

1. **Platform and household shell:** repository, containers, local Supabase, design tokens, mobile PWA shell, authentication, households, invitations, baseline logging, and row-level-security tests
2. **Inventory vertical slice:** curated catalog, manual entry, purchase batches, expiry estimates, adjustments, safe undo, event history, and the inventory-focused Home state
3. **Shopping and Insights:** shared Shopping, Realtime degradation, purchase conversion, spending totals, and item price history
4. **Dietary safety and Meals:** dietary profiles, food safety facts, deterministic warnings, AI adapter, structured meal suggestions, and cost controls
5. **Beta hardening and deployment:** complete operational views, export/deletion, backup/restore, accessibility, visual regression coverage, full end-to-end tests, and free-tier deployment

Each milestone receives its own detailed implementation plan under this master specification and leaves the repository passing its complete applicable verification suite. The first implementation plan covers only Milestone 1.

## 18. Beta acceptance criteria

The family beta is ready when:

1. A verified user can create a household and invite another verified account.
2. An invitation cannot be accepted twice or after its seven-day expiry.
3. Owner/member permission tests prove that only owners manage membership, and the last-owner invariant cannot be violated.
4. Cross-household reads, writes, Realtime subscriptions, functions, views, and storage access fail in automated policy tests.
5. A member can add two compatible purchases of the same item and see one total with two batches; incompatible units never produce a misleading total.
6. Quantity adjustment consumes the nearest estimated expiry first. Undo succeeds only without intervening changes and never overwrites newer work.
7. **Used up** empties the item transactionally and offers to add it to Shopping.
8. A purchased Shopping entry opens a prefilled inventory form and creates exactly one batch under retry.
9. Dashboard expiry state uses an explicit catalog/category rule or user estimate, remains editable, and sends no outbound alerts.
10. Price totals and history reconcile exactly to stored batch prices and label their comparison basis.
11. Members can edit only their own dietary profile, can see household warning-relevant restrictions, and cannot access another household's dietary data.
12. Meal suggestions honor the chosen inventory mode, return validated structured data, and display deterministic conflict or unknown states.
13. AI rate and token ceilings are enforced, the US$5 monthly ledger cannot be exceeded, and reaching a limit leaves non-AI features working.
14. Household export contains the documented household data; confirmed deletion removes household-owned records and prevents further access while leaving unrelated Auth accounts intact.
15. Core phone flows work at 360–430 CSS-pixel widths with accessible touch targets and no horizontal overflow.
16. Local setup succeeds with Git and Docker as the only host prerequisites.
17. Logs correlate a failed request without leaking secrets, household food data, or dietary data, and operational records expire after 30 days.
18. A logical backup can be created and restored using documented container commands.
19. All five delivery milestones are complete and the private beta deploys within the selected free-tier limits.

## 19. References

- [Next.js App Router](https://nextjs.org/docs/app)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase platform regions](https://supabase.com/docs/guides/platform/regions)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Bitwarden Secrets Manager CLI](https://bitwarden.com/help/secrets-manager-cli/)
