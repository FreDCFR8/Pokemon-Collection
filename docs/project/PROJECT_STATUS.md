# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-16_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7B-2F1 — Veilige multi-set dry-runvoorbereiding**

Deze fase bereidt uitsluitend veilige read-only dry-runs voor meerdere geldige Pokémon TCG-set-ID’s voor. Er wordt geen catalogusimport uitgevoerd en er zijn geen databasewrites toegestaan.

## Latest merged product milestone

**PR125 — Phase 7D-1B: Kaart toevoegen vanuit globale cataloguszoekfunctie**

PR125 is gemerged. Phase 7D-1B is afgerond en catalogusdekking en collectiebeheer zijn de primaire productfocus.

## Active work

Phase 7B-2F1:

- lowercase ASCII-set-ID’s met begrensde lengte zijn read-only analyseerbaar;
- dry-run blijft de standaard en toont matching, fallbackkandidaten en een theoretisch writeplan;
- alleen exact `npm run catalog:import -- --set sv3pt5 --write` is write-geautoriseerd;
- andere sets met `--write` worden vóór externe API- of Supabase-calls geblokkeerd;
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

Expansion to other catalog sets requires separately scoped validation and approval. This phase adds no second write-authorized set.

## Next phase scope

Candidate pilot-set selection and any new write authorization require a separate reviewed phase. Trade remains a separate future area and the lowest product priority.
