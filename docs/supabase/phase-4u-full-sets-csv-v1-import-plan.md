# Phase 4U — Full Sets CSV v1 Import Plan

## 1. Status

Phase 4U is planning only.

No import is executed in this phase.

No SQL is executed in this phase.

No CSV, Supabase schema, runtime application code, scripts, packages, or dependencies are changed in this phase.

## 2. Source file

Planned source file for a later approved import phase:

```text
data/sets/full-sets-catalog-v1.csv
```

The CSV currently contains 11 validated data rows with this header:

```csv
set_code,name,series,generation,release_date,printed_total,total,symbol_url,logo_url,source,source_id
```

## 3. Target table

Planned target table for a later approved import phase:

```text
public.sets_catalog
```

Known `public.sets_catalog` columns:

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

## 4. Scope

Phase 4U documents a safe future import plan only.

In scope:

- document pre-import checks for a later manual Supabase review
- document an update/upsert-oriented import strategy
- document post-import verification checks
- document rollback guidance for a later execution phase

Out of execution scope for this phase:

- no import
- no SQL run
- no CSV changes
- no app-code changes
- no Supabase schema changes
- no data changes

## 5. Pre-import checks for a later manual phase

The SQL below is documentation for a later, separate, approved manual Supabase phase. Do not run it as part of Phase 4U.

### 5.1 Count current `sets_catalog` rows

```sql
select count(*) as sets_catalog_count
from public.sets_catalog;
```

Record this count in the later execution log before importing or upserting any rows.

### 5.2 Check existing target rows for the CSV set codes

Some sets may already exist in `public.sets_catalog` from the earlier `manual_review` seed. Existing `set_code` values must use an update/upsert plan later, not a blind duplicate insert.

```sql
select
  set_code,
  name,
  series,
  generation,
  release_date,
  printed_total,
  total,
  source,
  source_id,
  created_at,
  updated_at
from public.sets_catalog
where set_code in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv45',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
)
order by set_code;
```

Expected planning outcome:

- existing rows are identified before execution
- existing rows are not inserted a second time
- the later import operator decides explicitly between update and insert per `set_code`

### 5.3 Check whether `set_code` is unique in the target table

```sql
select
  set_code,
  count(*) as row_count
from public.sets_catalog
where set_code is not null
  and set_code <> ''
group by set_code
having count(*) > 1
order by set_code;
```

Expected result before a safe later import:

- zero duplicate `set_code` groups, or
- the later execution phase stops and resolves duplicates before importing

### 5.4 Check whether CSV `source_id` values conflict with existing rows

`source_id` is the external source identifier. It may differ from project-canonical `set_code`, especially for Paldean Fates.

```sql
select
  set_code,
  source,
  source_id,
  name
from public.sets_catalog
where source = 'pokemon_tcg_api'
  and source_id in (
    'sv1',
    'sv2',
    'sv3',
    'sv3pt5',
    'sv4',
    'sv4pt5',
    'sv5',
    'sv6',
    'sv6pt5',
    'sv7',
    'sv8'
  )
order by source_id, set_code;
```

Review outcome required before later execution:

- every returned `source_id` must map to the intended canonical `set_code`
- no external source identifier should point to an unintended set
- if a conflict is found, stop before import and analyze the row history

### 5.5 Confirm Paldean Fates mapping

Paldean Fates must keep project-canonical `set_code` `sv45` and external Pokémon TCG API `source_id` `sv4pt5`.

```sql
select
  set_code,
  name,
  source,
  source_id
from public.sets_catalog
where set_code = 'sv45'
   or source_id = 'sv4pt5'
order by set_code, source_id;
```

Expected later review outcome:

- Paldean Fates is represented by `set_code = 'sv45'`
- Paldean Fates uses `source_id = 'sv4pt5'`
- there is not a separate duplicate set row using `set_code = 'sv4pt5'`

## 6. Import strategy for a later approved phase

A later import must safely handle rows that already exist in `public.sets_catalog`.

Rules for the later import strategy:

- Use `set_code` as the project-canonical set identity.
- Use `source_id` only as the external source identifier.
- For an existing `set_code`, update only enrichable fields from the CSV.
- For a new `set_code`, insert one new row.
- Do not create a duplicate row for the same set.
- Empty CSV fields must be stored as `null`, not empty strings.
- `generation` remains `null` for all 11 rows.
- Do not infer missing values from app data, card data, APIs, or manual assumptions during the later import.
- Do not import from `public.cards`.
- Do not import from `cards_catalog.set_name`.

