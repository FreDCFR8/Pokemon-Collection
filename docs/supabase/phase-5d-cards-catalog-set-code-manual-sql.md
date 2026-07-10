# Phase 5D — Manual SQL for `cards_catalog.set_code`

## 1. Status

Manual SQL document only. No SQL executed in this PR.

## 2. Doel

Add nullable column:

```sql
public.cards_catalog.set_code text null
```

## 3. Waarom

This creates an explicit future card-to-set mapping toward `public.sets_catalog.set_code`.
It does not backfill data yet.

## 4. Pre-check SQL

Run these checks before any manual execution:

```sql
select
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards_catalog'
order by ordinal_position;

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards_catalog'
  and column_name = 'set_code';

select count(*) as cards_catalog_count
from public.cards_catalog;

select count(*) as collection_cards_count
from public.collection_cards;

select count(*) as cards_catalog_rows_with_set_name
from public.cards_catalog
where set_name is not null;

select count(distinct set_name) as distinct_set_name_count
from public.cards_catalog
where set_name is not null;
```

## 5. Stop rule before execution

Stop als:

- `cards_catalog.set_code` al bestaat met data
- `cards_catalog` schema afwijkt van verwacht
- `cards_catalog` count onverwacht is
- `collection_cards` count onverwacht is
- pre-checks errors geven

## 6. Manual SQL

```sql
begin;

alter table public.cards_catalog
add column if not exists set_code text null;

comment on column public.cards_catalog.set_code is
'Project-level set code mapping to public.sets_catalog.set_code. Nullable until reviewed backfill is complete.';

commit;
```

## 7. Post-check SQL

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards_catalog'
  and column_name = 'set_code';

select count(*) as cards_catalog_count_after
from public.cards_catalog;

select count(*) as collection_cards_count_after
from public.collection_cards;

select count(*) as cards_catalog_rows_with_set_code
from public.cards_catalog
where set_code is not null;
```

## 8. Expected result after execution

- `set_code` column exists
- `data_type = text`
- `is_nullable = YES`
- `cards_catalog` count unchanged
- `collection_cards` count unchanged
- `cards_catalog_rows_with_set_code = 0`
- no app behavior changes

## 9. Out of scope

- geen backfill
- geen mapping op `set_name`
- geen index
- geen FK
- geen not null constraint
- geen progress-query
- geen UI
- geen `public.cards`
- geen trigger/RLS wijziging

## 10. Next phase

Phase 5E — execute manual SQL and record execution log after Supabase checks.
