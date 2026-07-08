# Phase 2X — Read-only Collection Cards Service

## Doel

Deze fase activeert de eerste read-only kaartpreview na login. De app mag voor de ingelogde gebruiker controleren of profiel en hoofdcollectie bestaan en daarna een kleine preview laden uit de nieuwe collectiestructuur.

## Scope

- Hergebruik van de bestaande Supabase browser client.
- Hergebruik van de bestaande profile readiness en collection readiness flow.
- Alleen doorgaan bij een actieve sessie, bestaand profiel en bestaande hoofdcollectie.
- Tellen van `collection_cards` voor de hoofdcollectie.
- Laden van maximaal 12 previewkaarten met catalogusvelden uit `cards_catalog`.
- Tonen van een mobile-first previewkaart onder de bestaande collection readiness UI.

## Querypad

Het runtime querypad is:

```text
profiles -> collections -> collection_cards -> cards_catalog
```

De service gebruikt de `collection_id` van de gevonden hoofdcollectie als client-side filter voor `collection_cards`. Er wordt niet gefilterd op `auth_user_id` bij `collection_cards`.

De preview gebruikt twee read-only queries:

1. Een head/count query op `collection_cards` met `collection_id`.
2. Een select query op `cards_catalog` als root table met een inner join naar `collection_cards`, gefilterd op de hoofdcollectie, root-level gesorteerd op `pokemon`, `set_name` en `number`, met een limiet van 12 records.


## Phase 2Y — Preview Query Sorting Fix

Phase 2Y corrigeert alleen de read-only preview-query. De count-query blijft op `collection_cards` met de `collection_id` van de hoofdcollectie, maar de preview start nu vanuit `cards_catalog` als root table en gebruikt een inner join naar `collection_cards` om alleen kaarten uit de huidige hoofdcollectie te tonen.

Reden: de eerdere query startte vanuit `collection_cards` en sorteerde via nested `cards_catalog` velden met `referencedTable`. Die nested ordering gaf in de runtime preview geen betrouwbare alfabetische volgorde. Door root-level te sorteren op `cards_catalog.pokemon`, `cards_catalog.set_name` en `cards_catalog.number` sluit de app-preview aan op de directe Supabase controle waarin de eerste kaarten alfabetisch beginnen met Abra, Absol en Accelgor.

De mapping blijft read-only en splitst catalogusvelden (`pokemon`, `set_name`, `number`, `rarity`, `image_small`) van ownershipvelden (`quantity`, `condition`, `status`, `added_at`). Omdat Supabase geneste joinresultaten als object of array kan teruggeven, neemt de service robuust de eerste `collection_cards` ownership row. UUIDs worden niet getoond.

Data quality finding: sommige legacy rows bevatten nog technische kaartnamen of codes. Datacleanup is bewust out of scope voor Phase 2Y; deze fase wijzigt geen data en voert geen SQL uit.

## Read-only regels

Deze fase voegt geen schrijfacties toe. De service en UI doen geen:

- `insert`
- `update`
- `delete`
- `upsert`
- import
- edit UI
- delete UI
- add UI

## Security en RLS verwachting

RLS blijft de server-side beveiligingslaag. De client filtert daarnaast expliciet op de `collection_id` van de hoofdcollectie die via de readiness flow is gevonden. Foutmeldingen worden veilig gemaakt voordat ze in de UI verschijnen: URL's en UUID-achtige waarden worden verborgen en technische details worden afgekapt.

Deze fase wijzigt geen RLS policies, voert geen SQL uit en voegt geen secrets of UUIDs toe.

## Waarom `public.cards` niet gebruikt wordt

`public.cards` blijft legacy/importbron. Runtime kaartdata moet uit de nieuwe structuur komen, namelijk `collection_cards` met geneste `cards_catalog` gegevens. Daardoor gebruikt de app niet langer de legacy tabel als bron voor ingelogde collectiepreviewdata.

## Lars/Lore verwacht gedrag

- Lars: de hoofdcollectie bevat naar verwachting ongeveer 2190 `collection_cards`; de preview toont maximaal 12 kaarten.
- Lore: de hoofdcollectie blijft naar verwachting leeg; de UI toont netjes `Nog geen kaarten in deze collectie.` met count `0`.

## Non-goals

Deze fase activeert geen:

- volledige galerij
- binder
- wishlist
- pricing
- Pokémon TCG API
- AI
- localStorage/cache
- importfunctie
- database writes
- RLS wijzigingen
- SQL uitvoering

## Rollback

Rollback kan door de Phase 2X runtimebestanden en integratie te verwijderen:

- `src/features/collectionCards/collectionCardsPreviewTypes.ts`
- `src/features/collectionCards/collectionCardsPreviewService.ts`
- `src/features/collectionCards/CollectionCardsPreviewCard.tsx`
- `src/features/collectionCards/index.ts`
- de `CollectionCardsPreviewCard` import en render in `src/App.tsx`
- de bijbehorende styling in `src/styles.css`

Omdat er geen SQL, migrations, RLS wijzigingen of writes zijn toegevoegd, is er geen database rollback nodig.
