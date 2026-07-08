# Phase 2U — Legacy Cards Import Design

## 1. Doel

Deze fase ontwerpt hoe legacy data uit `public.cards` later veilig en gecontroleerd gemapt kan worden naar het nieuwe collectie-model.

Belangrijke grenzen voor deze fase:

- De import van legacy `public.cards` wordt nog niet uitgevoerd.
- `public.cards` blijft een legacy tabel en mag alleen als mogelijke importbron worden beschouwd.
- De nieuwe source of truth blijft `public.cards_catalog` + `public.collection_cards`.
- Runtime app-code mag `public.cards` niet gebruiken.
- Deze fase wijzigt geen runtime code, voert geen SQL uit en schrijft geen data.

## 2. Bekende legacy bron

De bekende legacy structuur van `public.cards` is:

- `id`
- `pokemon`
- `set_name`
- `number`
- `rarity`
- `condition`
- `quantity`
- `status`
- `collection`
- `added_at`
- `image_small`
- `image_large`
- `cardmarket_url`
- `tcgplayer_url`
- `created_at`

Bekende data-situatie:

- `public.cards` bevat ongeveer 2190 rijen.
- De bekende legacy records hebben `collection = 'Lars'`.
- De bekende legacy records hebben `status = 'owned'`.
- Lore heeft voorlopig geen legacy records in `public.cards`.

Belangrijke interpretaties:

- Legacy `collection` tekst is geen security boundary.
- Legacy `collection` tekst is alleen een import-mapping-hint.
- Legacy `id` wordt niet de definitieve kaart-id in de applicatie.
- Legacy `public.cards` blijft onaangeraakt tijdens een latere import.

## 3. Doelmodel

### `cards_catalog`

`public.cards_catalog` bevat algemene kaartdefinities:

- Wel: kaart-identiteit en algemene kaartmetadata.
- Niet: eigendom.
- Niet: `quantity`.
- Niet: `condition`.
- Niet: `status`.

### `collection_cards`

`public.collection_cards` bevat bezit per collectie:

- `collection_id`
- `card_catalog_id`
- `quantity`
- `condition`
- `status`
- `added_at`

### `collections`

`public.collections` bevat collecties per profiel:

- Lars hoofdcollectie bestaat al.
- Lore hoofdcollectie bestaat al.
- De eerste import van bestaande `public.cards` records gaat initieel alleen naar de Lars hoofdcollectie.

## 4. Mappingregels

Conceptuele mapping van legacy bron naar catalogus:

| Legacy veld | Doelveld |
| --- | --- |
| `public.cards.pokemon` | `cards_catalog.pokemon` |
| `public.cards.set_name` | `cards_catalog.set_name` |
| `public.cards.number` | `cards_catalog.number` |
| `public.cards.rarity` | `cards_catalog.rarity` |
| `public.cards.image_small` | `cards_catalog.image_small` |
| `public.cards.image_large` | `cards_catalog.image_large` |
| `public.cards.cardmarket_url` | `cards_catalog.cardmarket_url` |
| `public.cards.tcgplayer_url` | `cards_catalog.tcgplayer_url` |

Conceptuele mapping van legacy bron naar bezit:

| Legacy veld | Doelveld |
| --- | --- |
| `public.cards.quantity` | `collection_cards.quantity` |
| `public.cards.condition` | `collection_cards.condition` |
| `public.cards.status` | `collection_cards.status` |
| `public.cards.added_at` | `collection_cards.added_at` |

Conceptuele mapping van legacy collectie-tekst:

- `public.cards.collection = 'Lars'` map naar de Lars hoofdcollectie.
- `public.cards.collection = 'Lore'` kan later eventueel naar de Lore hoofdcollectie mappen.
- Onbekende `collection` values mogen niet automatisch geïmporteerd worden.

## 5. Catalog deduplicatie

Het importontwerp moet bepalen hoe `cards_catalog` unieke kaartdefinities krijgt.

### Veilig eerste voorstel

Canonical import key:

- `external_source = 'legacy_public_cards'`
- `external_id = public.cards.id`

Dit maakt de import zeer traceerbaar, maar kan betekenen dat elke legacy rij een aparte catalogusrecord wordt, zelfs als meerdere rijen conceptueel dezelfde kaart voorstellen.

