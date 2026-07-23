# Shared Page Architecture

Deze architectuur geldt voor de hoofdpagina's van Pokémon Collection V3.

## Vaste opbouw

Elke hoofdpagina bestaat uit maximaal vier visuele zones:

1. `PageHeader`
   - centrale paginatitel;
   - optionele acties links of rechts;
   - geen grote omliggende kaart of panel.

2. `PageToolbar`
   - zoekveld;
   - horizontaal scrollbare filters en sortering;
   - controls blijven op één rij wanneer de schermbreedte beperkt is.

3. `PageContent`
   - kaartgrid, lijst of inhoud;
   - content staat rechtstreeks op het gedeelde canvas;
   - geen overbodige buitencontainer rond grids.

4. `BottomNavigation`
   - vaste gedeelde navigatie;
   - visueel los van de content;
   - content reserveert voldoende onderruimte zodat niets achter de navigatie verdwijnt.

## Verplichte principes

- Gedeelde kleuren, spacing, radii, shadows, controls en states komen uit de UI-foundation.
- Pagina-CSS regelt alleen pagina-opbouw en uitzonderlijke interactie.
- Zoekvelden en filters hebben op alle hoofdpagina's dezelfde maatvoering en interactie.
- Filterrijen zijn horizontaal scrollbaar op mobiel en veroorzaken geen tweede regel.
- Kaartgrids krijgen maximale bruikbare breedte en worden centraal uitgelijnd.
- Grote geneste surfaces en meerdere kaders rond dezelfde inhoud zijn niet toegestaan.
- Nieuwe filters worden pas zichtbaar gemaakt wanneer de query- en servicelaag ze betrouwbaar ondersteunt.

## Collection V2

Collection is de eerste toepassing van deze architectuur:

- titel `Mijn collectie` centraal;
- zoekveld direct onder de titel;
- filterbediening horizontaal en compact;
- kaartgrid zonder grote buitenste surface;
- voldoende vrije ruimte boven de bottom navigation.

De bestaande functionele filters `Rarity` en `Set` blijven behouden. Sortering, kaarttype en energietype worden in een vervolgstap toegevoegd samen met ondersteuning in types, service en querylaag; er worden geen niet-functionele controls getoond.

## Migratie van volgende pagina's

Voor Wishlist, Sets, Pokédex en Zoeken:

1. bestaande markup en lokale visuele CSS auditen;
2. deze vier zones toepassen;
3. gedeelde primitives gebruiken;
4. oude overlappende pagina-CSS verwijderen;
5. compatibility-selectors reduceren;
6. iPhone-preview uitvoeren voor merge.
