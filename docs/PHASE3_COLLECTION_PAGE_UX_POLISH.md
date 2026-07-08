# Phase 3C — Collection Page UX Polish

## Doel

Phase 3C verbetert alleen de gebruikerservaring van de bestaande read-only CollectionPage. De pagina blijft dezelfde paginated dataset gebruiken, met exact 24 kaarten per pagina en dezelfde count/pagination-aanpak als Phase 3A.

De focus ligt op rustiger scannen op mobiel, duidelijke metadata en minder frictie bij lange pagina's.

## Aangepakt

- De page summary toont nu duidelijk:
  - totaal aantal kaarten;
  - huidige pagina en totaal aantal pagina's;
  - 24 kaarten per pagina.
- Pagination staat boven én onder de kaartlijst, zodat gebruikers na scrollen niet terug naar boven hoeven.
- Kaarten zijn visueel rustiger gemaakt:
  - op smalle schermen staat de afbeelding boven de tekst;
  - vanaf bredere mobiele/tabletbreedte staat de afbeelding links;
  - naam, set/nummer, rarity en collectiegegevens zijn compacter gescheiden.
- Quantity, status en condition staan als kleine meta-badges bij de kaart.
- Missing images tonen een nette placeholder met de tekst “Geen afbeelding”, zonder gebroken image-icon.
- De loading state gebruikt een rustige laadtekst en behoudt eenvoudige ruimte om onnodige layout jump te beperken.
- Error state blijft veilig via de bestaande gesaneerde foutmelding uit de service.
- Er is een subtiele legacy-note toegevoegd: sommige kaartgegevens komen nog uit legacy-import en worden later opgeschoond.

## Bewust niet aangepakt

Deze fase voegt geen nieuwe datafunctionaliteit toe. Buiten scope blijven expliciet:

- databasewijzigingen;
- SQL, migraties of RLS-wijzigingen;
- extra Supabase queries;
- runtime queries op `public.cards`;
- writes zoals insert, update, delete of upsert;
- add/edit/delete UI;
- search, filters of sort UI;
- binder-, wishlist- of pricingfunctionaliteit;
- Pokémon TCG API-integratie;
- AI, localStorage, cache of externe dependencies.

## Waarom search, filters en datacleanup later komen

Search, filter en sort hebben gevolgen voor query-ontwerp, indexen, performance, lege states en toekomstige UX-keuzes. Dat hoort in een aparte fase zodat het datamodel en de Supabase-querygrenzen bewust kunnen worden gevalideerd.

Datacleanup van legacy-import is ook bewust uitgesteld. Deze fase verandert geen data en maskeert geen bronproblemen met runtime-transformations. De pagina toont alleen een subtiele gebruikersnote, zodat de huidige collectie bruikbaarer is zonder de importkwaliteit in code te corrigeren.

## Mobile performance rationale

De pagina blijft paginated met exact 24 kaarten per pagina. Er is geen infinite scroll en er wordt geen volledige collectie van 2190 kaarten gerenderd. Afbeeldingen behouden `loading="lazy"`, en de CSS gebruikt eenvoudige layoutregels zonder zware animaties of externe dependencies. Dit houdt de Collection-tab geschikt voor iPhone Safari en beperkt geheugen- en netwerkdruk.

## Missing image aanpak

Als `imageSmall` ontbreekt, rendert de UI geen `<img>`. In plaats daarvan verschijnt een lightweight placeholderkaart met de tekst “Geen afbeelding”. Daardoor ontstaat geen gebroken browser-icon en blijft de card layout voorspelbaar.

## Pagination boven + onder

De bestaande Previous/Next-functionaliteit blijft behouden. Dezelfde pagination-control wordt boven de lijst en onder de lijst getoond. Dit is vooral belangrijk op mobiel, waar 24 kaarten genoeg scrollafstand opleveren om een tweede control onderaan nuttig te maken.

## Rollback

Rollback kan door de Phase 3C commit terug te draaien. Dat verwijdert de UX-only wijzigingen in `CollectionPage.tsx`, `src/styles.css`, deze documentatie en de changelog-entry. Omdat er geen databasewijzigingen, writes, nieuwe queries of externe dependencies zijn toegevoegd, is er geen datarollback nodig.