### Beter toekomstig alternatief

Een toekomstige catalog identity kan gebaseerd worden op een combinatie van:

- `pokemon`
- `set_name`
- `number`
- `cardmarket_url` of `tcgplayer_url`, indien beschikbaar

Risico van dit alternatief:

- `set_name` kan ontbreken of inconsistent geschreven zijn.
- `number` kan ontbreken of inconsistent zijn.
- Externe URLs kunnen leeg, oud of inconsistent zijn.
- Te agressieve deduplicatie kan verschillende kaarten fout samenvoegen.

### Advies voor eerste veilige import

Voor de eerste veilige import gebruiken we:

- `external_source = 'legacy_public_cards'`
- `external_id = public.cards.id`

Redenen:

- Idempotenter: dezelfde legacy rij kan herkenbaar opnieuw verwerkt of overgeslagen worden.
- Traceerbaar: elke geïmporteerde catalogusrecord kan teruggeleid worden naar een legacy bronrij.
- Minder risico op fout samenvoegen van kaarten.
- Latere catalog deduplicatie kan apart ontworpen, getest en uitgevoerd worden.

## 6. Ownership mapping

Voor de eerste import wordt `collection = 'Lars'` gekoppeld aan de collectie waarvoor geldt:

- `profiles.username = 'lars'`
- `collections.type = 'main'`

Belangrijke veiligheidsnotities:

- `profile.username` is alleen een import-mapping-hint in SQL en geen runtime security boundary.
- `collection_id` komt uit `public.collections`.
- `auth_user_id` wordt niet gebruikt voor importmapping.
- Lore wordt niet gevuld zolang er geen legacy Lore data is.

## 7. Importveiligheid

Een latere import moet:

- Handmatig uitvoerbaar zijn.
- Idempotent zijn.
- Rollbackbaar zijn.
- `public.cards` read-only gebruiken als bron.
- `public.cards` niet wijzigen.
- Geen app writes gebruiken.
- Geen service in de frontend gebruiken.
- Geen secrets committen.
- Geen echte UUIDs in GitHub of ChatGPT plakken.
- Eerst dry-run tellingen tonen.

## 8. Dry-run analysequeries

Onderstaande SQL is alleen een read-only voorstel voor een toekomstige dry-run. Deze queries zijn in deze fase niet uitgevoerd.

```sql
select collection, status, count(*)
from public.cards
group by collection, status
order by collection, status;
```

```sql
select pokemon, set_name, number, count(*)
from public.cards
group by pokemon, set_name, number
having count(*) > 1
order by count(*) desc
limit 50;
```

```sql
select count(*) as total_legacy_cards
from public.cards;
```

```sql
select count(*) as rows_with_missing_pokemon
from public.cards
where pokemon is null or trim(pokemon) = '';
```

```sql
select count(*) as rows_with_missing_quantity
from public.cards
where quantity is null or quantity <= 0;
```

## 9. Conceptueel importplan

Een toekomstige import kan conceptueel in deze stappen verlopen:

1. Voer dry-run legacy analyse uit.
2. Controleer dat de Lars hoofdcollectie bestaat.
3. Insert `cards_catalog` records vanuit `public.cards`.
4. Insert `collection_cards` records naar de Lars hoofdcollectie.
5. Verify counts:
   - `public.cards` Lars rows.
   - `cards_catalog` imported legacy rows.
   - `collection_cards` rows voor de Lars hoofdcollectie.
6. Controleer een steekproef van enkele kaarten.
7. De app blijft nog steeds read-only.

## 10. Mogelijke risico's

- Duplicate catalog records.
- Ontbrekende `set_name` of `number`.
- Inconsistente `quantity`.
- `condition` nulls of condition-varianten die later duplicaten veroorzaken.
- `status` values buiten de toegestane lijst.
- Legacy `collection` tekst die verkeerd gespeld is.
- Image URLs die leeg, oud of niet meer geldig zijn.
- `public.cards` RLS is historisch breed en niet de finale security-inrichting.

## 11. Rollbackconcept

Er is in deze fase nog geen exacte rollback SQL nodig. Conceptueel moet rollback mogelijk zijn doordat:

