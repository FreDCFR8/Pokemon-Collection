# Phase 5C — cards_catalog.set_code migration plan

## 1. Status

Planning only. No SQL executed.

## 2. Doel

Add a nullable explicit set mapping column:

```sql
cards_catalog.set_code text null
```

This column is intended to become the explicit project-level link from `public.cards_catalog` rows to `public.sets_catalog.set_code` in a later phase.

## 3. Waarom nullable

`cards_catalog.set_code` must start as nullable because:

- bestaande 2190 `cards_catalog` rows kunnen nog niet allemaal betrouwbaar gekoppeld worden
- backfill gebeurt pas in latere fase
- runtime mag niet breken
- collection page moet blijven werken

Adding the column as nullable keeps the migration additive and avoids changing runtime behavior before the mapping has been reviewed and backfilled.

## 4. Waarom geen FK in deze fase

No foreign key or other constraint should be added in this phase because the safe order is:

1. eerst kolom toevoegen
2. daarna veilige backfill/mapping
3. daarna pas overwegen:
   - index
   - FK naar `sets_catalog(set_code)`
   - not null voor nieuwe geïmporteerde kaarten

There must be geen constraint zolang bestaande data niet gevalideerd is.

## 5. Voorstel SQL voor latere manuele uitvoering

The following SQL is documentation only for later manual execution. Do not execute it as part of this PR.

```sql
alter table public.cards_catalog
add column if not exists set_code text null;

comment on column public.cards_catalog.set_code is
'Project-level set code mapping to public.sets_catalog.set_code. Nullable until reviewed backfill is complete.';
```

## 6. Pre-check SQL voor latere uitvoering

Use these checks before any later manual migration.

### Controle bestaande kolommen van `cards_catalog`

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
```

### Controle of `set_code` al bestaat

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
```

### Count `cards_catalog`

```sql
select count(*) as cards_catalog_count
from public.cards_catalog;
```

### Count rows with non-null `set_name`

```sql
select count(*) as cards_catalog_rows_with_set_name
from public.cards_catalog
where set_name is not null;
```

### Count distinct `set_name`

```sql
select count(distinct set_name) as distinct_set_name_count
from public.cards_catalog
where set_name is not null;
```

## 7. Post-check SQL voor latere uitvoering

Use these checks immediately after any later manual migration.

### Controle dat `set_code` kolom bestaat

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
```

### Count `cards_catalog` blijft gelijk

```sql
select count(*) as cards_catalog_count
from public.cards_catalog;
```

### Count `set_code` non-null is 0 direct na migration

```sql
select count(*) as cards_catalog_rows_with_set_code
from public.cards_catalog
where set_code is not null;
```

### `collection_cards` count blijft gelijk

```sql
select count(*) as collection_cards_count
from public.collection_cards;
```

## 8. Out of scope

The following items are explicitly out of scope for Phase 5C:

- geen backfill
- geen mapping op `set_name`
- geen progress-query
- geen UI
- geen `public.cards`
- geen trigger/RLS wijziging
- geen index/FK/not null constraint

## 9. Risico’s

- `set_name` lijkt bruikbaar maar is niet canoniek
- foute mapping zou set-progress fout tonen
- constraint te vroeg kan bestaande data blokkeren

## 10. Stop rule

Bij latere uitvoering: stop als:

- `cards_catalog.set_code` al bestaat met data
- `cards_catalog` schema afwijkt van verwacht
- `cards_catalog` count onverwacht is
- SQL error optreedt
- er andere tabellen zouden moeten wijzigen

## 11. Volgende fases

- Phase 5D: manual SQL document voor toevoegen kolom
- Phase 5E: backfill/mapping strategy
- Phase 5F: read-only progress service
- Phase 5G: SetsPage progress UI
