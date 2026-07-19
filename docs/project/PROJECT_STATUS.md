# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-19_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Phase 7B-2F9D-A — Read-only validatie van exacte setmappings (actief)**

De validator leest uitsluitend de 44 `exact_candidate`-resultaten uit het PR138-rapport tegen hetzelfde gepinde manifest en datasetprofiel. Per kandidaat worden `sets_catalog`, naam/serie, provenance, kaartnummerdekking, externe kaartreferenties en set-/bronconflicten read-only gecontroleerd. De uitkomst is deterministisch, bevat machineleesbare reason codes en rapporteert altijd `databaseWritesTotal: 0`.

**Phase 7B-2F9C — Read-only failure-classificatie en setmappingplan (afgerond)**

De volledige vastgepinde lokale dataset is verwerkt met getypeerde, hervatbare en volledig read-only diagnostiek. Alle inhoudelijke blokkades zijn machineleesbaar geclassificeerd zonder catalogus- of collectiewrites.

## Latest merged product milestone

**PR138 — Phase 7B-2F9C: Read-only failure-classificatie en setmappingdiagnostiek**

PR138 rondt de volledige lokale analyse af. De batchrunner blijft orchestratie-only, hergebruikt `import-set.ts` en wijzigt geen `cards_catalog`, `card_external_references`, `sets_catalog` of `collection_cards`.

## Completed work

Phase 7B-2F9C:

- automatische inventarisatie via `catalog:manifest:generate -- --input-root <datasetmap> --output <manifestpad> [--report <rapportpad>]`;
- de generator controleert een schone checkout met exact de vastgepinde datasetcommit;
- setindex en alle Engelse kaartbestanden worden volledig lokaal gevalideerd;
- `sets/en.json` bepaalt de volledige setlijst en `sets/en.json.total` wordt als `indexedCardsTotal` gerapporteerd;
- de werkelijke kaartbestandslengte bepaalt `expectedCards` in het manifest en `receivedCardsTotal`; het vastgestelde volledige datasetprofiel is 20.219 geïndexeerde kaarten, 20.324 kaartrecords en zes count-waarschuwingen;
- countverschillen zijn niet-blokkerende waarschuwingen; ontbrekende bestanden, ongeldige JSON, kaart-ID-fouten en checkoutfouten blijven blokkerend;
- manifestoutput wordt alleen bij een volledige PASS atomisch geschreven;
- checkpoint/resume gebruikt een atomisch machineleesbaar checkpoint, exact manifest- en setfingerprint, datasetcheckoutvalidatie en gesanitiseerde per-setstatus;
- het eindrapport is atomisch en rapporteert expliciet `databaseWritesTotal: 0`;
- de volledige operationele run verwerkte 173/173 sets en 20.324/20.324 kaarten;
- 7 sets slaagden inhoudelijk en 166 sets bleven veilig geblokkeerd;
- er waren 0 pending sets, 0 runnerfouten en 0 databasewrites;
- setmappingstatussen: 11 `already_reliable`, 44 `exact_candidate` en 118 `no_candidate`;
- failureclassificaties: 162 `missing_set_mapping`, 5 `card_identity_conflict` en 4 `fallback_metadata_mismatch`;
- 5 fallbackkandidaten werden onderzocht en 0 daarvan waren automatisch veilig.

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

## Phase 7B-2F9C update

Phase 7B-2F9C adds typed, atomic per-set diagnostic JSON results and makes the batchrunner classify failures from that contract rather than console wording. Checkpoints and reports retain sanitized diagnostics, failure codes, setmapping evidence and limited examples; malformed subprocess results fail closed as `unexpected_runner_failure`.

De operationele 2F9C-run is afgerond: 173 sets verwerkt, 7 inhoudelijke PASS, 166 inhoudelijke blokkades, 20.324/20.324 kaarten ontvangen, 0 runnerfouten en `databaseWritesTotal: 0`. Een globale FAIL blijft correct zolang inhoudelijke blokkades bestaan.

## Next phase scope

Phase 7B-2F9D-A: kandidaatclassificaties blijven inhoudelijke analyse-uitvoer; mappingpromotie, bredere cataloguswrites en een eventuele `set_external_references`-tabel zijn expliciet uitgesloten.

De live 44-kandidatenrun is lokaal nog niet uitgevoerd: deze checkout bevat geen `PokemonTCG/pokemon-tcg-data`-input-root, PR138-bronrapport of Supabase-leescredentials. De CLI faalt hiervoor gesloten en produceert geen gedeeltelijk of fictief rapport.

Voorgestelde Phase 7B-2F9D beoordeelt de 44 `exact_candidate`-setmappings gecontroleerd en read-only. Kandidaten worden niet automatisch betrouwbaar gemaakt; iedere mappingwijziging en iedere bredere cataloguswrite vereist een afzonderlijke analyse, expliciete goedkeuring en eigen PR. De 118 sets zonder kandidaat blijven geblokkeerd. Trade remains a separate future area and the lowest product priority.
