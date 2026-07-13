# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-13_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 0D — documentation refresh and governance**

PR 106 is merged. Phase 7C-2C2 delivered secure quantity management from an opened set together with the clean three-column binder grid and a functional card-detail flow.

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

Documentation is being aligned with the proven workflow and product principles:

- architecture before implementation;
- explicit technical and UX review;
- multiple correction rounds inside the same PR when scope remains stable;
- repository documentation as durable project memory;
- new roadmap, UX and architecture-principles documents.

No runtime code, database object or application data is changed by Phase 0D.

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

## Next product phase

**Phase 7C-2D — shared card detail experience**

Before implementation:

1. define the shared product and UX requirements;
2. inspect current Sets and Collection detail flows;
3. design reusable component boundaries;
4. phase the work before writing code.

The goal is a reusable card-detail experience for Sets and Collection, with future compatibility for Wishlist, Trade and Search.

## Known attention points

- desktop behavior of the current card detail should be reviewed during the shared-detail phase;
- global full-catalog search and add flow are not yet available;
- wishlist, trade and missing workflows are not yet available;
- full external catalog synchronization remains future work;
- historical project facts should not be added back to this status document unless they are operationally current.