- De import herkenbaar is via `external_source = 'legacy_public_cards'`.
- `collection_cards` terug te vinden zijn via gekoppelde `card_catalog` records.
- `public.cards` nooit verwijderd of gewijzigd wordt.

Rollback moet vóór echte nieuwe data gebeuren, of later zeer zorgvuldig worden ontworpen zodat echte nieuwe data niet per ongeluk verwijderd wordt.

## 12. Niet in scope

Expliciet niet in scope voor deze fase:

- Geen SQL execution.
- Geen import SQL finaliseren.
- Geen data schrijven.
- Geen runtime code.
- Geen app query naar `cards_catalog`.
- Geen app query naar `collection_cards`.
- Geen `public.cards` app query.
- Geen deduplicatie uitvoeren.
- Geen collectie UI met kaarten.
- Geen parent/admin.
- Geen pricing.
- Geen scanner.
- Geen AI.

## 13. Acceptatiecriteria

- Document beschrijft legacy bron.
- Document beschrijft doelmodel.
- Document beschrijft mappingregels.
- Document beschrijft importveiligheid.
- Document bevat dry-run analysequeries.
- Document beschrijft risico's.
- Document voert niets uit.
- Geen runtime code gewijzigd.
- Geen SQL/migration uitgevoerd.
- Geen app-query toegevoegd.
- Geen echte UUIDs of secrets toegevoegd.

## 14. Volgende fase voorstel

### Phase 2V — Legacy Cards Import SQL Plan

Doel: concrete SQL voorbereiden voor een idempotente, manuele import van `public.cards` naar `cards_catalog` en `collection_cards`, maar nog steeds niet uitvoeren.

## 15. Phase 2V — Legacy Cards Import SQL Plan

Status: documentation-only SQL plan. Deze SQL is voorbereid voor handmatige uitvoering in de Supabase SQL Editor, maar is in deze fase niet uitgevoerd.

### 15.1 Veiligheidsregels

- Voer eerst alle dry-run queries uit en controleer de resultaten handmatig.
- Stop als er `0` of meer dan `1` Lars hoofdcollectie bestaat.
- De import gebruikt geen `auth_user_id`; de mapping loopt via `profiles.username = 'lars'` en `collections.type = 'main'`.
- Als er `0` of meer dan `1` Lars hoofdcollectie is, retourneert de guarded importselectie `0` rows. De uitvoerder moet dan stoppen en de oorzaak oplossen voordat er opnieuw SQL wordt voorbereid of uitgevoerd.
- `status is null` wordt behandeld als `owned`.
- `quantity is null` wordt behandeld als `1`.
- `quantity <= 0` blijft ongeldig.
- `pokemon is null` of leeg blijft ongeldig.
- `public.cards` wordt alleen gelezen en nooit aangepast.
- Er zijn geen echte UUIDs of secrets nodig in dit plan.

### 15.2 Dry-run checks

```sql
-- Controleer of exact één Lars main collection bestaat.
with lars_main_collection_candidates as (
  select c.id
  from public.collections c
  join public.profiles p on p.id = c.profile_id
  where p.username = 'lars'
    and c.type = 'main'
)
select count(*) as lars_main_collection_count
from lars_main_collection_candidates;
```

```sql
-- Controleer legacy source data met dezelfde null-handling als de import.
select
  count(*) as total_legacy_cards,
  count(*) filter (
    where cards.pokemon is null
       or btrim(cards.pokemon) = ''
  ) as invalid_missing_pokemon,
  count(*) filter (
    where cards.quantity is not null
      and cards.quantity <= 0
  ) as invalid_non_positive_quantity,
  count(*) filter (
    where coalesce(cards.status, 'owned') not in ('owned', 'wishlist', 'trade', 'missing')
  ) as invalid_status,
  count(*) filter (
    where cards.pokemon is not null
      and btrim(cards.pokemon) <> ''
      and (cards.quantity is null or cards.quantity > 0)
      and coalesce(cards.status, 'owned') in ('owned', 'wishlist', 'trade', 'missing')
  ) as importable_cards
from public.cards cards;
```

