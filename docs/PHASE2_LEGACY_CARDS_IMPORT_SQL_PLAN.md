# Phase 2 — Legacy `public.cards` Import SQL Plan

## 1. Doel

Deze fase documenteert een concrete, idempotente SQL-planning voor een latere import van legacy `public.cards` naar het nieuwe collectie-model.

Belangrijke grenzen:

- Deze fase bereidt alleen concrete SQL voor.
- De SQL is bedoeld voor latere manuele uitvoering in de Supabase SQL Editor.
- De import wordt in deze fase niet uitgevoerd.
- `public.cards` blijft onaangeraakt en blijft alleen een legacy/importbron.
- App-code blijft read-only en mag `public.cards` niet gebruiken.
- De nieuwe source of truth blijft `public.cards_catalog` en `public.collection_cards`.
- Het eerste importdoel is alleen de Lars hoofdcollectie.
- Er worden geen echte UUIDs, secrets of Supabase-resultaten in GitHub of ChatGPT geplaatst.

## 2. Voorwaarden

Voor latere manuele uitvoering moeten deze voorwaarden waar zijn:

- `public.cards` bestaat en blijft de legacy/importbron.
- `public.profiles` bestaat.
- `public.collections` bestaat.
- `public.cards_catalog` bestaat.
- `public.collection_cards` bestaat.
- De Lars hoofdcollectie bestaat al in `public.collections`.
- De Lars hoofdcollectie is via een profiel te vinden met `profiles.username = 'lars'` en `collections.type = 'main'`.
- RLS blijft zoals bestaand; deze fase wijzigt geen RLS policies.
- De SQL Editor/import gebeurt handmatig en niet via de frontend.
- De frontend krijgt geen importfunctie en geen write-pad.
- De import gebruikt geen echte UUIDs in documentatie, GitHub, PR-tekst of ChatGPT.
- De uitvoerder controleert dry-run resultaten vóór write-SQL wordt uitgevoerd.

## 3. Dry-run queries

Onderstaande queries zijn read-only. Ze zijn bedoeld om vóór de import in de Supabase SQL Editor te controleren wat er in `public.cards` staat. Ze worden in deze fase niet uitgevoerd.

### 3.1 Legacy aantallen per collectie en status

```sql
select collection, status, count(*) as row_count
from public.cards
group by collection, status
order by collection, status;
```

### 3.2 Alleen Lars legacy rows tellen

```sql
select count(*) as lars_legacy_row_count
from public.cards
where collection = 'Lars';
```

### 3.3 Controleren of er niet-Lars legacy rows bestaan

```sql
select collection, count(*) as row_count
from public.cards
where collection is distinct from 'Lars'
group by collection
order by collection;
```

### 3.4 Statuswaarden controleren

```sql
select status, count(*) as row_count
from public.cards
where collection = 'Lars'
group by status
order by status;
```

### 3.5 Ongeldige statuswaarden voor `collection_cards` vinden

```sql
select status, count(*) as row_count
from public.cards
where collection = 'Lars'
  and status not in ('owned', 'wishlist', 'trade', 'missing')
group by status
order by status;
```

### 3.6 Ontbrekende verplichte catalogusvelden vinden

`cards_catalog.pokemon` is verplicht. Rijen zonder bruikbare Pokémon-naam moeten vóór import beoordeeld worden.

```sql
select count(*) as rows_with_missing_pokemon
from public.cards
where collection = 'Lars'
  and (pokemon is null or trim(pokemon) = '');
```

### 3.7 Ongeldige aantallen vinden

`collection_cards.quantity` moet groter zijn dan nul.

```sql
select count(*) as rows_with_invalid_quantity
from public.cards
where collection = 'Lars'
  and (quantity is null or quantity <= 0);
```

### 3.8 Potentiële conceptuele duplicaten bekijken

Deze query voert geen deduplicatie uit. Ze toont alleen waar latere catalogus-opschoning mogelijk nodig is.

```sql
select pokemon, set_name, number, count(*) as row_count
from public.cards
where collection = 'Lars'
group by pokemon, set_name, number
having count(*) > 1
order by row_count desc, pokemon, set_name, number
limit 50;
```

### 3.9 Lars hoofdcollectie vinden zonder UUID te publiceren

De uitvoerder mag de UUID lokaal in de Supabase SQL Editor zien, maar plaatst die niet in GitHub, PR-comments of ChatGPT.

```sql
select c.id, c.name, c.type, p.username
from public.collections c
join public.profiles p on p.id = c.profile_id
where p.username = 'lars'
  and c.type = 'main';
```

### 3.10 Bestaande legacy-import in `cards_catalog` tellen

```sql
select count(*) as existing_legacy_catalog_count
from public.cards_catalog
where external_source = 'legacy_public_cards';
```

### 3.11 Bestaande Lars legacy-koppelingen tellen

