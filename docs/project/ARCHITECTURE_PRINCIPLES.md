# Pokémon Collection V3 — Architecture Principles

This document defines durable technical design principles. Product vision belongs in the charter; current facts belong in project status.

## 1. Architecture before implementation

Before code is written:

- understand the product goal;
- inspect the current repository and data model;
- identify security, performance and regression risks;
- compare alternatives when the choice affects future work;
- define component and service boundaries;
- phase large work into small reviewable steps.

Do not let the first convenient implementation become accidental architecture.

## 2. Stable sources of truth

- Supabase is the runtime application source of truth.
- `cards_catalog` owns card identity and metadata.
- `collection_cards` owns collection-specific state.
- `sets_catalog` owns canonical set metadata.
- `card_external_references` owns source-specific identity links.
- The UI reflects confirmed data and does not invent ownership state.
- `public.cards` remains legacy.

## 3. Stable identity and data integrity

- Internal IDs remain stable.
- External source changes do not replace internal identity.
- Catalog imports do not modify collection state.
- No automatic catalog deletion is allowed.
- Ambiguous matching blocks writes.
- Database constraints and RLS protect invariants in addition to frontend checks.
- Manual database changes are made reproducible when they form part of product behavior.

## 4. Reuse before duplication

Before creating a component, hook or service, inspect whether an existing abstraction can be extended safely.

Prefer:

- shared behavior with clear inputs;
- one mutation service per coherent responsibility;
- reusable presentational components after behavior is understood;
- consistent state and error semantics;
- composition over large page components.

Avoid premature generic abstractions. Extract shared components when at least one real reuse path and a stable responsibility are clear.

## 5. Single responsibility

- Page components coordinate flows rather than contain all business logic.
- Services own database and integration operations.
- Pure helpers own deterministic calculations.
- UI components own presentation and interaction.
- RLS and database constraints own final authorization and data invariants.
- Documentation files each have one defined purpose.

### Centralized derived statistics

- All derived statistics, dashboard totals, comparisons, progress calculations and report insights must originate from one reviewed central service or pure aggregation layer.
- UI components receive already calculated result models and must not independently reproduce business formulas.
- A second calculation path is allowed only after an explicit architecture decision explains why the central path cannot be reused.
- Shared formulas must distinguish source data, filtering rules and aggregation semantics explicitly so Collection, Wishlist, Sets and administrator views cannot drift apart.

## 6. Small controlled changes

- One branch equals one purpose.
- One PR equals one phase or coherent objective.
- Prefer small reversible changes.
- Avoid opportunistic refactors inside feature PRs.
- Multiple corrections may stay in one PR while the purpose remains unchanged.
- A newly emerging goal becomes a separate phase.

## 7. Runtime scale

Assume the catalog will contain many thousands of cards.

- Filter and paginate server-side.
- Select only required columns.
- Explicitly paginate reads that may exceed response limits.
- Avoid N+1 queries.
- Never load the complete catalog into the browser.
- Render bounded result sets.
- Use thumbnails in overviews and large images in detail.
- Add indexes before large-scale search depends on them.

## 8. Secure browser boundaries

- Browser code uses only public configuration and authenticated sessions.
- Service-role and external API secrets stay outside frontend bundles.
- RLS applies least privilege.
- SELECT, INSERT, UPDATE and DELETE are treated as separate permissions.
- Browser writes are triggered by explicit user actions.
- Mutation responses are validated before the UI confirms success.
- Race conditions and stale responses are handled explicitly.

## 9. Safe database evolution

For database work:

1. inspect schema, policies, constraints and counts;
2. run read-only diagnostics;
3. define exact targets and stop conditions;
4. use transactions where practical;
5. verify before/after state;
6. preserve active links and user data;
7. record lasting schema and security decisions.

A successful SQL execution is not sufficient evidence of a correct migration.

## 10. Resilient external integrations

- External card APIs are import, synchronization and enrichment sources only.
- Imports default to dry-run.
- Writes require explicit authorization.
- Work runs in small resumable batches.
- Expected and received counts are compared.
- Retries do not create duplicates.
- External outages do not break normal runtime browsing.
- Price data remains separate from stable card metadata.

## 11. State and concurrency

- Keep one source of truth for each state.
- Use confirmed server results for mutation success.
- Prevent duplicate requests per entity when required.
- Use expected-current-state filters for optimistic concurrency.
- Invalidate stale responses after profile, collection or view-context changes.
- Cleanup from an old request must never remove newer request state.
- Do not claim cancellation after a write may have reached the database.

## 12. Observability and verification

Every phase defines verification before implementation.

Depending on scope, verification includes:

- build and type checks;
- diff and changed-file checks;
- deployment status;
- read-only database checks;
- post-write counts;
- device tests;
- error and retry paths;
- regression checks;
- idempotency or concurrency checks.

## 13. Documentation as architecture memory

The repository records intentional design and its reasons.

- Stable principles are not reconstructed from old chats.
- Current state is kept separate from history.
- Decisions are appended rather than silently rewritten.
- Duplicate documentation is avoided.
- New chats and contributors read the project documents before proposing implementation.

## 14. Quality rule

A solution is not approved merely because it compiles or works once.

It must also be:

- architecturally coherent;
- secure;
- scalable for the expected catalog;
- maintainable;
- testable;
- understandable;
- compatible with the approved UX direction;
- free of known regressions.