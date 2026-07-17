# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-17_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7B-2F3 — Catalog Import Batch Runner**

Deze fase vervangt handmatig set-per-set importeren door een gecontroleerde batch-runner bovenop de bestaande bewezen single-set importer. De runner verwerkt sets sequentieel, valideert per stap de bestaande importer-output en stopt bij een falende set.

## Latest merged product milestone

**PR127 — Phase 7B-2F2: Gecontroleerde Obsidian Flames-import**

PR127 is gemerged. Pokémon TCG API set `sv3` (`Obsidian Flames`) is write-geautoriseerd en succesvol geïmporteerd.

## Active work

Phase 7B-2F3:

- voeg een repo-gecontroleerde batchconfig toe voor catalogussets;
- voeg een batchcommando toe voor dry-run en expliciet `write-approved` mode;
- voer per set automatisch dry-run, write en idempotency dry-run uit in write-approved mode;
- valideer batchstappen op importer-output, niet alleen op exitcode;
- stop de batch bij de eerste falende set;
- behoud de bestaande single-set importer als enige plaats voor API-, matching-, write- en post-write veiligheidscontroles;
- `collection_cards` blijft buiten ieder importer-writepad en `public.cards` blijft legacy.

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

Complete the batch runner and then use it to reduce manual import work. Broader local JSON input through `PokemonTCG/pokemon-tcg-data` remains a separate future architecture phase. Trade remains a separate future area and the lowest product priority.
