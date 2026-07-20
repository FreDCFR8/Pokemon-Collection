# Pokémon Collection V3 — Roadmap

This document shows product direction and phase status. It intentionally avoids implementation detail and historical narrative.

## Status legend

- ✅ completed
- 🚧 active or next
- ⏳ planned
- 🔎 requires design or validation first

## Foundation

- ✅ clean V3 repository and stack
- ✅ authentication, profiles and collections
- ✅ normalized catalog and collection model
- ✅ RLS foundation
- ✅ stable project charter, decision log and working agreement
- ✅ documentation governance refresh

## Collection data and repair

- ✅ imported collection analysis
- ✅ duplicate import cleanup
- ✅ verified Lars baseline
- ✅ preservation of unresolved real placeholders
- ✅ explicit pagination for collection-scale reads

## Catalog and imports

- ✅ `cards_catalog` runtime source of truth
- ✅ `sets_catalog` canonical set metadata
- ✅ external-reference model
- ✅ search indexes
- ✅ controlled local import tooling
- ✅ dry-run default and explicit write authorization
- ✅ Phase 7B-2F1 through 7B-2F9E — controlled local-import foundation and Batch 1–3 operational processing
- ✅ idempotency hardening for legacy catalog details (PR144–PR146)
- ✅ local pinned dataset profile: 173 sets / 20,324 cards
- ⛔ PR147 bulk workflow closed without merge after technical review
- 🚧 Next: design-only reset for the 134 remaining sets; no bulk writer or write is approved yet
- 🔎 Manual-review sets remain excluded: `cel25c`, `sv9`, `swsh9`, `zsv10pt5`

## Sets and binder experience

The remaining catalog-import scope is paused pending a focused redesign. PR147 was closed without merge. The next work is design and read-only evidence only; automatic writes for remaining sets are not approved.

- ✅ grouped set progress
- ✅ server-side set search and sorting
- ✅ card loading in batches
- ✅ clean three-column binder grid
- ✅ subtle collection-presence indicator
- ✅ add card from opened set
- ✅ secure quantity management

## Card detail

- ✅ functional set-card detail flow
- ✅ Phase 7C-2D1 — shared Card Detail analysis and design
- ✅ Phase 7C-2D2A — shared ownership contracts, projector and read service
- ✅ Phase 7C-2D2B — shared collection-card mutation service
- ✅ Phase 7C-2D2C — shared presentational Card Detail and Sets adapter
- ✅ Phase 7C-2D2D — read-only reuse in Collection
- ✅ Phase 7C-2D2E — Collection Card Detail quantity management
- ✅ Phase 7C-2F — Wishlist add/remove vanuit shared Card Detail (PR116 afgerond)
- ✅ Phase 7C-2G — Wishlist naar collectie (PR118 afgerond)
- ✅ Phase 7C-2H — Wishlist en Collection binder-look
- ✅ Phase 7C-2L — Uniforme kaartgalerij voor Collection, Sets en Wishlist (PR123 afgerond)
- ✅ read-only reuse in Search (Phase 7D-1A)
- ✅ Collection and Wishlist management from Search (Phase 7D-1B / PR125)
- ⏳ reuse in Trade (lowest priority)
- ✅ extended characteristics and metadata
- ✅ previous/next card navigation (PR122 afgerond)

## Collection experience

- ✅ collection overview, search, filters and pagination
- 🔎 Collection V2 product and architecture design
- ✅ read-only shared card detail integration
- ✅ shared card detail quantity management
- ⏳ improved collection browsing and management
- ⏳ multi-collection improvements

## Catalog discovery

- ✅ Phase 7D-1A — global full-catalog search (read-only, PR124 afgerond)
- ✅ Phase 7D-1B — Collection- en Wishlistacties vanuit global Search (PR125)
- ⏳ advanced catalog filters

## Collection states

- ✅ wishlist add/remove vanuit shared Card Detail (PR116 afgerond)
- ✅ wishlist naar collectie vanuit Sets en Wishlist Card Detail
- ⏳ wishlist beheer en read-model uitbreidingen
- ⏳ trade workflow (lowest priority)
- ⏳ missing workflow
- ⏳ condition and status editing

## Data enrichment

- ⏳ price synchronization
- ⏳ price history and value analytics
- ⏳ richer card characteristics
- ⏳ alternative prints and relationships

## Assisted input

- ⏳ scanner and assisted card identification
- ⏳ import/export improvements

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
