# Phase 7C-2G: Wishlist naar collectie

## Doel

Maak het mogelijk om een wishlistkaart rechtstreeks vanuit Sets Card Detail of Wishlist Card Detail aan de actieve collectie toe te voegen. De wishlistrij verdwijnt daarbij atomair.

## In scope

- primaire Card Detail-actie `Aan collectie toevoegen` voor één geldige wishlistrij;
- secundaire actie `Van wishlist verwijderen` blijft beschikbaar;
- één herbruikbare `SECURITY INVOKER` Supabase RPC voor ownership-check, exacte wishlistvalidatie, conflictblokkade, wishlist-delete en owned Near Mint insert in één transactie;
- volledige frontend-validatie van de RPC-response;
- pending, succes, fout, stale/conflict en retry met behoud van `promote-wishlist`;
- Sets ownership/quantitybeheer en setprogress verversen na promotie;
- bounded Wishlist refresh en page clamping na promotie;
- gerichte SQL/security-contracttests en regressietests.

## Buiten scope

- nieuwe wishlist-gridacties;
- trade, missing, status- of conditionbewerking;
- runtimegebruik van externe card-API's;
- wijzigingen aan legacy `public.cards`;
- merge.

## Verificatie

- `node --experimental-strip-types --test "tests/**/*.test.ts"` — 84 passed;
- `npm.cmd run build` — passed; direct `npm run build` is blocked by the local PowerShell execution policy;
- `git diff --check` — passed;
- changed-file controle.

## Exacte changed files

- `.gitignore`
- `docs/project/PR_DESCRIPTION_PHASE_7C-2G.md`
- `docs/project/PROJECT_STATUS.md`
- `docs/project/ROADMAP.md`
- `src/features/cardDetail/CardDetailDialog.tsx`
- `src/features/collectionCards/index.ts`
- `src/features/collectionCards/wishlistPromotionService.ts`
- `src/features/setsPage/SetsPage.tsx`
- `src/features/setsPage/setCardDetailAdapter.ts`
- `src/features/wishlistPage/WishlistPage.tsx`
- `src/features/wishlistPage/wishlistPageTypes.ts`
- `src/styles.css`
- `supabase/migrations/20260714193000_phase_7c_2g_promote_wishlist_to_owned.sql`
- `supabase/migrations/20260714210000_phase_7c_2g_promote_wishlist_to_owned_without_collection_lock.sql`
- `tests/collectionCards/wishlistPromotionSecurity.test.ts`
- `tests/collectionCards/wishlistPromotionService.test.ts`
- `tests/setsPage/setCardDetailAdapter.test.ts`
- `tests/wishlistPage/wishlistCardDetailAdapter.test.ts`
