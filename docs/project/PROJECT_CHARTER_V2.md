# Pokémon Collection V3 — Project Charter v2

## 1. Project identity

**Repository:** `FreDCFR8/Pokemon-Collection`

**Stack:** Vite, React, TypeScript, Supabase and Vercel.

Pokémon Collection V3 is a professional, mobile-first collection manager designed to grow over multiple years without breaking existing functionality. Stability, data integrity, performance, security, maintainability and product quality take priority over delivery speed.

The project is not a quick prototype. Decisions must remain understandable and support multiple profiles, multiple collections, wishlist, trade, analytics, scanning and future catalog enrichment.

## 2. Roles and responsibilities

During development, ChatGPT acts as Technical Lead, Lead Software Architect, Senior Software Engineer, Database Architect, Performance Engineer, Security Architect, Mobile UX Architect, QA Architect, Code Reviewer and Product Architect.

The role includes questioning assumptions, comparing alternatives, guarding architecture and UX consistency, identifying technical debt and preventing regressions. The user remains product owner and final decision-maker.

## 3. Permanent development principles

1. Quality takes priority over speed.
2. `main` remains stable.
3. One branch has one clear purpose.
4. One pull request represents one controlled phase or goal.
5. Architecture analysis precedes implementation.
6. UX analysis precedes implementation for user-facing work.
7. Reuse takes priority over duplication.
8. Data is the source of truth; the UI follows confirmed data.
9. Read-only verification precedes database writes.
10. Database writes use explicit safeguards, post-checks and recoverable behavior.
11. New functionality must not silently weaken security, performance or data integrity.
12. Important architecture, schema, RLS, integration and foundational product decisions are documented.
13. Functional correctness does not by itself mean a feature is product-ready.

## 4. Standard workflow

Every meaningful phase follows this sequence:

1. inspect and analyse the current state;
2. identify architecture, data, security, performance and regression constraints;
3. analyse the intended UX;
4. compare viable alternatives;
5. define a small phase with scope, non-goals and verification;
6. implement through Codex, controlled SQL or direct repository work;
7. open a focused pull request;
8. review architecture, code, data, security and performance;
9. review UX, mobile behavior, desktop behavior and accessibility;
10. apply correction rounds inside the same PR while its purpose remains unchanged;
11. test the Vercel Preview and relevant devices;
12. merge only after technical and UX approval;
13. update durable documentation when required.

Large, multi-purpose or speculative changes are split into smaller phases. Larger product areas are designed and phased before implementation begins.

## 5. Core architecture

### Frontend

The frontend uses Vite, React and TypeScript. It is mobile-first and must remain efficient on iPhone and iPad. The browser renders controlled result sets and must not load or process the complete catalog at once.

### Backend and database

Supabase provides authentication, PostgreSQL, row-level security and application data. Runtime application reads use Supabase as the operational source of truth.

### Hosting and server-side integration

Vercel hosts the application and may run narrowly scoped server-side functions. Secrets and external API keys remain server-side and never enter browser bundles.

## 6. Data ownership and sources of truth

### `profiles`

Represents application profiles and links them to authenticated users.

### `collections`

Represents collection containers owned by profiles. The model supports future multiple collections per profile.

### `cards_catalog`

The central internal catalog describing what a card is. It exists independently from ownership. Stable internal IDs are required so collection links survive metadata updates and source changes.

### `collection_cards`

Represents collection-specific state for a catalog card, including ownership, quantity, condition and status. It is the source of truth for `owned`, `wishlist`, `trade` and `missing` state.

### `sets_catalog`

Represents canonical set metadata. Internal `set_code` values are not product-facing labels.

### `card_external_references`

Links stable internal cards to source-specific identities. One internal card may have multiple external references without replacing its internal ID.

### Legacy

`public.cards` is legacy and is not used for new runtime functionality.

## 7. Collection charter

`cards_catalog` answers: **what is this card?**

`collection_cards` answers: **what is this card's state in this collection?**

Metadata is not duplicated per user. Catalog synchronization never changes collection quantity, condition or status and never breaks active collection links.

Supported collection statuses are:

- `owned`
- `wishlist`
- `trade`
- `missing`

Quantity represents physical copies. Set completion counts unique collected cards according to the approved physical-possession statuses and never increases because quantity is greater than one.

## 8. Catalog and API charter

Normal runtime flow:

```text
external source
→ controlled server-side or local import/synchronization
→ Supabase cards_catalog
→ Sets and global search
→ collection_cards state
```

The browser does not use an external card API as its normal search engine.

Permanent import rules:

- one primary source owns core metadata for an import path;
- secondary sources are validation, fallback or enrichment sources;
- imports are idempotent;
- repeated imports do not create duplicates;
- no automatic catalog deletes;
- internal IDs remain stable;
- existing collection links remain stable;
- imports run in small resumable batches, preferably per set;
- expected and received counts are validated;
- failed sets can be retried independently;
- price data remains separate from stable catalog metadata.

## 9. Architecture and component philosophy

New functionality is designed around clear responsibilities and future reuse.

Before adding UI or services, determine whether:

- an existing component can be extended safely;
- a new component should be shared across Sets, Collection, Wishlist, Trade or Search;
- business rules belong in a service rather than page rendering;
- duplicate state or duplicate mutation logic can be avoided;
- the component has one clear responsibility;
- the design remains understandable when the catalog and feature set grow.

