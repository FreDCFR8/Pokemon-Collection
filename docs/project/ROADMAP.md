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
- ✅ dry-run default and explicit `--write`
- ✅ verified `sv3pt5` reference import
- 🔎 controlled expansion to additional sets
- ⏳ broader catalog synchronization

## Sets and binder experience

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
- 🚧 Phase 7C-2D2A — shared ownership contracts, projector and read service
- ⏳ shared presentational Card Detail and page adapters
- ⏳ reuse in Collection
- ⏳ reuse in Wishlist, Trade and Search
- ⏳ extended characteristics and metadata
- ⏳ previous/next card navigation

## Collection experience

- ✅ collection overview, search, filters and pagination
- 🔎 Collection V2 product and architecture design
- ⏳ shared card detail integration
- ⏳ improved collection browsing and management
- ⏳ multi-collection improvements

## Catalog discovery

- ⏳ global full-catalog search
- ⏳ add card from global search
- ⏳ advanced catalog filters

## Collection states

- ⏳ wishlist UI
- ⏳ trade workflow
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

## Planning rule

Before starting a large product area:

1. define the product flow;
2. define UX and reusable component boundaries;
3. inspect database and security requirements;
4. split implementation into small PR-sized phases;
5. begin coding only after the design is approved.

Roadmap order may change after analysis. Stability, data integrity, security and performance remain non-negotiable.
