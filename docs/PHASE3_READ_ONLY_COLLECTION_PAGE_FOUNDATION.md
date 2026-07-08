# Phase 3A — Read-only Collection Page Foundation

## Doel

Phase 3A maakt de Collection-tab voor het eerst functioneel met echte read-only collectiekaarten uit de hoofdcollectie van de ingelogde gebruiker.

## Scope

- Alleen de huidige ingelogde gebruiker.
- Alleen het bestaande profiel en de main collection uit de readiness flow.
- Alleen read-only weergave van collectiekaarten.
- Alleen de Collection-tab toont deze pagina; Dashboard, Sets, Wishlist en Pokédex blijven placeholders.

## Querypad

1. De pagina gebruikt de bestaande collection readiness flow.
2. De count-query start vanuit `collection_cards` en filtert op de gevonden main collection.
3. De page-query start vanuit `cards_catalog` als root table.
4. De page-query gebruikt een inner join naar `collection_cards`.
5. De page-query filtert op `collection_cards.collection_id`.
6. De root-level sortering is `pokemon`, daarna `set_name`, daarna `number`.

Er is geen runtime query naar `public.cards`.

## Paginationbeleid

De page size staat vast op 24 kaarten.

- Pagina 1 gebruikt range `0..23`.
- Pagina 2 gebruikt range `24..47`.
- Volgende pagina's volgen hetzelfde patroon.

De UI toont Previous en Next en rendert maximaal één pagina tegelijk.

## Waarom maximaal 24 kaarten

De hoofdcollectie kan duizenden records bevatten. Door maximaal 24 kaarten te renderen, blijft de DOM klein en voorspelbaar. Dit voorkomt dat de eerste Collection-implementatie per ongeluk alle kaarten tegelijk laadt of rendert.

## iPhone performance rationale

Mobiele Safari en oudere iPhones reageren merkbaar slechter op grote grids met veel afbeeldingen. Een vaste server-side pagina van 24 kaarten beperkt netwerkverkeer, image decoding, layout work en memory pressure. Afbeeldingen gebruiken lazy loading om de initiële render verder te beperken.

## Read-only regels

Deze fase bevat geen add, edit, delete, import of sync functionaliteit. De UI bevat geen mutatieknoppen en de services gebruiken geen insert, update, delete of upsert calls.

## Security en RLS verwachting

De client vertrouwt op Supabase Auth en bestaande RLS om alleen toegestane records zichtbaar te maken. Foutmeldingen worden ingekort en ontdaan van URL's en UUID-achtige waarden voordat ze in de UI komen.

## Verwacht gedrag

### Lars

- Login werkt.
- Profiel wordt gevonden.
- Main collection wordt gevonden.
- Totaal aantal collectiekaarten wordt getoond.
- Pagina 1 toont maximaal 24 alfabetisch gesorteerde kaarten, beginnend bij vroege Pokémon zoals Abra en Absol wanneer die in de collectie zitten.
- Next laadt de volgende server-side pagina.

### Lore

- Login werkt.
- Profiel en main collection bestaan.
- Totaal is 0.
- De UI toont: `Nog geen kaarten in deze collectie.`
- Er verschijnt geen foutmelding.

## Non-goals

- Geen public.cards runtime query.
- Geen volledige 2190 render.
- Geen infinite scroll.
- Geen search, filters of sort UI.
- Geen binder, wishlist of pricing.
- Geen Pokémon TCG API.
- Geen AI.
- Geen localStorage of client cache.
- Geen RLS wijzigingen.
- Geen SQL uitvoering.
- Geen UUIDs, secrets of technische debugdetails tonen.

## Rollback

Rollback kan door de Phase 3A branch te reverten. De wijziging is beperkt tot de nieuwe collection page feature, de App-integratie, CSS en documentatie. Er zijn geen databasewijzigingen of RLS-wijzigingen nodig om terug te draaien.
