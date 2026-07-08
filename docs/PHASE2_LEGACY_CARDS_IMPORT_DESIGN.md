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
