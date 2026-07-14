# Phase 7C-2F: Wishlist add/remove vanuit shared Card Detail

Status: PR116 open; deze fase is pas afgerond nadat PR116 is gemerged.

## Doel

Voeg vanuit shared Card Detail één kaart toe aan of verwijder die uit de wishlist van de actieve collectie; de Sets-flow blijft omkeerbaar.

## In scope

- hergebruik van de shared `CardDetailDialog`;
- dunne Sets mutation-adapter;
- herbruikbare `addCardToWishlist`-service met readiness-read, stabiele IDs, responsevalidatie en duplicate-safe gedrag;
- herbruikbare `removeCardFromWishlist`-service met exacte deletefilters, ownershipvalidatie, stale/conflict fail-closed gedrag en volledige responsevalidatie;
- pending, success, error en retry in Card Detail, met inert/onscrollbaar Sets op de achtergrond;
- gerichte RLS-migrations voor wishlist-insert en wishlist-delete, met `quantity = 1`, `condition = null` en één wishlist-rij per kaart per collectie;
- tests voor servicegedrag, duplicate-afhandeling, responsevalidatie en Sets Card Detail-contracten.
- regressietests voor bestaande wishlist-rijen met afwijkende collectie-, kaart-, status- of rij-identiteit.
- Sets add → remove → collection-add capability transition en Wishlist bounded-page refresh/clamping na verwijderen van de laatste kaart;

## Buiten scope

- `public.cards` en externe card-API-runtimecalls;
- Collection quantitybeheer;
- bounded Wishlist-paginatie blijft behouden; andere wishlist-schermen en bredere wishlistbeheeracties blijven buiten scope;
- merge en wijzigingen buiten deze fase.

## Verificatie

- volledige test-suite;
- actuele lokale teststand: 73/73 tests groen (`node --experimental-strip-types --test "tests/**/*.test.ts"`);
- `npm.cmd run build`;
- `git diff --check`;
- handmatige/mobile review van de Sets 151-flow en keyboard/pending/error/retrygedrag.

## Exacte changed files

- `docs/project/PROJECT_STATUS.md`
- `docs/project/ROADMAP.md`
- `docs/project/PR_DESCRIPTION_PHASE_7C-2F.md`
- `src/features/cardDetail/CardDetailDialog.tsx`
- `src/features/cardDetail/cardDetailMutationState.ts`
- `src/features/collectionCards/index.ts`
- `src/features/collectionCards/wishlistMutationService.ts`
- `src/features/setsPage/SetsPage.tsx`
- `src/features/setsPage/setCardDetailAdapter.ts`
- `src/features/wishlistPage/WishlistPage.tsx`
- `src/features/wishlistPage/index.ts`
- `src/features/wishlistPage/wishlistPageService.ts`
- `src/features/wishlistPage/wishlistPageTypes.ts`
- `supabase/migrations/20260714182541_collection_cards_wishlist_delete_security.sql`
- `tests/cardDetail/cardDetailWishlistActions.test.ts`
- `tests/collectionCards/wishlistDeleteSecurity.test.ts`
- `tests/collectionCards/wishlistMutationService.test.ts`
- `tests/setsPage/setCardDetailAdapter.test.ts`
- `tests/wishlistPage/wishlistCardDetailAdapter.test.ts`
