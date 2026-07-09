# Phase 4T — Full Sets CSV v1 Validation Log

## 1. Status

Phase 4T is validation/logging only. This document records the validation expectations and accepted contents for `data/sets/full-sets-catalog-v1.csv` after Phase 4S.

No runtime behavior, database schema, Supabase data, SQL, scripts, dependencies, or CSV content are changed by this phase.

## 2. Validated file

Validated CSV file:

```text
data/sets/full-sets-catalog-v1.csv
```

## 3. CSV structure

The CSV header must match this exact column order and spelling:

```csv
set_code,name,series,generation,release_date,printed_total,total,symbol_url,logo_url,source,source_id
```

## 4. Expected row count

Expected CSV size:

- 11 data rows
- Header + 11 rows = 12 total CSV lines

## 5. Validation checks

The CSV is considered valid for Phase 4T when all checks below pass:

- Header is exact:
  `set_code,name,series,generation,release_date,printed_total,total,symbol_url,logo_url,source,source_id`
- Every row has exactly 11 columns.
- `set_code` is not empty.
- `name` is not empty.
- `source` is not empty.
- `source_id` is not empty.
- There are no duplicate `set_code` values.
- `release_date` uses `YYYY-MM-DD` format.
- `generation` remains empty for all rows.
- `source` is `pokemon_tcg_api` for all rows.
- Paldean Fates uses project-canonical `set_code` `sv45` and external `source_id` `sv4pt5`.
- `public.cards` is not used.
- `cards_catalog.set_name` is not used.
- No Supabase import is executed.
- No SQL is executed.

## 6. Current accepted rows

| set_code | name | source_id |
|---|---|---|
| sv1 | Scarlet & Violet | sv1 |
| sv2 | Paldea Evolved | sv2 |
| sv3 | Obsidian Flames | sv3 |
| sv3pt5 | 151 | sv3pt5 |
| sv4 | Paradox Rift | sv4 |
| sv45 | Paldean Fates | sv4pt5 |
| sv5 | Temporal Forces | sv5 |
| sv6 | Twilight Masquerade | sv6 |
| sv6pt5 | Shrouded Fable | sv6pt5 |
| sv7 | Stellar Crown | sv7 |
| sv8 | Surging Sparks | sv8 |

## 7. Important decision

`set_code` is project-canonical.

`source_id` is the external source identifier.

These values can differ. In particular, Paldean Fates uses project-canonical `set_code` `sv45` while keeping the external Pokémon TCG API identifier `sv4pt5` in `source_id`.

Keeping these concepts separate prevents duplicate sets when project naming and external source identifiers do not match one-to-one.

## 8. Out of scope

The following activities are explicitly out of scope for Phase 4T:

- No import.
- No runtime changes.
- No data expansion.
- No additional CSV rows.
- No scripts.
- No API sync.
- No collection progress changes.
