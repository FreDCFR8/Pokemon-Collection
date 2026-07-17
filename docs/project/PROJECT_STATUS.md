# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-17_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7B-2F7 — Uitgebreide Card Detail-presentatie**

De gedeelde Card Detail toont nu de beschikbare geneste kaartdetails zoals abilities, aanvallen, regels, zwaktes, weerstanden, terugtrekkosten, Pokédex-nummers en legaliteit. Deze fase is UI-only: geen migratie, importwrite of wijziging aan `collection_cards`.

## Latest merged product milestone

**PR132 — Phase 7B-2F6: Herbruikbare metadata-backfill**

PR132 is gemerged. De detail-backfill voor `sv3pt5` vulde 207 lege `card_details`-velden aan; `sv3` was al volledig gevuld. Beide sets hebben nu gecontroleerde detaildata.

## Active work

Phase 7B-2F6:

- herbruikbare detail-backfill via `catalog:backfill:details`;
- dry-run standaard en expliciete write alleen voor `sv3pt5`/`sv3` via API-bron;
- alleen lege `card_details` worden aangevuld;
- missing targets, verkeerde sets en collection-countwijzigingen blokkeren de run;
- lokale JSON blijft read-only voor backfill totdat apart geautoriseerd.

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

Na metadata-enrichment volgt een afzonderlijke gecontroleerde backfill voor bestaande catalogusrecords, daarna lokale manifest/batch-synchronisatie en pas daarna bredere cataloguswrites. Trade remains a separate future area and the lowest product priority.
