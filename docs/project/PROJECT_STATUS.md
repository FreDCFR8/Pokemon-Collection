# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-17_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7B-2F2 — Gecontroleerde Obsidian Flames-import**

Deze fase autoriseert Pokémon TCG API set `sv3` (`Obsidian Flames`) als tweede expliciet toegestane catalogusimportset, na een geslaagde read-only pilot. De bestaande importflow blijft per set, operatorgestuurd, dry-run als standaard en geblokkeerd voor niet-geautoriseerde write-sets.

## Latest merged product milestone

**PR126 — Phase 7B-2F1: Veilige multi-set dry-runvoorbereiding**

PR126 is gemerged. Generieke read-only dry-runs zijn mogelijk voor geldige lowercase ASCII-set-ID's, maar write-autorisatie blijft expliciet per set in code.

## Active work

Phase 7B-2F2:

- `sv3pt5` blijft de bewezen referentie-import;
- `sv3` wordt afzonderlijk write-geautoriseerd;
- dry-run blijft de standaard en toont matching, fallbackkandidaten en een theoretisch writeplan;
- andere sets met `--write` worden vóór externe API- of Supabase-calls geblokkeerd;
- `collection_cards` blijft buiten ieder importer-writepad en `public.cards` blijft legacy;
- vóór een echte `sv3 --write` is een verse groene dry-run vereist;
- na een write zijn postchecks en een idempotency dry-run verplicht.

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

## Current `sv3` pilot evidence

Pokémon TCG API set `sv3` (`Obsidian Flames`) passed the read-only pilot:

- 230 expected and received cards;
- 230 unique external IDs;
- 56 existing matches through external references;
- 174 planned new `cards_catalog` records;
- 174 planned new `card_external_references` records;
- 348 theoretical writes;
- zero ambiguous, conflicts or blocked items;
- reliable setmapping;
- database writes: 0.

## Next phase scope

Complete the controlled `sv3` import only after a fresh green dry-run, explicit operator approval for `--write`, post-write verification and idempotency confirmation. Broader local JSON input through `PokemonTCG/pokemon-tcg-data` remains a separate future architecture phase. Trade remains a separate future area and the lowest product priority.