```sql
with lars_main_collection as (
  select c.id
  from public.collections c
  join public.profiles p on p.id = c.profile_id
  where p.username = 'lars'
    and c.type = 'main'
)
select count(*) as existing_lars_legacy_collection_cards_count
from public.collection_cards cc
join public.cards_catalog catalog on catalog.id = cc.card_catalog_id
join lars_main_collection lmc on lmc.id = cc.collection_id
where catalog.external_source = 'legacy_public_cards';
```

## 4. Import mapping

### 4.1 Catalogusmapping

| Legacy veld | Doelveld |
| --- | --- |
| `public.cards.id` | `cards_catalog.external_id` |
| vaste waarde `'legacy_public_cards'` | `cards_catalog.external_source` |
| `public.cards.pokemon` | `cards_catalog.pokemon` |
| `public.cards.set_name` | `cards_catalog.set_name` |
| `public.cards.number` | `cards_catalog.number` |
| `public.cards.rarity` | `cards_catalog.rarity` |
| `public.cards.image_small` | `cards_catalog.image_small` |
| `public.cards.image_large` | `cards_catalog.image_large` |
| `public.cards.cardmarket_url` | `cards_catalog.cardmarket_url` |
| `public.cards.tcgplayer_url` | `cards_catalog.tcgplayer_url` |

### 4.2 Bezitmapping

| Legacy veld | Doelveld |
| --- | --- |
| Lars hoofdcollectie uit `profiles` + `collections` | `collection_cards.collection_id` |
| gekoppelde `cards_catalog.id` | `collection_cards.card_catalog_id` |
| `public.cards.quantity` | `collection_cards.quantity` |
| `public.cards.condition` | `collection_cards.condition` |
| `public.cards.status` | `collection_cards.status` |
| `public.cards.added_at` | `collection_cards.added_at` |

### 4.3 Bewuste eerste importkeuze

Voor de eerste import wordt niet geprobeerd om kaarten conceptueel te dedupliceren op `pokemon`, `set_name`, `number` of URLs. De veilige importkey is:

- `cards_catalog.external_source = 'legacy_public_cards'`
- `cards_catalog.external_id = public.cards.id::text`

Dit maakt de import traceerbaar en idempotent per legacy rij.

## 5. Idempotente import SQL

Onderstaande SQL is bedoeld voor latere manuele uitvoering in de Supabase SQL Editor. Ze wordt in deze fase niet uitgevoerd.

### 5.1 Belangrijke uitvoeringsregel

Voer de write-SQL alleen uit als de dry-run controles aantonen dat:

- er exact één Lars hoofdcollectie gevonden wordt;
- Lars legacy rows de verwachte importscope vormen;
- er geen ongeldige `status` waarden zijn;
- er geen ontbrekende `pokemon` waarden zijn;
- er geen `quantity <= 0` of `quantity is null` waarden zijn.

`collection_cards` gebruikt hieronder bewust `where not exists` met `is not distinct from` voor `condition`, omdat een nullable `condition` in Postgres anders meerdere `null`-combinaties kan toelaten ondanks een unique constraint.

### 5.2 Transactionele import

```sql
begin;

with lars_main_collection as (
  select c.id
  from public.collections c
  join public.profiles p on p.id = c.profile_id
  where p.username = 'lars'
    and c.type = 'main'
), import_source as (
  select
    cards.id::text as legacy_card_id,
    trim(cards.pokemon) as pokemon,
    cards.set_name,
    cards.number,
    cards.rarity,
    cards.image_small,
    cards.image_large,
    cards.cardmarket_url,
    cards.tcgplayer_url,
    cards.quantity,
    cards.condition,
    cards.status,
    cards.added_at
  from public.cards cards
  where cards.collection = 'Lars'
    and cards.status in ('owned', 'wishlist', 'trade', 'missing')
    and cards.pokemon is not null
    and trim(cards.pokemon) <> ''
    and cards.quantity is not null
    and cards.quantity > 0
), inserted_catalog as (
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
    'legacy_public_cards',
    import_source.legacy_card_id,
    import_source.pokemon,
    import_source.set_name,
    import_source.number,
    import_source.rarity,
    import_source.image_small,
    import_source.image_large,
    import_source.cardmarket_url,
    import_source.tcgplayer_url
  from import_source
  on conflict (external_source, external_id) do nothing
  returning id, external_id
), catalog_for_import as (
  select catalog.id, catalog.external_id
  from public.cards_catalog catalog
  join import_source on import_source.legacy_card_id = catalog.external_id
  where catalog.external_source = 'legacy_public_cards'
), inserted_collection_cards as (
  insert into public.collection_cards (
    collection_id,
    card_catalog_id,
    quantity,
    condition,
    status,
    added_at
  )
  select
    lars_main_collection.id,
    catalog_for_import.id,
    import_source.quantity,
    import_source.condition,
    import_source.status,
    coalesce(import_source.added_at::date, current_date)
  from import_source
  cross join lars_main_collection
  join catalog_for_import on catalog_for_import.external_id = import_source.legacy_card_id
  where not exists (
    select 1
    from public.collection_cards existing_cc
    where existing_cc.collection_id = lars_main_collection.id
      and existing_cc.card_catalog_id = catalog_for_import.id
      and existing_cc.condition is not distinct from import_source.condition
      and existing_cc.status = import_source.status
  )
  returning id
)
select
  (select count(*) from import_source) as source_rows,
  (select count(*) from inserted_catalog) as inserted_catalog_rows,
  (select count(*) from inserted_collection_cards) as inserted_collection_card_rows;

commit;
```

