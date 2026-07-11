# Pokémon Collection V3 — Project Charter v2

## 1. Project identity

**Repository:** `FreDCFR8/Pokemon-Collection`

**Stack:** Vite, React, TypeScript, Supabase and Vercel.

Pokémon Collection V3 is a professional, mobile-first collection manager designed to grow over multiple years without breaking existing functionality. Stability, data integrity, performance, security, maintainability and clear product architecture are first-class requirements.

The project is not a quick prototype. Decisions must remain understandable and support future capabilities such as multiple profiles, multiple collections, wishlist, trade, analytics and scanning.

## 2. Roles and responsibilities

During development, ChatGPT acts as:

- Lead Software Architect
- Senior Software Engineer
- Technical Lead
- Database Architect
- Performance Engineer
- Security Architect
- Mobile UX Architect
- QA Architect
- Code Reviewer
- Product Architect

The role is not limited to producing code. It includes questioning assumptions, comparing alternatives, identifying technical debt, guarding architectural consistency and preventing regressions.

## 3. Permanent development principles

1. Quality takes priority over speed.
2. `main` must remain stable.
3. One branch has one clear purpose.
4. One pull request represents one controlled phase or goal.
5. Analysis precedes implementation.
6. Read-only verification precedes database writes.
7. Database writes use explicit safeguards, post-checks and a recoverable approach.
8. New functionality must not silently weaken security, performance or data integrity.
9. Important architecture, schema, RLS, integration and product decisions are documented.
10. Small CSS, copy or isolated UI changes do not require separate architecture documents when the PR description is sufficient.

## 4. Standard workflow

Every meaningful phase follows this sequence:

1. Analyse the current state.
2. Identify constraints and risks.
3. Compare viable alternatives.
4. Make and record the architectural decision.
5. Define a small implementation scope.
6. Prepare a complete Codex assignment when Codex is used.
7. Open a focused pull request.
8. Review architecture, database impact, security, performance, UX and regressions.
9. Test and verify the result.
10. Merge only when the phase is complete.
11. Update living documentation when required.

Large, multi-purpose or speculative changes are split into smaller phases.

## 5. Core architecture

### Frontend

The frontend uses Vite, React and TypeScript. It is mobile-first and must remain efficient on iPhone and iPad. The browser renders controlled result sets; it must not load or process the entire card catalog at once.

### Backend and database

Supabase provides authentication, PostgreSQL, row-level security and application data. Runtime application reads use Supabase as the operational source of truth.

### Hosting and server-side integration

Vercel hosts the application and may run narrowly scoped server-side functions. Secrets and external API keys remain server-side and are never exposed to browser bundles.

## 6. Data ownership and sources of truth

### `profiles`

Represents application profiles and links them to authenticated users.

### `collections`

Represents collection containers owned by profiles. The model must support more than one profile and, later, more than one collection per profile.

### `cards_catalog`

The central internal catalog describing what a card is. It exists independently from ownership. Stable internal IDs are important because collection links must survive metadata updates and external-source changes.

### `collection_cards`

Represents collection-specific state for a catalog card, including ownership, quantity, condition and status. It is the source of truth for owned, wishlist, trade or missing state.

### `sets_catalog`

Represents canonical set metadata. Project `set_code` values are internal identifiers and are not exposed to users as product-facing labels.

### `card_external_references`

Links stable internal cards to source-specific identities. One internal card may have references to multiple external sources without replacing its internal ID.

### Legacy

`public.cards` is legacy and must not be used for new runtime functionality. New functionality uses `profiles`, `collections`, `cards_catalog`, `collection_cards`, `sets_catalog` and `card_external_references`.

## 7. Collection charter

`cards_catalog` answers: **what is this card?**

`collection_cards` answers: **what is this card's state in this collection?**

The same catalog card can be referenced by multiple collections. Card metadata must not be duplicated per user, and ownership must not be stored in the catalog.

Supported status values are:

- `owned`
- `wishlist`
- `trade`
- `missing`

Wishlist is therefore part of the same collection relationship model, not a second card catalog.

Catalog synchronization must never change collection quantity, condition or status and must never break active collection links.

## 8. Catalog and API charter

Normal runtime flow:

```text
external source
→ controlled server-side import or synchronization
→ Supabase cards_catalog
→ Sets and global search
→ collection_cards state
```

The browser never uses an external card API as its normal search engine. External sources are used only for controlled import, synchronization, validation and enrichment.

Permanent rules:

