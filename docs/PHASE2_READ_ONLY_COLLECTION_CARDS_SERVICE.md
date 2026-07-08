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
2. Een select query op `collection_cards` met geneste `cards_catalog` velden, gesorteerd op `pokemon`, `set_name` en `number`, met een limiet van 12 records.

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