## 6. Post-import verificatiequeries

Onderstaande queries zijn bedoeld voor na latere manuele uitvoering. Ze worden in deze fase niet uitgevoerd.

### 6.1 Catalogusrecords tellen

```sql
select count(*) as legacy_catalog_count
from public.cards_catalog
where external_source = 'legacy_public_cards';
```

### 6.2 Lars collection cards tellen

```sql
with lars_main_collection as (
  select c.id
  from public.collections c
  join public.profiles p on p.id = c.profile_id
  where p.username = 'lars'
    and c.type = 'main'
)
select count(*) as lars_legacy_collection_cards_count
from public.collection_cards cc
join public.cards_catalog catalog on catalog.id = cc.card_catalog_id
join lars_main_collection lmc on lmc.id = cc.collection_id
where catalog.external_source = 'legacy_public_cards';
```

### 6.3 Bron versus doel vergelijken

```sql
with source_count as (
  select count(*) as row_count
  from public.cards
  where collection = 'Lars'
    and status in ('owned', 'wishlist', 'trade', 'missing')
    and pokemon is not null
    and trim(pokemon) <> ''
    and quantity is not null
    and quantity > 0
), imported_count as (
  select count(*) as row_count
  from public.cards_catalog
  where external_source = 'legacy_public_cards'
)
select
  source_count.row_count as source_rows,
  imported_count.row_count as imported_catalog_rows,
  source_count.row_count = imported_count.row_count as counts_match
from source_count, imported_count;
```

### 6.4 Steekproef zonder echte UUID te publiceren

```sql
select
  catalog.external_id,
  catalog.pokemon,
  catalog.set_name,
  catalog.number,
  cc.quantity,
  cc.condition,
  cc.status,
  cc.added_at
from public.collection_cards cc
join public.cards_catalog catalog on catalog.id = cc.card_catalog_id
where catalog.external_source = 'legacy_public_cards'
order by catalog.pokemon, catalog.set_name, catalog.number
limit 25;
```

## 7. Rollback SQL voor de handmatige import

Rollback mag alleen gebruikt worden zolang er nog geen andere echte data afhankelijk is van de geïmporteerde legacy catalogusrecords.

De rollback verwijdert eerst gekoppelde `collection_cards` en daarna de herkenbare legacy `cards_catalog` records. `public.cards` wordt niet gewijzigd.

```sql
begin;

with legacy_catalog as (
  select id
  from public.cards_catalog
  where external_source = 'legacy_public_cards'
), deleted_collection_cards as (
  delete from public.collection_cards cc
  using legacy_catalog
  where cc.card_catalog_id = legacy_catalog.id
  returning cc.id
), deleted_catalog as (
  delete from public.cards_catalog catalog
  using legacy_catalog
  where catalog.id = legacy_catalog.id
  returning catalog.id
)
select
  (select count(*) from deleted_collection_cards) as deleted_collection_card_rows,
  (select count(*) from deleted_catalog) as deleted_catalog_rows;

commit;
```

## 8. Veiligheidsnotities

- `public.cards.collection = 'Lars'` is alleen een import-mapping-hint en geen security boundary.
- `profiles.username = 'lars'` is alleen een handmatige import-hint en geen runtime security boundary.
- De import mag niet via app-code, frontend, API-route of GitHub Actions uitgevoerd worden.
- `public.cards` blijft legacy en wordt niet gewijzigd of verwijderd.
- Runtime app-code mag niet naar `public.cards` verwijzen.
- Deze fase wijzigt geen RLS.
- Deze fase wijzigt geen migrations.
- Deze fase wijzigt geen GitHub Actions of Vercel workflow.
- Deze fase voert geen SQL uit.

## 9. Niet in scope

Expliciet niet in scope voor deze fase:

- Geen import uitvoeren.
- Geen SQL uitvoeren.
- Geen migration toevoegen of uitvoeren.
- Geen data schrijven.
- Geen runtime code wijzigen.
- Geen app-query toevoegen.
- Geen RLS wijzigen.
- Geen `public.cards` gebruik in app-code.
- Geen GitHub Actions wijzigen.
- Geen Vercel workflow wijzigen.
- Geen echte UUIDs of secrets toevoegen.
- Geen AI.
- Geen Binder.
- Geen pricing.
- Geen scanner.
