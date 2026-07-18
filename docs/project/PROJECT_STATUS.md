# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-17_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7B-2F9A — Automatische volledige lokale datasetinventaris**

De actieve fase bouwt een versieerbare, volledig read-only manifestbatch voor meerdere lokale JSON-setbestanden uit `PokemonTCG/pokemon-tcg-data`. De batchrunner blijft orchestratie-only en hergebruikt `import-set.ts` voor parsing, matching en veiligheidsvalidatie.

## Latest merged product milestone

**PR135 — Phase 7B-2F8: Lokale catalogusmanifest- en batchvalidatie**

PR135 is gemerged. De lokale manifestbatch blijft read-only, gebruikt de bestaande single-set importer en wijzigt geen `cards_catalog` of `collection_cards`.

## Active work

Phase 7B-2F9A:

- automatische inventarisatie via `catalog:manifest:generate -- --input-root <datasetmap> --output <manifestpad> [--report <rapportpad>]`;
- de generator controleert een schone checkout met exact de vastgepinde datasetcommit;
- setindex en alle Engelse kaartbestanden worden volledig lokaal gevalideerd;
- manifestoutput wordt alleen bij een volledige PASS atomisch geschreven;
- volledige catalogus-dry-run blijft Phase 7B-2F9B.

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

Na Phase 7B-2F9A blijven bredere cataloguswrites en de volledige catalogus-dry-run expliciet aparte, goedgekeurde fases. Trade remains a separate future area and the lowest product priority.