```sql
-- Preview de genormaliseerde importregels zonder writes.
select
  cards.id as legacy_card_id,
  btrim(cards.pokemon) as pokemon_name,
  cards.card_number,
  cards.set_name,
  coalesce(cards.quantity, 1) as quantity,
  coalesce(cards.status, 'owned') as status
from public.cards cards
where cards.pokemon is not null
  and btrim(cards.pokemon) <> ''
  and (cards.quantity is null or cards.quantity > 0)
  and coalesce(cards.status, 'owned') in ('owned', 'wishlist', 'trade', 'missing')
order by cards.id;
```

### 15.3 Idempotente import SQL

De guard in `lars_main_collection` zorgt ervoor dat de import alleen rows selecteert als exact één Lars hoofdcollectie bestaat. Bij `0` of meer dan `1` kandidaat-collectie importeert de query `0` rows; stop dan en los eerst de datakwaliteit of seed-data op.

```sql
begin;

with lars_main_collection_candidates as (
  select c.id
  from public.collections c
  join public.profiles p on p.id = c.profile_id
  where p.username = 'lars'
    and c.type = 'main'
),
lars_main_collection as (
  select id
  from lars_main_collection_candidates
  where (select count(*) from lars_main_collection_candidates) = 1
),
legacy_cards as (
  select
    cards.id as legacy_card_id,
    btrim(cards.pokemon) as pokemon_name,
    cards.card_number,
    cards.set_name,
    coalesce(cards.quantity, 1) as quantity,
    coalesce(cards.status, 'owned') as status
  from public.cards cards
  where cards.pokemon is not null
    and btrim(cards.pokemon) <> ''
    and (cards.quantity is null or cards.quantity > 0)
    and coalesce(cards.status, 'owned') in ('owned', 'wishlist', 'trade', 'missing')
),
upsert_catalog as (
  insert into public.cards_catalog (
    external_source,
    external_id,
    name,
    card_number,
    set_name
  )
  select
    'legacy_public_cards' as external_source,
    legacy_cards.legacy_card_id::text as external_id,
    legacy_cards.pokemon_name as name,
    legacy_cards.card_number,
    legacy_cards.set_name
  from legacy_cards
  cross join lars_main_collection
  on conflict (external_source, external_id) do update set
    name = excluded.name,
    card_number = excluded.card_number,
    set_name = excluded.set_name
  returning id, external_id
)
insert into public.collection_cards (
  collection_id,
  card_catalog_id,
  quantity,
  status
)
select
  lars_main_collection.id as collection_id,
  upsert_catalog.id as card_catalog_id,
  legacy_cards.quantity,
  legacy_cards.status
from legacy_cards
join upsert_catalog on upsert_catalog.external_id = legacy_cards.legacy_card_id::text
cross join lars_main_collection
on conflict (collection_id, card_catalog_id) do update set
  quantity = excluded.quantity,
  status = excluded.status;

commit;
```

### 15.4 Verification queries

```sql
select count(*) as imported_catalog_cards
from public.cards_catalog
where external_source = 'legacy_public_cards';
```

```sql
select count(*) as imported_collection_cards
from public.collection_cards cc
join public.cards_catalog catalog on catalog.id = cc.card_catalog_id
where catalog.external_source = 'legacy_public_cards';
```

```sql
select
  cc.collection_id,
  catalog.external_id,
  catalog.name,
  cc.quantity,
  cc.status
from public.collection_cards cc
join public.cards_catalog catalog on catalog.id = cc.card_catalog_id
where catalog.external_source = 'legacy_public_cards'
order by catalog.external_id;
```

### 15.5 Rollback SQL

Rollback verwijdert eerst de collectie-koppelingen en daarna pas de catalogusregels. `public.cards` wordt nooit gewijzigd.

```sql
begin;

delete from public.collection_cards cc
using public.cards_catalog catalog
where cc.card_catalog_id = catalog.id
  and catalog.external_source = 'legacy_public_cards';

delete from public.cards_catalog
where external_source = 'legacy_public_cards';

commit;
```

### 15.6 Niet uitgevoerd in deze fase

- Geen SQL uitgevoerd.
- Geen runtime code gewijzigd.
- Geen data geschreven.
- Geen app-query toegevoegd.
