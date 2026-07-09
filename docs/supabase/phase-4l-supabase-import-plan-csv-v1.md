# Phase 4L — Supabase Import Plan for Canonical Sets CSV v1

## Status

Import planning only.

No SQL has been executed in this phase.

## Source File

CSV planned for import:

`data/sets/sets-catalog-canonical-v1.csv`

## Scope

Phase 4L documents how the Phase 4H CSV v1 can be manually imported into `public.sets_catalog`.

This phase does not import data.

This phase does not change the CSV.

This phase does not change runtime application code.

## Current CSV Assumptions

The CSV v1 has already passed Phase 4J structure validation:

- approved header
- 11 columns per row
- 17 data rows
- non-empty `set_code`
- non-empty `name`
- `source = manual_review`
- unconfirmed fields are empty

## Import Target

Target table:

`public.sets_catalog`

Target fields for CSV v1:

- `external_source`
- `external_id`
- `set_code`
- `name`
- `series`
- `printed_total`
- `total`
- `release_date`
- `generation`
- `logo_url`
- `symbol_url`
- `source_url`

## Field Mapping

| CSV column | sets_catalog column | import rule |
|---|---|---|
| set_code | set_code | insert as text |
| name | name | insert as text |
| series | series | null when empty |
| generation | generation | null when empty |
| release_date | release_date | null when empty |
| printed_total | printed_total | null when empty |
| total | total | null when empty |
| symbol_url | symbol_url | null when empty |
| logo_url | logo_url | null when empty |
| source | external_source | insert as text |
| source_id | external_id | null when empty |
| none | source_url | null for CSV v1 |

## Import Rules

- Empty CSV fields must import as `null`, not empty strings.
- `external_source` must be `manual_review`.
- `external_id` may be `null`.
- `set_code` must be non-empty.
- `name` must be non-empty.
- No release dates, totals, URLs, generation, series or source IDs may be invented.
- Do not import from `cards_catalog.set_name`.
- Do not import from `public.cards`.

## Pre-check SQL

Run before import in Supabase:

```sql
select count(*) as sets_catalog_count
from public.sets_catalog;
```

Check for existing rows with the same planned set codes before importing:

```sql
select set_code, name, external_source, external_id
from public.sets_catalog
where set_code in (
  'sv3',
  'swsh12',
  'swsh11',
  'swsh10',
  'swsh8',
  'swsh12pt5',
  'pgo',
  'swsh9',
  'swsh7',
  'sv1',
  'sv2',
  'sv45',
  'sv6',
  'sv7',
  'sv8',
  'sv9',
  'sv10'
)
order by set_code;
```

Expected planning result before the first CSV v1 import:

- 17 planned set codes reviewed
- no duplicate target rows for those `set_code` values unless the import operator intentionally switches to an update/upsert plan
- no import proceeds if duplicate handling is unclear

## Manual Import Plan

1. Open the Supabase project manually.
2. Navigate to the `public.sets_catalog` table import flow.
3. Select `data/sets/sets-catalog-canonical-v1.csv` as the source file.
4. Confirm the CSV header exactly matches the Phase 4J-approved header.
5. Map CSV columns to `public.sets_catalog` using the field mapping in this document.
6. Ensure empty CSV fields are imported as `null`.
7. Set `source_url` to `null` for all CSV v1 rows.
8. Do not add, infer or enrich any missing values during import.
9. Preview the import before execution.
10. Execute only after the pre-check SQL and preview are reviewed.

## Post-import Verification SQL

Run after import in Supabase, only if a separate approved import step is executed:

```sql
select count(*) as imported_manual_review_count
from public.sets_catalog
where external_source = 'manual_review'
  and set_code in (
    'sv3',
    'swsh12',
    'swsh11',
    'swsh10',
    'swsh8',
    'swsh12pt5',
    'pgo',
    'swsh9',
    'swsh7',
    'sv1',
    'sv2',
    'sv45',
    'sv6',
    'sv7',
    'sv8',
    'sv9',
    'sv10'
  );
```

Expected result after a successful first CSV v1 import:

- `imported_manual_review_count = 17`

Verify that unconfirmed fields remained `null`:

```sql
select set_code, name
from public.sets_catalog
where external_source = 'manual_review'
  and set_code in (
    'sv3',
    'swsh12',
    'swsh11',
    'swsh10',
    'swsh8',
    'swsh12pt5',
    'pgo',
    'swsh9',
    'swsh7',
    'sv1',
    'sv2',
    'sv45',
    'sv6',
    'sv7',
    'sv8',
    'sv9',
    'sv10'
  )
  and (
    series is not null
    or generation is not null
    or release_date is not null
    or printed_total is not null
    or total is not null
    or symbol_url is not null
    or logo_url is not null
    or source_url is not null
    or external_id is not null
  )
order by set_code;
```

Expected result for CSV v1:

- zero rows

## Rollback Consideration

If the manual import is executed incorrectly, rollback should be handled as a separate reviewed Supabase operation.

This Phase 4L document does not approve delete, truncate or corrective update statements.

## Out of Scope

- no import execution
- no Supabase writes
- no CSV edits
- no application code changes
- no runtime query changes
- no scripts
- no package or dependency changes
- no external API usage
- no internet lookup
- no `public.cards` runtime usage

## Phase Decision

Phase 4L is complete when this import plan is reviewed and merged.
