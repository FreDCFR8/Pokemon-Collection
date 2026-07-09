# Phase 3F — Basic Collection Filters

Phase 3F adds simple server-side filters to the read-only Collection page.

## Scope

- Filters are applied to the existing `cards_catalog` root query with the existing `collection_cards!inner` ownership join.
- Search and filters are combined server-side for both the exact count query and the paged card query.
- Page size remains fixed at `24`.
- Sorting remains fixed by `pokemon`, `set_name`, and `number`.
- Filter option values are fixed in the UI for this phase and only include known safe values.
- Overige of afwijkende waarden worden in een latere fase via dynamische filteropties of datacleanup aangepakt, zonder daar nu extra runtime queries voor toe te voegen.

## Filters

- Rarity uses `cards_catalog.rarity`.
- Condition uses `collection_cards.condition`.
- Status uses `collection_cards.status`.

## Out of scope

No database changes, SQL execution, RLS changes, writes, full-collection client-side filtering, dynamic filter-option queries, sort UI, navigation changes, or `public.cards` runtime queries are included.


## Phase 3G follow-up

Phase 3G supersedes the Phase 3F filter set for the runtime Collection page by keeping only the rarity filter. Condition and status filters are removed because current inspected values are uniform, while set filtering is deferred until a Sets page or canonical set catalog can provide a complete set list. Generation and type filters remain future data-enrichment work because `cards_catalog` does not currently expose `generation` or `type`/`types` columns.
