# Phase 4A — Sets Page Foundation

## Samenvatting

Phase 4A maakt een echte `SetsPage` feature aan als read-only UI/foundation voor de Sets-tab. De pagina toont alleen een rustige foundation/empty state en bereidt de code-structuur voor op een latere integratie met een canonical set catalog.

## Wat is toegevoegd

- `src/features/setsPage/` als nieuwe feature-map.
- `SetsPage.tsx` als read-only Sets-pagina.
- `index.ts` als export boundary voor de feature.
- Koppeling van de bestaande Sets-tab naar `SetsPage` zonder navigatie-slugs te wijzigen.

## Canonical set catalog

Er is in deze fase nog geen canonical set catalog gekoppeld. Die catalog moet later de volledige Pokémon set-bron worden voor setoverzichten, set-details en voortgang per set.

De huidige `cards_catalog.set_name` waarden mogen niet als volledige setbron gebruikt worden. Deze waarden komen alleen uit kaarten die op dit moment in de collectie zitten en zijn daarom onvolledig als bron voor alle bestaande sets.

## Uitgestelde filters en enrichment

- De Collection set-filter blijft uitgesteld totdat er een canonical set catalog bestaat.
- Een generation-filter kan later mogelijk worden afgeleid uit de set catalog of uit aanvullende enrichment.
- Een type-filter vereist aparte card/type enrichment en is geen onderdeel van deze fase.

## Buiten scope

Deze fase bevat bewust geen:

- Databasewijzigingen.
- Runtime Supabase queries.
- Query op `cards_catalog`.
- Query op `collection_cards`.
- Query op `public.cards`.
- Pokémon TCG API integratie.
- Fake data, mock sets of hardcoded set-lijst.
- Collection set-filter, set-detailpagina of set progress berekening.
- Writes, inserts, updates, deletes of upserts.
