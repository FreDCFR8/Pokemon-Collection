# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-14_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7C-2F — Wishlist toevoegen vanuit Sets Card Detail**

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

Phase 7C-2F adds one focused write flow from Sets:

- Wishlist cards are read from the active collection's wishlist rows with stable catalog identity and catalog image metadata;
- Wishlist uses the same bounded server-side 24-card pagination and previous/next UX as Collection; it never loads the full catalog in the browser;
- Wishlist page-level failures expose a retry that reloads only the Wishlist page;
- selecting one wishlist card opens the shared Card Detail and loads ownership only for that selected catalog card through the existing read service;
- Sets card detail offers `Aan wishlist toevoegen`; binder/grid and Collection expose no new wishlist action;
- the mutation service performs a read-only active-collection ownership/readiness check before insert;
- wishlist writes use stable `collectionId` and `cardCatalogId`, `quantity = 1`, `condition = null` and `status = wishlist`;
- the server response is fully validated, duplicate writes are idempotently resolved, and the visible Sets ownership state reloads after success;
- pending, success, error and retry states are controlled by the shared detail; late responses cannot update a closed or changed Sets context;
- one focused RLS/index migration extends the existing ownership boundary to wishlist rows; Collection quantity management and Wishlist pagination remain unchanged.

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

After Phase 7C-2F is reviewed and merged, continue with the next separately approved small implementation phase from the shared Card Detail design. Trade, Search and condition/status editing remain outside the current phase.

## Known attention points

- global full-catalog search and add flow are not yet available;
- wishlist read-only pagination remains unchanged; wishlist actions from other surfaces are not available;
- trade and missing workflows are not yet available;
- full external catalog synchronization remains future work;
- historical project facts should not be added back to this status document unless they are operationally current.
