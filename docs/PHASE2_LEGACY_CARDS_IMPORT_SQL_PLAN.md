# Phase 2V — Legacy `public.cards` Import SQL Plan

## 1. Scope and boundaries

This document describes a future manual SQL import plan for moving legacy Lars cards from `public.cards` into the Phase 2 collection model.

This phase is documentation-only:

- No SQL is executed.
- No runtime code is changed.
- No real UUIDs, secrets, tokens, or production identifiers are included.
- `public.cards` remains read-only and is never modified.
- The initial import is only for Lars legacy records.

## 2. Correct source and target columns

The import must use the verified legacy and catalog column names below.

| Purpose | Correct column |
| --- | --- |
| Legacy card name | `public.cards.pokemon` |
| Legacy card number | `public.cards.number` |
| Catalog card name | `public.cards_catalog.pokemon` |
| Catalog card number | `public.cards_catalog.number` |

The import must avoid any non-existing or incorrect legacy/catalog column aliases for card name or card number.

## 3. Lars-only source filter

Every future import source CTE or legacy source query must restrict the source rows to Lars:

```sql
where cards.collection = 'Lars'
```

No Lore rows, unknown collection values, or unfiltered `public.cards` rows may be imported by this first SQL plan.

## 4. Null and invalid data handling

The future SQL import must normalize nullable ownership fields as follows:

- `coalesce(cards.status, 'owned') as status`
- `coalesce(cards.quantity, 1) as quantity`

The import must skip invalid rows:

- Do not import rows where the effective quantity is `<= 0`.
- Do not import rows where `public.cards.pokemon` is `null` or blank after trimming.

## 5. Dry-run checks

These read-only checks can be run manually before the import. They are not executed in this phase.

```sql
select cards.collection, count(*) as legacy_rows
from public.cards as cards
where cards.collection = 'Lars'
group by cards.collection;
```

```sql
select count(*) as skipped_missing_pokemon
from public.cards as cards
where cards.collection = 'Lars'
  and (cards.pokemon is null or trim(cards.pokemon) = '');
```

```sql
select count(*) as skipped_non_positive_quantity
from public.cards as cards
where cards.collection = 'Lars'
  and coalesce(cards.quantity, 1) <= 0;
```

```sql
select count(*) as importable_lars_rows
from public.cards as cards
where cards.collection = 'Lars'
  and cards.pokemon is not null
  and trim(cards.pokemon) <> ''
  and coalesce(cards.quantity, 1) > 0;
```

## 6. Lars main collection guard

The import must only proceed when there is exactly one Lars main collection. The SQL uses a `candidates` CTE and a count guard. If the count is not exactly one, the import inserts zero rows.

```sql
with candidates as (
  select collections.id as collection_id
  from public.collections as collections
  join public.profiles as profiles
    on profiles.id = collections.profile_id
  where profiles.username = 'lars'
    and collections.type = 'main'
), lars_main_collection as (
  select candidates.collection_id
  from candidates
  where (select count(*) from candidates) = 1
)
select collection_id
from lars_main_collection;
```

## 7. Catalog import SQL draft

The catalog insert uses `external_source = 'legacy_public_cards'` and `external_id = public.cards.id` for traceability and idempotency. It does not update existing rows on conflict.

```sql
begin;

with candidates as (
  select collections.id as collection_id
  from public.collections as collections
  join public.profiles as profiles
    on profiles.id = collections.profile_id
  where profiles.username = 'lars'
    and collections.type = 'main'
), lars_main_collection as (
  select candidates.collection_id
  from candidates
  where (select count(*) from candidates) = 1
), import_source as (
  select
    cards.id as legacy_card_id,
    cards.pokemon,
    cards.set_name,
    cards.number,
    cards.rarity,
    cards.image_small,
    cards.image_large,
    cards.cardmarket_url,
    cards.tcgplayer_url
  from public.cards as cards
  where cards.collection = 'Lars'
    and cards.pokemon is not null
    and trim(cards.pokemon) <> ''
    and coalesce(cards.quantity, 1) > 0
)
insert into public.cards_catalog (
  external_source,
  external_id,
  pokemon,
  set_name,
  number,
  rarity,
  image_small,
  image_large,
  cardmarket_url,
  tcgplayer_url
)
select
  'legacy_public_cards' as external_source,
  import_source.legacy_card_id::text as external_id,
  import_source.pokemon,
  import_source.set_name,
  import_source.number,
  import_source.rarity,
  import_source.image_small,
  import_source.image_large,
  import_source.cardmarket_url,
  import_source.tcgplayer_url
from import_source
where exists (select 1 from lars_main_collection)
on conflict (external_source, external_id) do nothing;

commit;
```

