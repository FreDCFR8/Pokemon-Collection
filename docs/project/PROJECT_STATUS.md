# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-17_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7B-2F4 — Versioneerbare lokale JSON-input**

Deze fase voegt een read-only lokale JSON-bronadapter toe voor de datasetstructuur van `PokemonTCG/pokemon-tcg-data`. De bestaande single-set importer blijft de matching- en veiligheidsgrens; lokale input kan bestaande externe IDs opnieuw valideren zonder API-call of databasewrite.

## Latest merged product milestone

**PR128 — Phase 7B-2F3: Catalog Import Batch Runner**

PR128 is gemerged. De batch-runner doorliep `sv3pt5` en `sv3` gecontroleerd; beide sets zijn dry-run-, write- en idempotency-gevalideerd. De write-approved batch voerde daarna geen nieuwe writes uit.

## Active work

Phase 7B-2F4:

- voeg lokale JSON-input toe voor de `PokemonTCG/pokemon-tcg-data` kaartstructuur;
- behandel de upstream `cards/en/{set}.json`-file als één setcontext via `--set`; aanwezige `set.id`-velden worden gecontroleerd wanneer ze aanwezig zijn;
- hergebruik de bestaande normalisatie, Supabase matching en veiligheidsrapportage;
- behoud API-identiteit `pokemon_tcg_api` zodat bestaande externe IDs en stabiele interne catalogus-ID's matchen;
- houd lokale JSON-input read-only totdat een aparte write-autorisatiefase is goedgekeurd;
- voeg parser- en CLI-tests toe zonder databasewrites of import-run in de PR.

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

## Verified `sv3` import

Pokémon TCG API set `sv3` (`Obsidian Flames`) is imported and idempotency-verified:

- write result: PASS;
- 230 expected and received cards;
- 174 new `cards_catalog` records;
- 174 new `card_external_references` records;
- 348 database writes;
- zero failed writes;
- post-write reference count: 230;
- post-write unique external-reference count: 230;
- post-write catalog links: 230;
- `collection_cards` remained unchanged: 1111 → 1111;
- idempotency dry-run result: PASS;
- idempotency planned writes: 0;
- idempotency database writes: 0.

## Next phase scope

Na validatie van de lokale JSON-bron volgt een afzonderlijke fase voor lokale bronwrites en daarna bredere catalogussynchronisatie. Trade remains a separate future area and the lowest product priority.
