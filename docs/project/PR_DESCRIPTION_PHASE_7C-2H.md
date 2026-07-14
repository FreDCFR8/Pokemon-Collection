# Phase 7C-2H: Wishlist en Collection binder-look

## Doel

Maak Wishlist en Collection image-first en rustig, met dezelfde binder/card-image prioriteit als Sets.

## In scope

- gedeelde kleine binder tile/grid-presentatie voor Sets-stijl kaartafbeeldingen;
- Wishlist- en Collection-overzichten als bounded image-first grids;
- bestaande pagination, search/filter, Card Detail, wishlistmutaties en quantitybeheer behouden;
- loading, empty, error en retry behouden.

## Buiten scope

- databasewijzigingen, Supabase migrations of database push;
- nieuwe acties in grids;
- trade/missing/status/condition editing;
- global search, runtime externe card-API of Collection V2-herbouw;
- volledige design-system refactor;
- merge.

## Verificatie

- `node --experimental-strip-types --test "tests/**/*.test.ts"`;
- `npm.cmd run build`;
- `git diff --check`;
- exacte changed-file controle;
- handmatige preview/device-check van mobile-first grid, detaildialog en bounded desktoplayout.

## Exacte changed files

- docs/project/PR_DESCRIPTION_PHASE_7C-2H.md
- docs/project/PROJECT_STATUS.md
- docs/project/ROADMAP.md
- src/components/BinderCardGrid.tsx
- src/features/collectionPage/CollectionPage.tsx
- src/features/wishlistPage/WishlistPage.tsx
- src/styles.css