## 8. Collection ownership import SQL draft

The ownership insert uses `where not exists` for `public.collection_cards` idempotency and avoids conflict-based upserts for this table.

```sql
begin;

with candidates as (
  select collections.id as collection_id
  from public.collections as collections
  join public.profiles as profiles
    on profiles.id = collections.profile_id
  where profiles.username = 'lars'
    and collections.type = 'main'
), lars_main_collection as (
  select candidates.collection_id
  from candidates
  where (select count(*) from candidates) = 1
), legacy_source as (
  select
    cards.id as legacy_card_id,
    coalesce(cards.quantity, 1) as quantity,
    cards.condition,
    coalesce(cards.status, 'owned') as status,
    cards.added_at
  from public.cards as cards
  where cards.collection = 'Lars'
    and cards.pokemon is not null
    and trim(cards.pokemon) <> ''
    and coalesce(cards.quantity, 1) > 0
), ownership_source as (
  select
    lars_main_collection.collection_id,
    cards_catalog.id as card_catalog_id,
    legacy_source.quantity,
    legacy_source.condition,
    legacy_source.status,
    legacy_source.added_at
  from legacy_source
  join public.cards_catalog as cards_catalog
    on cards_catalog.external_source = 'legacy_public_cards'
   and cards_catalog.external_id = legacy_source.legacy_card_id::text
  cross join lars_main_collection
)
insert into public.collection_cards (
  collection_id,
  card_catalog_id,
  quantity,
  condition,
  status,
  added_at
)
select
  ownership_source.collection_id,
  ownership_source.card_catalog_id,
  ownership_source.quantity,
  ownership_source.condition,
  ownership_source.status,
  ownership_source.added_at
from ownership_source
where not exists (
  select 1
  from public.collection_cards as existing_collection_cards
  where existing_collection_cards.collection_id = ownership_source.collection_id
    and existing_collection_cards.card_catalog_id = ownership_source.card_catalog_id
);

commit;
```

## 9. Verification queries

These read-only checks can be run after a future manual import.

```sql
select count(*) as imported_catalog_rows
from public.cards_catalog as cards_catalog
where cards_catalog.external_source = 'legacy_public_cards';
```

```sql
with candidates as (
  select collections.id as collection_id
  from public.collections as collections
  join public.profiles as profiles
    on profiles.id = collections.profile_id
  where profiles.username = 'lars'
    and collections.type = 'main'
), lars_main_collection as (
  select candidates.collection_id
  from candidates
  where (select count(*) from candidates) = 1
)
select count(*) as imported_collection_rows
from public.collection_cards as collection_cards
join public.cards_catalog as cards_catalog
  on cards_catalog.id = collection_cards.card_catalog_id
cross join lars_main_collection
where collection_cards.collection_id = lars_main_collection.collection_id
  and cards_catalog.external_source = 'legacy_public_cards';
```

## 10. Rollback SQL draft

Rollback must delete imported ownership rows first and imported catalog rows second. It must never modify `public.cards`.

```sql
begin;

delete from public.collection_cards as collection_cards
using public.cards_catalog as cards_catalog
where collection_cards.card_catalog_id = cards_catalog.id
  and cards_catalog.external_source = 'legacy_public_cards';

delete from public.cards_catalog as cards_catalog
where cards_catalog.external_source = 'legacy_public_cards';

commit;
```

## 11. Non-goals

- No runtime application code is added or changed.
- No SQL is executed by this documentation phase.
- No real UUIDs, secrets, tokens, or production identifiers are documented.
- No data is imported for Lore in this first plan.
- No writes are made to `public.cards`.
