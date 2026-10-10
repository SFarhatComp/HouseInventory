# Architecture Decision Records

Use an Architecture Decision Record (ADR) for a consequential choice that affects system structure, security boundaries, data ownership, operational behavior, or a difficult-to-reverse dependency.

## Workflow

1. Copy `template.md` to the next zero-padded number, for example `0001-modular-application-boundaries.md`.
2. Set the status to `Proposed` while the decision is under review.
3. Record the context, chosen decision, alternatives, and consequences.
4. Change the status to `Accepted` only after approval.
5. Never rewrite the substance of an accepted ADR. Correct small factual errors transparently; replace a changed decision with a new ADR and mark the old one `Superseded by ADR-NNNN`.
6. Commit the ADR with the implementation or policy change it governs whenever practical.

Valid statuses are `Proposed`, `Accepted`, `Rejected`, and `Superseded by ADR-NNNN`.
