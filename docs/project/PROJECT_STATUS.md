# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-16_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7D-1B — Collection- en Wishlistacties vanuit Zoeken**

## Latest merged product milestone

**PR124 — Phase 7D-1A: Globale cataloguszoekfunctie read-only**

PR124 is gemerged. De globale cataloguszoekfunctie gebruikt bounded server-side search, pagina’s van 24 kaarten, gedeelde image-only grids en read-only Card Detail.

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

Phase 7D-1B adds existing Collection and Wishlist management to global Search:

- absent cards can be added as one owned Near Mint copy or one wishlist entry;
- wishlist-only cards can be removed or atomically promoted to owned;
- manageable owned Near Mint cards support secured exact-step quantity changes and last-copy deletion;
- every write is followed by a bounded ownership read for the selected card;
- success is shown only when the returned server truth matches the expected state transition;
- a failed confirmation retry repeats only the ownership read and never repeats a completed write;
- request-context guards prevent stale responses from changing another card, page or search;
- PR125 has passed technical review and awaits manual iPhone and desktop validation.

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

Complete Phase 7D-1B through manual iPhone and desktop validation, documentation verification and merge of PR125. Advanced search filters, Trade, missing and condition/status editing remain separate future phases.

## Known attention points

- PR125 still requires manual iPhone and desktop validation before merge;
- global Search actions remain inside Card Detail; the image-only result grid has no direct management controls;
- wishlist pagination remains bounded; direct actions from binder grids are not available;
- trade and missing workflows are not yet available;
- full external catalog synchronization remains future work;
- historical project facts should not be added back to this status document unless they are operationally current.