The later execution phase should produce an execution log that records:

- the exact CSV file used
- the pre-import row count
- existing rows found for the 11 `set_code` values
- whether each row was inserted or updated
- the post-import row count
- the post-import validation results

## 7. Fields allowed to be filled or updated from the CSV

The later import or upsert may fill or update only these enrichable fields from `data/sets/full-sets-catalog-v1.csv`:

- `name`
- `series`
- `release_date`
- `printed_total`
- `total`
- `symbol_url`
- `logo_url`
- `source`
- `source_id`

`generation` is present in the CSV header, but for these 11 rows it remains empty and must remain `null` after import.

## 8. Fields not sourced directly from the CSV

These target table fields do not come directly from the CSV:

- `id`
- `created_at`
- `updated_at`

A later Supabase operation should let database defaults, triggers, or the existing row values manage these fields. Existing `created_at` values on seed rows should not be overwritten by the CSV.

## 9. Post-import checks for a later manual phase

The SQL below is documentation for a later, separate, approved manual Supabase phase. Do not run it as part of Phase 4U.

### 9.1 Confirm all 11 set codes are present

```sql
select count(*) as csv_set_code_count
from public.sets_catalog
where set_code in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv45',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
);
```

Expected result after successful later import/upsert:

- `csv_set_code_count = 11`

### 9.2 Confirm no duplicate `set_code` values exist

```sql
select
  set_code,
  count(*) as row_count
from public.sets_catalog
where set_code in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv45',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
)
group by set_code
having count(*) > 1
order by set_code;
```

Expected result:

- zero rows

### 9.3 Confirm Paldean Fates has exactly one canonical row

```sql
select
  set_code,
  name,
  source,
  source_id
from public.sets_catalog
where set_code = 'sv45'
   or source_id = 'sv4pt5'
order by set_code, source_id;
```

Expected result:

- exactly one row for Paldean Fates
- `set_code = 'sv45'`
- `source_id = 'sv4pt5'`
- no duplicate row with `set_code = 'sv4pt5'`

### 9.4 Confirm `generation` remains `null` for these 11 rows

```sql
select set_code, generation
from public.sets_catalog
where set_code in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv45',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
)
  and generation is not null
order by set_code;
```

Expected result:

- zero rows

### 9.5 Confirm `source = 'pokemon_tcg_api'` for these 11 rows

```sql
select set_code, source, source_id
from public.sets_catalog
where set_code in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv45',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
)
  and source is distinct from 'pokemon_tcg_api'
order by set_code;
```

Expected result:

- zero rows

### 9.6 Count control after import/upsert

```sql
select count(*) as sets_catalog_count_after
from public.sets_catalog;
```

Compare this count with the pre-import count and the execution log:

- each new `set_code` should increase the count by one
- each existing `set_code` update should not increase the count
- unexpected count changes require stopping and analyzing before any additional work

### 9.7 Sample select for the 11 set codes

```sql
select
  set_code,
  name,
  series,
  generation,
  release_date,
  printed_total,
  total,
  symbol_url,
  logo_url,
  source,
  source_id
from public.sets_catalog
where set_code in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv45',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
)
order by release_date, set_code;
```

Review this output against the CSV before closing the later execution phase.

## 10. Rollback strategy for a later approved phase

Rollback must be cautious because some rows may already exist from the earlier `manual_review` seed.

Rollback rules:

- Roll back only rows affected by the exact 11 `set_code` values in this plan.
- Do not blindly delete rows for existing seed data.
- For rows that existed before the import, prefer restoring previous field values from the execution log instead of deleting the row.
- For rows that were newly inserted and confirmed not to have existed before import, deletion may be considered only in a reviewed rollback operation.
- If any mismatch, duplicate, count anomaly, or Paldean Fates mapping issue appears, stop first and analyze before changing more data.
- A later execution phase must maintain an execution log with pre-change snapshots, the operation performed per `set_code`, validation output, and any rollback actions.

## 11. Out of scope

The following activities are explicitly out of scope for Phase 4U:

- no import
- no SQL execution
- no runtime changes
- no data expansion
- no scripts
- no API sync
- no collection progress changes
- no Supabase schema changes
- no CSV changes
- no app-code changes
