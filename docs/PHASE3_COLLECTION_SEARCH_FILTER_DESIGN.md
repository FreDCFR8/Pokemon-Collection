# Phase 3D — Collection Search & Filter Design

## Status

Design/documentation only. This phase does not change runtime code, UI, Supabase queries, SQL, RLS, database schema, imports, or data.

## Goals

Design a safe future path for adding search and filters to the read-only `CollectionPage` while preserving the current collection data flow:

- Supabase Auth remains the authentication boundary for Lars and Lore.
- `profiles`, `collections`, `cards_catalog`, and `collection_cards` remain the collection model.
- The Collection page remains read-only.
- Page size stays exactly `24`.
- Pagination stays server-side.
- Collection page queries keep `cards_catalog` as the root table with an inner `collection_cards` filter for the signed-in user's main collection.
- RLS remains the final security boundary.
- Pokédex navigation through `#pokedex` is unrelated and must not be affected.

## Non-goals

This phase intentionally does not include:

- Runtime code changes.
- Search UI implementation.
- Filter UI implementation.
- New Supabase queries.
- SQL execution.
- Database migrations.
- RLS policy changes.
- Any write operation, including insert, update, delete, or upsert.
- Runtime access to legacy `public.cards`.
- Local storage, client caches, or offline indexes.
- External dependencies.
- Pokémon TCG API usage.
- AI-based search, cleanup, or enrichment.
- Binder, wishlist, pricing, or price filters.

## Current baseline to preserve

The future implementation should preserve the existing read-only Collection architecture:

1. Resolve the signed-in user through Supabase Auth.
2. Resolve the user's profile.
3. Resolve the user's main collection.
4. Count matching `collection_cards` separately.
5. Query visible cards from `cards_catalog` as root.
6. Join/filter through `collection_cards!inner` for the current `mainCollectionId`.
7. Sort by `pokemon`, `set_name`, and `number`.
8. Fetch only the requested page, with page size fixed to `24`.

## Search scope

### Phase 3E v1 search fields

Search should initially match only catalog fields that are already shown or naturally searchable in the collection grid:

- Pokémon name: `cards_catalog.pokemon`.
- Set name: `cards_catalog.set_name`.
- Card number: `cards_catalog.number`.

The search input should be treated as a simple user-entered text query. It should not correct data, hide legacy data issues, or infer canonical Pokémon names.

### Later optional search field

- Rarity: `cards_catalog.rarity` may be added later if it proves useful, but rarity is better modeled as a structured filter first.

### Full-text search decision

Do not introduce a full-text engine in v1. The expected collection size is small enough for indexed server-side `ilike` or equivalent simple predicates, and full-text search would add migration, ranking, language, and operational complexity before the UX is proven. Full-text search can be reconsidered only after simple server-side search is implemented and measured.

## Filter scope

### Phase 3F v1 filters

Initial filters should be structured and conservative:

- `cards_catalog.rarity`.
- `collection_cards.condition`.
- `collection_cards.status`.

These fields map directly to existing catalog or ownership metadata and do not require new product concepts.

### Later optional filters

- Has image / missing image may be useful later because legacy data can contain missing images.

### Explicitly excluded filters

Do not add these filter types in the first collection filter implementation:

- Price filters.
- Wishlist filters.
- Binder filters.
- Ownership goals.
- Deck filters.
- External market filters.

## Query strategy

Future search/filter implementation should remain server-side and should keep the existing query shape.

### Root query

Keep `cards_catalog` as the root query. This preserves root-level sorting by catalog fields and avoids switching the Collection page back to ownership-rooted data loading.

### Collection ownership filter

Keep an inner relation filter through `collection_cards!inner` scoped to the resolved `mainCollectionId`. Search and filters must never remove this ownership constraint.

Conceptual future shape:

```text
cards_catalog
  select catalog fields plus collection_cards!inner ownership fields
  where collection_cards.collection_id = mainCollectionId
  optional catalog search predicates
  optional catalog filters
  optional ownership filters
  order by pokemon, set_name, number
  range for page size 24
```

### Count query

Keep the count query separate. The count must use the same search and filter predicates as the page query so pagination reflects the filtered result set. The count query should remain read-only and scoped to the same `mainCollectionId`.

### Pagination rules

- Page size remains exactly `24`.
- Search and filter changes reset pagination to page `1`.
- Server-side range calculation should continue to request only the active page.
- Sorting stays fixed for now: `pokemon`, then `set_name`, then `number`.
- No infinite scroll in the first implementation.

## Performance design

The future implementation must avoid loading the full collection into the browser.

Required performance rules:

