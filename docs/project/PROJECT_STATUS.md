# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-15_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7C-2L — Uniforme kaartgalerij voor Collection, Sets en Wishlist**

## Latest merged product milestone

**PR118 — Phase 7C-2G: Wishlist naar collectie**

PR118 is gemerged en vormt de directe basis voor de actieve binder-overviewfase.

Available behavior:

- Sets uses the shared controlled Card Detail presentation through a thin Sets adapter;
- opened sets load catalog cards in server-side batches of 30;
- binder grid shows card images with a subtle collection marker;
- card metadata and management controls are shown in card detail;
- absent cards can be added as one owned Near Mint copy;
- quantity changes use secured exact-step UPDATE behavior;
- transition from one copy to zero uses secured DELETE behavior;
- Collection Card Detail quantity management is available for the active collection;
- set progress counts unique physical card presence, not quantity;
- Lars and Lore remain isolated through the active collection and RLS.

## Active work

Phase 7C-2L aligns the gallery layout across Collection, Sets and Wishlist:

- all three pages use the same image-first, bounded, responsive gallery layout;
- desktop galleries use at most six large cards per row and remain centred;
- existing server-side pagination, search, filters, Card Detail and mutations remain unchanged;
- Wishlist promotion/removal, Collection quantity management and Sets actions remain available in Card Detail;
- no database changes, Supabase migrations or database push are part of this phase.

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

The next phase remains separately approved and scoped from the shared Card Detail design. Trade, Search and condition/status editing remain outside the current phase.

## Known attention points

- global full-catalog search and add flow are not yet available;
- wishlist pagination remains bounded; wishlist actions from binder/grid and Collection are not available;
- trade and missing workflows are not yet available;
- full external catalog synchronization remains future work;
- historical project facts should not be added back to this status document unless they are operationally current.
