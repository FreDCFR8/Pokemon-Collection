# Phase 7C-2F — Wishlist add/remove vanuit shared Card Detail

Status: PR116 open; deze fase is pas afgerond nadat PR116 is gemerged.

## Doel

Voeg vanuit shared Card Detail één kaart toe aan of verwijder die uit de wishlist van de actieve collectie; de Sets-flow blijft omkeerbaar.

## In scope

- hergebruik van de shared `CardDetailDialog`;
- dunne Sets mutation-adapter;
- herbruikbare `addCardToWishlist`-service met readiness-read, stabiele IDs, responsevalidatie en duplicate-safe gedrag;
- herbruikbare `removeCardFromWishlist`-service met exacte deletefilters, ownershipvalidatie, stale/conflict fail-closed gedrag en volledige responsevalidatie;
- pending, success, error en retry in Card Detail, met inert/onscrollbaar Sets op de achtergrond;
- gerichte RLS/index migration voor `wishlist`, `quantity = 1`, `condition = null` en één wishlist-rij per kaart per collectie;
- tests voor servicegedrag, duplicate-afhandeling, responsevalidatie en Sets Card Detail-contracten.
- regressietests voor bestaande wishlist-rijen met afwijkende collectie-, kaart-, status- of rij-identiteit.
- Sets add → remove → collection-add capability transition en Wishlist bounded-page refresh/clamping na verwijderen van de laatste kaart;

## Buiten scope

- `public.cards` en externe card-API-runtimecalls;
- Collection quantitybeheer;
- Wishlist read-only paginatie of andere wishlist-schermen;
- merge en wijzigingen buiten deze fase.

## Verificatie

- volledige test-suite;
- `npm.cmd run build`;
- `git diff --check`;
- handmatige/mobile review van de Sets 151-flow en keyboard/pending/error/retrygedrag.
