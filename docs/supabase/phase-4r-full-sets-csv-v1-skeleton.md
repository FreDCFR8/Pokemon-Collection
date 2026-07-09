# Phase 4R — Full Sets CSV v1 Skeleton

## Purpose

Phase 4R adds a skeleton-only CSV for a future full Pokémon set catalog. The CSV is intended to prepare a reviewable data path for the complete set catalog without adding catalog rows in this phase.

The target table remains `public.sets_catalog`.

## Scope

This phase only adds:

- `data/sets/full-sets-catalog-v1.csv` with the approved header only.
- This documentation page describing the CSV purpose, mapping, and safety rules.

This phase does not add set data yet. Future data rows must be added separately in a reviewable PR.

## CSV header

```csv
set_code,name,series,generation,release_date,printed_total,total,symbol_url,logo_url,source,source_id
```

The CSV contains only the header in Phase 4R. It must not contain data rows in this phase.

## Target table columns

The real columns of `public.sets_catalog` are:

- `id`
- `set_code`
- `name`
- `series`
- `generation`
- `release_date`
- `printed_total`
- `total`
- `symbol_url`
- `logo_url`
- `source`
- `source_id`
- `created_at`
- `updated_at`

## CSV mapping

| CSV column | `public.sets_catalog` column |
| --- | --- |
| `set_code` | `set_code` |
| `name` | `name` |
| `series` | `series` |
| `generation` | `generation` |
| `release_date` | `release_date` |
| `printed_total` | `printed_total` |
| `total` | `total` |
| `symbol_url` | `symbol_url` |
| `logo_url` | `logo_url` |
| `source` | `source` |
| `source_id` | `source_id` |

`id`, `created_at`, and `updated_at` are not present in the CSV skeleton.

## Safety rules

Phase 4R is intentionally data-empty and import-free:

- No Supabase import was executed.
- No Pokémon TCG API call was executed.
- No official website scraping was executed.
- No Bulbapedia data was copied.
- No data from `cards_catalog.set_name` was used.
- No `public.cards` data was used.
- No data was invented.
- No app code was changed.
- No Supabase schema was changed.
- No SQL was executed.
- No scripts were added.
- No package or dependency changes were made.

## Future data additions

Future full set catalog rows must be added through a separate, reviewable PR. Any uncertain fields must remain empty/null instead of being guessed or inferred.