- one primary source owns core metadata for a given import path;
- secondary sources are validation, fallback or enrichment sources;
- imports are idempotent;
- repeated imports must not create duplicates;
- no automatic deletes;
- internal IDs remain stable;
- existing collection links remain stable;
- imports run in small, resumable batches, preferably per set;
- every import validates expected and received counts;
- failed sets can be retried independently;
- price data is managed separately from stable catalog metadata.

## 9. Performance charter

Performance is a core feature, not a later optimization.

Required principles:

- server-side filtering and pagination;
- limited fields per query;
- small thumbnails in result lists;
- large images only in detail views;
- lazy loading for images;
- no full-catalog browser downloads;
- no rendering of hundreds or thousands of cards at once;
- indexed search fields;
- no N+1 query pattern for ownership or wishlist state;
- owned and wishlist information should be returned through efficient joins, views or RPCs;
- measure before and after significant data or rendering changes.

## 10. Database charter

- Schema and RLS changes are treated as architecture changes.
- Risky changes start with read-only diagnostics.
- Data migrations use explicit target counts and stop conditions.
- Writes are transaction-safe where practical.
- Deletes require proof that records are unused and disposable.
- Catalog sync never deletes active collection data.
- RLS applies least privilege.
- Browser writes are limited to explicit user actions.
- Service-role credentials never appear in frontend code.
- Manual live-database changes must be reflected in durable repository documentation or migrations when reproducibility requires it.

## 11. Security charter

- No secret is committed to GitHub.
- External API keys are server-side only.
- Supabase service-role keys are never exposed to the client.
- RLS is mandatory for user-owned data.
- Ownership checks follow authenticated user → profile → collection.
- New write paths require separate review of policy, allowed fields and abuse cases.
- Temporary diagnostics are disabled in production unless explicitly designed as permanent secured endpoints.

## 12. Mobile UX charter

- Mobile-first decisions take priority.
- Primary actions must be reachable and understandable on a phone.
- Long lists require pagination or incremental loading.
- Filters must not create clutter or unnecessary network requests.
- Internal IDs and implementation terminology remain hidden from end users.
- Loading, empty, error and retry states are part of feature completeness.

## 13. Codex charter

A Codex assignment must be fully copyable and include:

- repository and stack;
- current phase and objective;
- relevant architecture and data context;
- exact allowed scope;
- explicit prohibited changes;
- acceptance criteria;
- build and type checks;
- diff and changed-file checks;
- PR title and PR-body requirements;
- instruction to update the current branch rather than create a new PR when revising an existing PR.

Codex output is always reviewed. A passing local build does not prove Vercel Functions, database behavior or runtime integration are correct.

## 14. Pull-request review charter

Every meaningful PR is reviewed for:

- scope discipline;
- architectural consistency;
- database integrity;
- RLS and security;
- performance and scalability;
- mobile UX;
- regression risk;
- test coverage or verification evidence;
- documentation impact;
- changed-file accuracy;
- deployment status where applicable.

A green Vercel deployment is required for changes affecting deployment or server-side functions.

## 15. Documentation charter

Document changes when they alter:

- architecture;
- schema or constraints;
- RLS or security boundaries;
- data invariants;
- external integrations;
- import and synchronization behavior;
- irreversible or foundational product decisions.

Use:

- this charter for stable principles;
- `PROJECT_STATUS.md` for current operational state;
- `DECISION_LOG.md` for the reasons behind important choices;
- detailed architecture and Supabase documents for specialized subjects.

Avoid duplicate documents that repeat the same decision without adding value.

## 16. Definition of Done

A phase is complete only when all applicable conditions are met:

- scope is implemented and no unrelated files changed;
- required build, type and deployment checks pass;
- database post-checks match expected counts;
- security and RLS were reviewed;
- mobile and primary user flow were checked;
- no known regression remains;
- important decisions are documented;
- the PR is reviewable and mergeable;
- the next phase is clearly defined.

## 17. Long-term roadmap principles

The broad direction is:

1. reliable full card catalog;
2. set-based browsing and adding cards;
3. global catalog search and adding cards;
4. wishlist;
5. trade and missing workflows;
6. richer analytics and value data;
7. stronger multi-profile and multi-collection support;
8. scanning and assisted identification.

Roadmap order may change after analysis, but foundational data integrity and performance requirements do not.

## 18. Project memory principle

The repository must preserve not only what was changed, but why. Future contributors and AI sessions must be able to distinguish intentional architecture from accidental historical state. Decisions are not reopened without new evidence, changed requirements or a clearly better design.