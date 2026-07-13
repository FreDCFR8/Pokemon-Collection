# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-14_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7C-2D2A — shared ownership contracts and read service**

PR 109 merged Phase 7C-2D1 and approved the shared Card Detail architecture and UX design. Phase 7C-2D2A now introduces the reusable ownership foundation without changing the visible Sets experience.

## Latest merged product milestone

**PR 106 — Phase 7C-2C2: manage card quantity from opened set**

Available behavior:

- opened sets load catalog cards in server-side batches of 30;
- binder grid shows card images with a subtle collection marker;
- card metadata and management controls are shown in card detail;
- absent cards can be added as one owned Near Mint copy;
- quantity changes use secured exact-step UPDATE behavior;
- transition from one copy to zero uses secured DELETE behavior;
- set progress counts unique physical card presence, not quantity;
- Lars and Lore remain isolated through the active collection and RLS.

## Active work

Phase 7C-2D2A is limited to the shared ownership read boundary:

- stable camelCase ownership contracts keep `owned`, `wishlist`, `trade` and `missing` separate;
- a pure projector determines confirmed absence, physical presence, manageable owned Near Mint state and safe conflicts;
- one bounded batch read loads collection state for one collection and requested catalog-card IDs without N+1 queries;
- the existing Sets service remains a thin compatibility adapter, with no JSX, CSS or mutation changes.

## Current architecture baseline

```text
authenticated user
→ profile
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
- browser writes are explicit user actions protected by RLS and database constraints.

## Verified catalog reference implementation

Pokémon TCG API set `sv3pt5` (`151`) remains the verified controlled-import reference:

- 207 expected and received cards;
- 207 stable external-reference matches after import;
- 136 new catalog records and 136 references added during the approved write;
- zero failed writes;
- post-write idempotency dry-run planned and executed zero writes;
- `collection_cards` was unchanged by the catalog import.

Expansion to other catalog sets requires separately scoped validation and approval.

## Next phase scope

After Phase 7C-2D2A is reviewed and merged, continue with the next approved small implementation phase from the shared Card Detail design. Shared presentation and page adapters remain outside the current ownership-foundation phase.

## Known attention points

- desktop behavior of the current card detail should be reviewed during the shared-detail phase;
- global full-catalog search and add flow are not yet available;
- wishlist, trade and missing workflows are not yet available;
- full external catalog synchronization remains future work;
- historical project facts should not be added back to this status document unless they are operationally current.
