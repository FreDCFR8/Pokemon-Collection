# Pokémon Collection V3 — Roadmap

This document shows product direction and phase status. It intentionally avoids implementation detail and historical narrative.

## Status legend

- ✅ completed
- 🚧 active
- ⏳ planned
- 🔎 requires design or validation first

## Foundation

- ✅ clean V3 repository and stack
- ✅ authentication, profiles and collections
- ✅ normalized catalog and collection model
- ✅ RLS foundation
- ✅ stable project charter, decision log and working agreement

## Catalog and imports

- ✅ `cards_catalog` runtime source of truth
- ✅ `sets_catalog` canonical set metadata
- ✅ external-reference model
- ✅ controlled local import tooling
- ✅ dry-run default and explicit `--write`
- ✅ verified `sv3pt5` reference import
- 🚧 Phase 7B-2F1 — veilige multi-set dry-runvoorbereiding
- ⏳ broader catalog synchronization

## Catalog discovery

- ✅ Phase 7D-1A — global full-catalog search (read-only)
- ✅ Phase 7D-1B — add card from global search (PR125)
- ⏳ advanced catalog filters

## Sets, cards and collection

- ✅ grouped set progress and server-side set browsing
- ✅ bounded card loading and binder gallery
- ✅ shared Card Detail for Sets, Collection and Wishlist
- ✅ secure quantity and wishlist management
- ⏳ improved collection browsing and multi-collection improvements
- ⏳ wishlist management and read-model extensions

## Other product areas

- ⏳ missing workflow
- ⏳ condition and status editing
- ⏳ price synchronization and analytics
- ⏳ scanner and assisted identification
- ⏳ import/export improvements
- ⏳ Trade workflow — lowest priority

## Product focus

Catalogusdekking en collectiebeheer zijn de primaire productfocus. Trade staat expliciet op de laagste prioriteit.

## Planning rule

Before starting a large product area:

1. define the product flow;
2. define UX and reusable component boundaries;
3. inspect database and security requirements;
4. split implementation into small PR-sized phases;
5. begin coding only after the design is approved.

Roadmap order may change after analysis. Stability, data integrity, security and performance remain non-negotiable.