- Never load all 2190 cards client-side for search or filtering.
- Do not filter the complete collection in React state.
- Apply search and filter predicates server-side.
- Keep the visible page request limited to exactly `24` rows.
- Debounce the search field in a later implementation phase before sending a server request.
- Avoid firing a request for every keystroke.
- Show a clear loading state while a new filtered page is loading.
- Keep query payloads minimal for iPhone use by selecting only fields needed by the Collection grid.
- Avoid localStorage or custom client cache layers in the first implementation.

A practical debounce target for the later implementation is approximately 300–500 ms, but the exact value should be chosen during implementation and tested on mobile.

## Index and migration design notes

No SQL should be executed in this phase. The following are future migration notes only.

Likely useful future indexes:

- `cards_catalog.pokemon` for Pokémon-name search and sorting.
- `cards_catalog.set_name` for set-name search and sorting.
- `cards_catalog.number` for card-number search and sorting.
- `cards_catalog.rarity` for rarity filtering.
- `collection_cards.collection_id` for collection scoping.
- `collection_cards.status` for ownership-status filtering.
- `collection_cards.condition` for condition filtering.

If simple `ilike` search is slow after implementation, consider a later migration using trigram indexes or full-text search. That decision should be based on measured query behavior, not added preemptively in Phase 3E.

## UX design

The future UI should be mobile-first and should not introduce modals in the first implementation.

### Layout

Recommended order on `CollectionPage`:

1. Existing page title and collection summary.
2. Search field.
3. Compact filter section or filter buttons.
4. Active filter summary chips.
5. Reset filters button when search or filters are active.
6. Existing pagination controls.
7. Existing card grid.
8. Existing bottom pagination controls.

### Search input

- Single search field above the card grid.
- Placeholder should describe scope, for example: search by Pokémon, set, or number.
- Search should not expose implementation details or table names.
- Search changes reset to page `1`.

### Filters

- Use compact controls suitable for small screens.
- Start with simple single-select or multi-select controls only where implementation remains clear.
- Clearly show active filters.
- Provide a reset filters action.
- Avoid modal drawers in the first implementation.

### Empty state

When no results match the active search/filter combination, show a friendly empty state that:

- Says no cards matched the current search/filter combination.
- Offers a reset action.
- Does not imply cards are missing from the database.
- Does not show UUIDs or debug details.

## Legacy-data impact

Search and filters must reflect current data honestly.

Known legacy-data constraints:

- Some Pokémon names may still be technical or non-display-friendly names.
- Some card images may be missing.
- Search results may therefore look imperfect until data cleanup happens.

Rules:

- Search must not correct legacy technical names.
- Search must not mask or rewrite catalog data.
- Missing images should continue to use the existing missing-image presentation.
- Data cleanup remains a separate phase.

## Security design

Search and filters must not weaken the existing data boundary.

Requirements:

- Do not show UUIDs in the UI.
- Do not show technical debug details in the UI.
- Do not query legacy `public.cards` at runtime.
- Do not add writes.
- Do not add insert, update, delete, or upsert paths.
- Keep RLS as the final enforcement layer.
- Keep the query scoped to the signed-in user's main collection.
- Search/filter predicates must be additive to the collection ownership filter, never alternatives to it.
- A user must never be able to see another user's collection through search, filters, counts, or pagination metadata.

## Suggested follow-up phases

### Phase 3E — Simple Collection Search Implementation

Implement server-side search only:

- Add one search field on `CollectionPage`.
- Search `pokemon`, `set_name`, and `number`.
- Keep page size `24`.
- Reset to page `1` on search changes.
- Add debounce.
- Keep existing fixed sort.
- Keep separate count and page queries.
- Do not add filters yet.

This should come first because it validates the query extension and loading-state behavior with the smallest UX surface.

### Phase 3F — Basic Collection Filters Implementation

Add structured filters after search is stable:

- Rarity.
- Condition.
- Status.
- Active filter display.
- Reset filters action.
- Empty state for no results.

This should follow search because filters add more query combinations and require careful count/page parity.

### Phase 3G — Data Cleanup Plan

Plan legacy catalog cleanup separately:

- Technical Pokémon names.
- Missing images.
- Any normalization needed for search quality.
- Verification queries and rollback plan.

This should not be mixed into search/filter implementation because search must not silently correct or mask source data.

## Acceptance checklist

- Design remains documentation-only.
- Server-side search/filter is the chosen direction.
- `cards_catalog` remains the root query.
- `collection_cards!inner` remains scoped to `mainCollectionId`.
- RLS remains the final security layer.
- Count query remains separate.
- Page size remains exactly `24`.
- Search/filter changes reset pagination to page `1`.
- Fixed sort remains `pokemon`, `set_name`, `number`.
- No runtime files are changed.
- No SQL is executed.
- No RLS changes are made.
- No writes are introduced.
- Follow-up phases are defined.
