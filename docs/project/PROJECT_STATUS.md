# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-14_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7C-2D2E — Collection Card Detail quantity management**

PR 113 merged Phase 7C-2D2D and introduced the shared Collection Card Detail read-only flow. Phase 7C-2D2E now activates narrowly constrained quantity management from that shared detail.

## Latest merged product milestone

**PR 113 — Phase 7C-2D2D: Collection read-only shared Card Detail**

Available behavior:

- Sets uses the shared controlled Card Detail presentation through a thin Sets adapter;
- opened sets load catalog cards in server-side batches of 30;
- binder grid shows card images with a subtle collection marker;
- card metadata and management controls are shown in card detail;
- absent cards can be added as one owned Near Mint copy;
- quantity changes use secured exact-step UPDATE behavior;
- transition from one copy to zero uses secured DELETE behavior;
- set progress counts unique physical card presence, not quantity;
- Lars and Lore remain isolated through the active collection and RLS.

## Active work

Phase 7C-2D2E is limited to Collection quantity management from the shared Card Detail:

- Collection cards receive stable catalog identity, set code and large-image data while the existing server-side search, filters, sorting, count and 24-card pagination remain unchanged;
- selecting one card opens the shared Card Detail immediately and loads ownership only for that selected catalog card through the shared read service;
- stale ownership responses after close, card, collection or page changes are ignored;
- Collection capabilities are enabled only for one confirmed manageable owned Near Mint row; failed reads remain unknown with retry;
- confirmed increase/decrease responses update visible quantity and refresh selected ownership;
- confirmed deletion closes detail and refreshes the bounded Collection page;
- Wishlist, Trade, Search and condition/status editing remain outside this phase.

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

After Phase 7C-2D2E is reviewed and merged, continue with the next separately approved small implementation phase from the shared Card Detail design. Wishlist, Trade, Search and condition/status editing remain outside the current phase.

## Known attention points

- global full-catalog search and add flow are not yet available;
- wishlist, trade and missing workflows are not yet available;
- full external catalog synchronization remains future work;
- historical project facts should not be added back to this status document unless they are operationally current.
