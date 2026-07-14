# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-14_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7C-2D2B — shared collection-card mutation service**

PR 110 merged Phase 7C-2D2A and introduced the reusable ownership foundation. Phase 7C-2D2B now moves add, increase, decrease and delete mutation behavior into the shared `collectionCards` feature boundary without changing the visible Sets experience.

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

Phase 7C-2D2B is limited to the shared mutation boundary:

- shared camelCase mutation contracts add exactly one owned Near Mint copy or change quantity by exactly one;
- update and delete writes retain expected-current-quantity filters to prevent stale confirmations;
- full server responses are validated before success is returned;
- duplicate, stale and invalid-result outcomes are typed domain errors;
- existing Sets mutation services are thin compatibility adapters, with no JSX, CSS or visible UX changes.

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

After Phase 7C-2D2B is reviewed and merged, continue with the next approved small implementation phase from the shared Card Detail design. Shared presentation and page adapters remain outside the current mutation-foundation phase.

## Known attention points

- desktop behavior of the current card detail should be reviewed during the shared-detail phase;
- global full-catalog search and add flow are not yet available;
- wishlist, trade and missing workflows are not yet available;
- full external catalog synchronization remains future work;
- historical project facts should not be added back to this status document unless they are operationally current.
