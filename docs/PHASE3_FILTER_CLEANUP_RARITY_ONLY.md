# Phase 3G — Filter Cleanup Rarity Only

Phase 3G simplifies the read-only Collection filters after Phase 3F and keeps only the rarity filter.

## Runtime scope

- The Collection page keeps search, the rarity filter, reset filters, clear all, and server-side pagination.
- Page size remains fixed at exactly `24`.
- Count and page queries still root from `cards_catalog` and use `collection_cards!inner` with the main `collection_cards.collection_id` predicate.
- Search and rarity are applied together on both the count query and page query, so both queries keep identical predicates.
- Sorting remains fixed by `pokemon` ascending, `set_name` ascending, and `number` ascending.

## Rarity-only filter

The only runtime filter is `rarity`, using a fixed allowlist and an exact `cards_catalog.rarity` equality predicate.

The UI exposes these fixed options:

- Alle
- ACE SPEC Rare
- Black White Rare
- Common
- Double Rare
- Holo Rare
- Hyper Rare
- Illustration Rare
- MEGA_ATTACK_RARE
- Onbekend
- Promo
- Radiant Rare
- Rare
- Rare Holo
- Rare Holo V
- Rare Holo VMAX
- Rare Holo VSTAR
- Rare Rainbow
- Rare Ultra
- Shiny Rare
- Shiny Ultra Rare
- Special Illustration Rare
- Trainer Gallery Rare Holo
- Ultra Rare
- Uncommon

## Removed filters

Condition and status filters were removed because the read-only inspection showed that the current collection data does not benefit from filtering on them:

- `condition` is currently uniformly Near Mint.
- `status` is currently uniformly owned.

They are no longer part of `CollectionPageFilters`, filter sanitization, service predicates, filter UI, or active criteria text.

## Deferred set filter

No set filter is included in this phase.

The set filter is intentionally deferred until the Sets page or a canonical set catalog exists because current `set_name` values come only from cards already present in the collection and are therefore incomplete. A future set filter must be based on the full set list, not only on sets that happen to exist in the current collection.

This phase intentionally does not add:

- A set dropdown.
- `setName` to `CollectionPageFilters`.
- A `set_name` service predicate.
- A hardcoded set list.
- A dynamic set-options query.

## Deferred generation and type filters

Generation and type filters are not implemented in this phase because the required catalog data is not available yet:

- `generation` is not available in `cards_catalog`.
- `type` / `types` is not available in `cards_catalog`.
- A Generation filter for generations 1 through 9 can only be added after data enrichment.
- A Type filter can only be added after data enrichment.
- Future type labels should use English TCG-style terms such as Lightning, Fire, Water, Grass, Psychic, Fighting, Darkness, Metal, Dragon, and Colorless.

No Pokémon TCG API integration is added in this phase.

## Explicit non-goals

This phase does not include database changes, SQL execution, RLS changes, writes, public `cards` runtime queries, full collection fetches, client-side filtering over the full collection, dynamic filter-option queries, sort UI, add/edit/delete, binder features, wishlist functionality, pricing, external dependencies, localStorage/cache, AI, App shell changes, navigation changes, Pokédex changes, or a Sets page implementation.
