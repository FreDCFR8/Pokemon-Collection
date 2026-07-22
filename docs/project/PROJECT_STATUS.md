# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-22_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Current implementation state: Phase 1A identity, access and administration architecture is approved; Phase 1B central auth/profile runtime, product login and logout is the next product implementation phase.**

The earlier Dashboard D2 implementation in PR178 was closed without merge after it removed functional login behavior, hardcoded Lars as active identity and exposed unresolved identity dependencies. Dashboard implementation resumes only after the required identity and role foundations are proven.

Catalog recovery and broad import work are no longer the active product phase. Remaining catalog exceptions and maintenance stay separately controlled, evidence-first and write-blocked unless a dedicated reviewed phase explicitly authorizes otherwise.

## Verified repository position

- Current `main`: merge commit `e0f6d220a995dc0b370c2acbe414b1626fc628e2` (PR180).
- PR180 introduced Codex Workflow v2 with one central entrypoint, reusable YAML profiles and templates, a PR template and a documentation audit.
- PR179 approved the complete Phase 1A identity, access, administrator, settings and logging architecture contract.
- PR178 is closed and unmerged.
- PR177 remains the initial Dashboard D1 visual and product reference, but its implementation sequence is superseded by the Phase 1A dependency order.
- PR176 added the central functional product specification.
- The repository contains production application code and controlled catalog-import tooling; Phase 0/Blueprint wording is historical only.

## Current product implementation order

The approved identity and product sequence is:

1. **Phase 1B — next:** central reactive auth/profile runtime, product login and logout;
2. **Phase 1C:** trusted role source, role migration and child/admin RLS;
3. **Phase 1D:** protected administrator shell;
4. **Phase 1E:** approved user and profile settings;
5. **Phase 1F:** trusted product activity foundation;
6. **Phase 1G:** administrator activity view and safe operational status;
7. **Phase 1H:** restart the child dashboard on the proven identity foundation.

Approved account model:

- Lars has a separate authenticated account linked to exactly one Lars profile;
- Lore has a separate authenticated account linked to exactly one Lore profile;
- the parent uses a separate administrator account;
- child accounts cannot switch between child profiles;
- guest access is outside the current scope;
- authorization must be enforced server-side and never by hidden UI alone.

## Current operational catalog scope

The following catalog state is retained from approved run evidence. Any future database write must begin with fresh read-only evidence and a separately approved write scope:

- local source: `PokemonTCG/pokemon-tcg-data`;
- pinned dataset commit: `0af6250a22495e4a3e9f60ff45fc3fedc2e0563d`;
- complete dataset profile: 173 sets and 20,324 cards;
- 39 sets were processed through Batches 1–3 with completed write and idempotency evidence;
- 117 set-catalog mappings were recovered without changing existing rows;
- 116 additional sets / 10,703 cards were imported with 10,703 `pokemon_tcg_api` references;
- the 116-set scope passed direct idempotency with `databaseWritesTotal=0`;
- 155 sets have completed controlled card-import coverage;
- later guarded maintenance added the proven SVP recovery path and complete-set card-detail backfill tooling;
- catalog aliases such as `sv4pt5 → sv45` must resolve only through proven unique identity evidence and remain fail-closed when ambiguous.

Historical aggregate values are not current database totals unless reconfirmed through a new read-only audit.

## Historical read-only baseline — 2026-07-20

The local pinned dataset and Supabase were remeasured without writes before the later recovery and import phases.

- report hash: `30c9044a0f52b7dba0cb164cff99ce8fbd2f8d14ca1ce7c75b1a03b60ab51288`;
- analysis hash: `dd8391f56de294adb8e47d5a56d3d770c335a8ca7fffbfd907f08bb072cf2d6e`;
- manifest hash: `c5604ffa39e017e08eca089770bce82a786b1b20ebb45ee9bc0d6d22db3b6ab3`;
- dataset profile: 173/173 sets and 20,324/20,324 cards;
- classification: 39 `PASS`, 132 `BLOCKED`, 2 `NEEDS_MANUAL_REVIEW`;
- protected table snapshot before and after was unchanged;
- `databaseWritesTotal: 0`.

This baseline remains historical evidence for the original classification. It must not be treated as the current database snapshot.

## Source-of-truth order

1. current code and tests on `main`;
2. merged pull requests;
3. current read-only Supabase evidence;
4. explicit operational evidence approved by the project owner;
5. older reports and conversation history only as context.

## Current architecture baseline

```text
authenticated user
→ exactly one permitted profile context
→ collection
→ collection_cards
→ cards_catalog
→ sets_catalog
```

External card APIs are controlled import and synchronization sources only. Supabase is the runtime source of truth.

Core invariants:

- `cards_catalog` stores card identity and metadata;
- `collection_cards` stores collection-specific state;
- internal catalog IDs remain stable;
- catalog imports never change `collection_cards`;
- `public.cards` remains legacy;
- browser reads remain filtered, paginated and limited;
- browser writes are explicit user actions protected by RLS and database constraints;
- active identity is never hardcoded in product UI;
- administrator access and role-dependent behavior require trusted server-side authorization.

## Current workflow baseline

Codex Workflow v2 is active.

Every future Codex assignment starts from:

```yaml
repository: FreDCFR8/Pokemon-Collection
entrypoint: docs/00_CODEX_ENTRYPOINT.md
template: feature
task: Describe the concrete task.
overrides: []
```

Repeated branch, PR, testing, safety and reporting rules are inherited from the central profiles and templates. Only task-specific deviations belong in `overrides`.

## Product direction

Reliable identity, access and collection management are the immediate product focus. Catalog coverage remains important but is now a separate controlled maintenance stream. Trade remains the lowest product priority.

## Next approved phase

Prepare and implement **Phase 1B** as one focused PR:

- inspect and preserve the existing functional login and session services;
- introduce one central reactive auth/profile runtime;
- provide product-ready login and logout behavior;
- resolve the authenticated child to exactly one permitted profile;
- do not introduce role migration, admin UI, dashboard redesign, guest access or unrelated cleanup in the same phase;
- verify mobile behavior and preserve existing collection, catalog and Supabase boundaries.
