# Visual Design Agreement

Dit document legt de bindende visuele werkwijze vast voor Pokémon Collection V3.

## Bron van waarheid

De visuele stijl van de app is gemeenschappelijk en wordt centraal beheerd via het design system en de gedeelde UI-foundation.

Pagina's mogen niet zelfstandig hun eigen kleuren, oppervlakken, radii, schaduwen, invoervelden, knoppen, badges, loading states, empty states of foutstaten definiëren wanneer daarvoor een gedeelde primitive bestaat.

## Verplichte regels

1. Nieuwe pagina's en redesigns gebruiken eerst de gedeelde primitives en tokens.
2. Hardgecodeerde witte of lichte surfaces zijn niet toegestaan buiten een bewust goedgekeurde component, zoals Card Detail.
3. Pagina-specifieke CSS mag alleen layout, inhoudsspecifieke positionering en uitzonderlijke interactie regelen.
4. Visuele basiseigenschappen komen uit gedeelde tokens:
   - kleuren;
   - borders;
   - radii;
   - shadows;
   - spacing;
   - typography;
   - focus states;
   - controls;
   - loading, empty en error states.
5. Een pagina-redesign verwijdert oude overlappende CSS voor die pagina in plaats van nieuwe overrides bovenop oude regels te stapelen.
6. Tijdelijke compatibiliteitsselectors moeten centraal in `src/ui/app-foundation-compat.css` staan en worden verwijderd zodra de betrokken pagina naar gedeelde primitives is gemigreerd.
7. Dashboard en Card Detail zijn de visuele referenties voor sfeer, contrast, hiërarchie en afwerking.
8. Elke PR controleert expliciet dat geen dubbele selectors of conflicterende visuele regels zijn toegevoegd.
9. iPhone-preview is verplicht voor merge van visuele wijzigingen.

## Redesign-volgorde

Per pagina:

1. bestaande markup en CSS auditen;
2. gedeelde page, surface, toolbar, control en state-primitives toepassen;
3. overtollige uitleg en duplicatie verwijderen;
4. oude pagina-specifieke visuele regels verwijderen;
5. tijdelijke compatibility-selectors reduceren;
6. desktop en iPhone-preview controleren;
7. pas daarna mergen.

## Niet toegestaan

- losse witte kaarten of invoervelden toevoegen;
- nieuwe pagina-eigen design tokens introduceren;
- dezelfde component op meerdere pagina's opnieuw stylen;
- regressies verbergen met steeds specifiekere selectors;
- meerdere stijllagen laten bestaan zonder migratieplan.
