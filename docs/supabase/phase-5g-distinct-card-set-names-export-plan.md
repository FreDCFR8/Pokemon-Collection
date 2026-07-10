# Phase 5G — Distinct `cards_catalog.set_name` Export Plan

## 1. Status

Planning only. No SQL executed. No data changed.

## 2. Doel

Prepare a manual Supabase export of distinct `cards_catalog.set_name` values with row counts.

## 3. Context

- `cards_catalog_count = 2190`
- `cards_catalog.set_code` exists
- all current `set_code` values are null
- `cards_catalog_rows_with_set_name = 2190`
- `distinct_set_name_count = 125`
- `sets_catalog` has 21 curated rows
- this phase does not map names to `set_code`

## 4. Export SQL

```sql
select
  set_name,
  count(*) as row_count
from public.cards_catalog
where set_name is not null
group by set_name
order by row_count desc, set_name asc;
```

## 5. Validation SQL

```sql
select count(*) as cards_catalog_count
from public.cards_catalog;

select count(*) as cards_catalog_rows_with_set_name
from public.cards_catalog
where set_name is not null;

select count(distinct set_name) as distinct_set_name_count
from public.cards_catalog
where set_name is not null;

select count(*) as cards_catalog_rows_with_set_code
from public.cards_catalog
where set_code is not null;
```

## 6. Expected validation results

- `cards_catalog_count = 2190`
- `cards_catalog_rows_with_set_name = 2190`
- `distinct_set_name_count = 125`
- `cards_catalog_rows_with_set_code = 0`

## 7. Export handling rules

- Export is for review only
- Do not edit source database
- Do not infer `set_code`
- Do not auto-map by name
- Do not use `public.cards`
- Do not use internet/API lookup
- Do not create mapping in this phase

## 8. Output target for next phase

The exported list will be used in Phase 5H to create a reviewed mapping document or CSV.

## 9. Stop rules

Stop if:

- `distinct_set_name_count` is not 125
- `cards_catalog_count` is not 2190
- `cards_catalog_rows_with_set_code` is not 0
- SQL errors occur
- export output is incomplete
- any automatic mapping is introduced

## 10. Out of scope

- no mapping
- no backfill
- no update SQL
- no FK/index/not-null
- no progress query
- no UI
- no CSV generation
- no data changes
