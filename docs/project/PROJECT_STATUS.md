# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-15_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7D-1A — Globale cataloguszoekfunctie read-only**

## Latest merged product milestone

**PR123 — Phase 7C-2L: Uniforme kaartgalerij voor Collection, Sets en Wishlist**

PR123 is gemerged en vormt de visuele en technische basis voor de actieve globale zoekfase.

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

Phase 7D-1A adds bounded read-only discovery across the internal card catalog:

- search runs server-side against `cards_catalog` with exact count and pages of 24 cards;
- search results reuse the shared image-only binder grid and Card Detail;
- collection presence is read in one bounded ownership batch for the visible result page;
- input normalization, request-context guards and safe retry behavior prevent stale or unsafe UI state;
- one not-yet-applied migration adds direct trigram indexes matching the runtime `ILIKE` query;
- Collection and Wishlist mutations from global Search remain outside this phase.

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

Phase 7D-1A is limited to read-only global catalog search. Phase 7D-1B may add existing Collection and Wishlist actions from Search after this read path, migration and UX have been verified. Trade and condition/status editing remain separate future phases.

## Known attention points

- global catalog search is active in PR124; adding cards from Search is not yet available;
- wishlist pagination remains bounded; wishlist actions from binder/grid and Collection are not available;
- trade and missing workflows are not yet available;
- full external catalog synchronization remains future work;
- historical project facts should not be added back to this status document unless they are operationally current.