Shared components are introduced deliberately, not speculatively. A component should be extracted when its behavior and reuse boundary are sufficiently understood.

Detailed technical principles live in `ARCHITECTURE_PRINCIPLES.md`.

## 10. UX principles

Pokémon Collection V3 is mobile-first and touch-first.

Permanent UX principles:

- cards are visually more important than metadata;
- use progressive disclosure;
- keep overview screens calm and focused;
- show detail and management controls only when needed;
- maintain consistent actions and status language;
- loading, empty, error, pending and retry states are part of completeness;
- primary actions must be practical with one hand;
- touch targets and focus states must remain accessible;
- desktop behavior is reviewed when relevant, without weakening the mobile experience.

### Navigation philosophy

The standard card flow is:

```text
Sets
→ Binder
→ Card Detail
```

The binder prioritizes card imagery and a subtle presence indicator. Names, numbers, rarity, quantity controls and other metadata belong in card detail unless a later documented product decision changes this.

Card detail is intended to become a shared experience for Sets and Collection and later for Wishlist, Trade and Search. The shared component must be designed in its own controlled phase rather than grown indefinitely inside an unrelated PR.

Detailed UX rules live in `UX_GUIDELINES.md`.

## 11. Performance charter

Performance is a core feature.

Required principles:

- server-side filtering and pagination;
- limited fields per query;
- thumbnails in lists and binders;
- large images only in detail views;
- lazy loading for list images;
- no full-catalog browser downloads;
- no rendering of hundreds or thousands of cards at once;
- indexed search fields;
- no N+1 ownership queries;
- explicit pagination or aggregation for reads that may exceed response limits;
- measurement on real devices for significant screens.

## 12. Database charter

- Schema and RLS changes are architecture changes.
- Risky changes start with read-only diagnostics.
- Data migrations use explicit target counts and stop conditions.
- Writes are transaction-safe where practical.
- Deletes require proof that records are unused and disposable.
- Catalog sync never deletes or mutates active collection data.
- RLS applies least privilege.
- Browser writes are limited to explicit user actions.
- Service-role credentials never appear in frontend code.
- Manual live-database changes are captured in migrations or durable documentation when reproducibility requires it.

## 13. Security charter

- No secret is committed to GitHub.
- External API keys and service-role keys are never exposed to the client.
- RLS is mandatory for user-owned data.
- Ownership follows authenticated user → profile → collection.
- SELECT, INSERT, UPDATE and DELETE permissions are reviewed separately.
- New write paths require review of allowed fields, race behavior and abuse cases.
- Error states do not expose secrets or internal implementation details.

## 14. Codex charter

A Codex assignment must be fully actionable and preserve project context, scope, prohibited changes, acceptance criteria, verification and PR requirements. These requirements may be supplied centrally through `docs/00_CODEX_ENTRYPOINT.md`, `codex/profiles.yaml`, a task template and the PR template; they do not need to be repeated verbatim in every assignment.

Existing PR corrections update the existing branch and PR. Multiple correction rounds are allowed while the original purpose remains intact. Codex output is always reviewed; a passing build alone does not prove runtime, database or UX correctness.

## 15. Pull-request review charter

Every meaningful PR is reviewed for:

- scope discipline;
- architectural consistency;
- database integrity and RLS;
- security;
- performance and scalability;
- mobile UX and desktop UX;
- accessibility;
- race conditions and stale responses;
- regression risk;
- verification evidence;
- documentation impact;
- changed-file accuracy;
- deployment status where applicable.

Technical approval and UX approval are both required for user-facing work.

## 16. Documentation charter

Use:

- this charter for project identity and stable product principles;
- `ARCHITECTURE_PRINCIPLES.md` for timeless technical rules;
- `UX_GUIDELINES.md` for lasting UX rules;
- `PROJECT_STATUS.md` for current operational state;
- `ROADMAP.md` for planned direction;
- `DECISION_LOG.md` for important decisions and their reasons;
- `docs/00_CODEX_ENTRYPOINT.md` as the only fixed entrypoint for Codex assignments;
- `codex/profiles.yaml` and `codex/templates/` for reusable execution requirements;
- `docs/product/FUNCTIONAL_SPECIFICATION.md` for approved functional behavior, users, flows, status and product boundaries;
- specialist documents for detailed architecture, database and integration subjects.

Avoid duplicated documents and repeated decisions.

## 17. Definition of Done

A phase is complete only when all applicable conditions in `AI_WORKING_AGREEMENT.md` are met, including technical review, UX review, applicable build and diff verification, preview testing, relevant device testing, documentation updates and merge. Task profiles may mark checks as not applicable, but must provide a reason.

## 18. Long-term direction

The broad direction remains:

1. reliable full card catalog;
2. set-based browsing and card management;
3. shared card-detail experience;
4. global catalog search and add flow;
5. collection experience improvements;
6. wishlist;
7. trade and missing workflows;
8. analytics, value data and price history;
9. stronger multi-profile and multi-collection support;
10. scanning and assisted identification.

Roadmap order may change after analysis, but data integrity, security, performance and maintainability requirements do not.

## 19. Project memory principle

The repository preserves not only what changed, but why. Future contributors and AI sessions must distinguish intentional architecture from accidental historical state. Decisions are reopened only with new evidence, changed requirements or a clearly better design.