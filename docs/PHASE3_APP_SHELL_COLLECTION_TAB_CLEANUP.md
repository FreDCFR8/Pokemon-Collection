# Phase 3B — App Shell & Collection Tab Cleanup

## Doel

Phase 3B ruimt de app-shell op nadat Phase 3A de read-only Collection-tab technisch werkend maakte. De tabnavigatie heeft nu een duidelijke verantwoordelijkheid per scherm: Dashboard is voor technische status en readiness, Collection is voor de echte collectiepagina, en de overige tabs blijven placeholders.

## Probleem

Tijdens Phase 2 en Phase 3A stonden configuratie-, login-, readiness- en previewblokken boven de hoofdcontent. Daardoor verschenen dezelfde dashboard/debugblokken ook op de Collection-tab. Dat was tijdelijk nuttig voor validatie, maar maakt de Collection-tab onduidelijk nu daar echte collectiekaarten, paginering en totals staan.

## Nieuwe tabverdeling

- **Dashboard** toont de technische status- en readiness-stack:
  - Config readiness
  - Env config status
  - Auth readiness
  - Login panel
  - Profile readiness
  - Collection readiness
  - Collection Cards Preview
  - Profile status
  - Een dashboard/planning-placeholder
- **Collection** toont alleen de echte `CollectionPage`.
- **Sets** toont alleen de Sets-placeholder.
- **Wishlist** toont alleen de Wishlist-placeholder.
- **Pokédex** toont alleen de Pokédex-placeholder.

Hashnavigatie blijft behouden. Een lege of onbekende hash valt terug naar Dashboard, en de bestaande topnavigatie blijft `aria-current="page"` zetten op de actieve tab.

## Waarom Dashboard technische blokken houdt

De readiness-, login-, status- en previewkaarten blijven belangrijk om de Supabase-configuratie, sessie, profielkoppeling en collectievoorbereiding gecontroleerd te kunnen inspecteren. Dashboard is daarvoor de juiste plek omdat het expliciet een status- en ontwikkeloverzicht is, los van de gebruikerservaring van de collectiepagina.

## Waarom Collection alleen CollectionPage toont

De Collection-tab moet de echte collectie-ervaring isoleren. Door alleen `CollectionPage` te renderen, blijven de bestaande read-only collectiequery, totaalweergave, paginering van 24 kaarten per pagina en Previous/Next-flow intact zonder extra dashboardtekst of debugblokken erboven.

## Non-goals

- Geen databasewijzigingen.
- Geen SQL-uitvoering.
- Geen RLS-wijzigingen.
- Geen nieuwe Supabase queries.
- Geen runtime query naar `public.cards`.
- Geen `insert`, `update`, `delete` of `upsert` vanuit de app.
- Geen search/filter/sort UI.
- Geen collection UX polish buiten shell-cleanup.
- Geen binder-, wishlist-, pricing-, Pokémon TCG API-, AI-, localStorage- of cachefunctionaliteit.
- Geen externe routing library.

## Rollback

Rollback kan door de Phase 3B app-shell refactor terug te draaien. Daarmee komen de readiness-, login-, status- en previewblokken weer op shellniveau boven alle tabs te staan. Er zijn geen database-, SQL-, RLS- of datawijzigingen om terug te draaien.
