# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-17_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7B-2F8 — Lokale catalogusmanifest- en batchvalidatie**

De actieve fase bouwt een versieerbare, volledig read-only manifestbatch voor meerdere lokale JSON-setbestanden uit `PokemonTCG/pokemon-tcg-data`. De batchrunner blijft orchestratie-only en hergebruikt `import-set.ts` voor parsing, matching en veiligheidsvalidatie.

## Latest merged product milestone

**PR134 — Phase 7B-2F7: Uitgebreide Card Detail-presentatie**

PR134 is gemerged. Card Detail-presentatie en lokale energie-/rarity-symbolen zijn afgerond; de fase was UI-only zonder migratie, importwrite of wijziging aan `collection_cards`.

## Active work

Phase 7B-2F8:

- lokale manifestbatch via `catalog:import:batch -- --source pokemon_tcg_data --manifest <pad> --input-root <datasetmap>`;
- dry-run blijft permanent de standaard;
- lokale bron blokkeert `write-approved` en `--write`;
- manifestsets worden vooraf gevalideerd en sequentieel via `import-set.ts` uitgevoerd;
- lokale batchvalidatie schrijft niet naar Supabase en raakt `collection_cards` niet;
- bredere cataloguswrites vereisen een afzonderlijke goedgekeurde fase.

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

Na Phase 7B-2F8 blijven bredere cataloguswrites en verdere synchronisatie expliciet aparte, goedgekeurde fases. Trade remains a separate future area and the lowest product priority.
