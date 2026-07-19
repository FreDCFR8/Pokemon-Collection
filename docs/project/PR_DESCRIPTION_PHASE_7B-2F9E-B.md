# PR141 — Canonieke Batch 1 writeplanflow

Branch: `phase/7b-2f9e-batch1-write`

## Correctie

De writer gebruikte een ander setmappingpad dan de read-only rebaseline en kon daardoor `missing_set_mapping` rapporteren voor kaarten waarvoor de rebaseline een canonieke `sets_catalog`-identiteit had vastgesteld. PR141 maakt het rapport en het kaartniveau-writeplan expliciet gescheiden en verplicht.

De flow is:

```text
lokale dataset → canonieke read-only analyse → rapport + afzonderlijk writeplan
                 → onafhankelijke planvalidatie → uitsluitend planacties uitvoeren
```

`--approved-dry-run-report` en `--write-plan` zijn beide verplicht voor lokale `write-approved`. Geen van beide bestanden wordt als fallback voor het andere gebruikt.

Het writeplan bevat datasetcommit, manifestHash, Batch 1-setlijst, kaarttotalen, analysisHash, per-setresultaten en per-kaartacties: `existingIdentical`, `insertReference`, `insertCardAndReference`, `blocked` of `conflict`. Een ontbrekende `setCatalogId` of `setCode` wordt altijd `blocked` met `missing_set_catalog_identity`.

## Validatie

- `npm.cmd test`: 276 tests geslaagd
- `npm.cmd run build`: geslaagd
- `git diff --check`: geslaagd
- databasewrites tijdens deze correctie: `0`
- migraties uitgevoerd: `0`
- externe Pokémon-API-calls: `0`
- write-run uitgevoerd: `0`

De bw9-regressietests controleren planroundtrip, hashintegriteit, ontbrekende setidentiteit en het ontbreken van een onveilige `existingIdentical`-actie. De nieuwe regressies controleren één blocked-actie per kaart voor ontbrekende `setCatalogId`, ontbrekende `setCode` en meerdere kaarten. Een echte Supabase-backed write-run is bewust niet uitgevoerd.
