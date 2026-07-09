# Phase 4P — Full Sets Catalog Expansion Plan

## 1. Status

Phase 4P is planning only.

This phase documents the long-term product and data direction for `public.sets_catalog`. It does not change application code, Supabase schema, SQL, CSV files, import scripts, dependencies, or production data.

## 2. Product decision

The Sets page must eventually show all Pokémon sets, not only sets that appear in Lars or Lore their collection.

Sets is a complete, independent Pokémon set catalog. The existence of a set in the Sets experience must not depend on whether Lars or Lore own cards from that set.

## 3. Canonical source

`public.sets_catalog` remains the canonical source for the Sets page.

The long-term model is:

- `public.sets_catalog` stores all Pokémon sets independently from collection ownership.
- `cards_catalog` stores card-level catalog data.
- `collection_cards` stores Lars/Lore ownership data.
- The collection experience may later show progress per set by linking ownership data to catalog data.
- The Sets page must also show sets for which Lars and Lore currently own no cards.

## 4. Relationship with collection data

Lars/Lore collection data may be connected to `public.sets_catalog` in a future phase for ownership and progress features, such as showing how many cards are owned for a given set.

Collection data must never determine which sets exist.

That means:

- A set can exist in `public.sets_catalog` even when there are no matching rows in `collection_cards`.
- A set can appear on the Sets page even when Lars and Lore own zero cards from it.
- Ownership and progress are optional overlays on top of the independent set catalog.
- Collection-derived data must not be used as the canonical definition of the set catalog.

## 5. Data expansion

The current 17 `manual_review` sets are only the first seed for `public.sets_catalog`.

A later phase must expand `public.sets_catalog` into a complete Pokémon set catalog. That expansion must be handled as a separate data project with its own source evaluation, review, data changes, import process, and execution log.

Phase 4P does not add, edit, import, or validate additional set rows.

## 6. Allowed future fields

Future expansion must use only the existing `public.sets_catalog` columns:

- `id`
- `set_code`
- `name`
- `series`
- `generation`
- `release_date`
- `printed_total`
- `total`
- `symbol_url`
- `logo_url`
- `source`
- `source_id`
- `created_at`
- `updated_at`

No new columns are approved by Phase 4P.

## 7. Forbidden assumptions

Future catalog expansion must not invent data.

Do not populate any of the following fields without a reliable source:

- `release_date`
- `printed_total`
- `total`
- `generation`
- `series`
- `logo_url`
- `symbol_url`
- `source_id`

Additional restrictions:

- Do not infer canonical set data from `cards_catalog.set_name`.
- Do not treat `cards_catalog.set_name` as the canonical truth for which Pokémon sets exist.
- Do not use `public.cards` for runtime Sets behavior.
- Do not backfill uncertain values with guesses, placeholders, or collection-derived assumptions.
- Do not derive missing release dates, totals, generation, series, logo URLs, symbol URLs, or source IDs from naming patterns unless a reviewed source confirms them.

## 8. Future import strategy

A future full-catalog import must happen in a new phase, separate from Phase 4P.

The safe import sequence is:

1. Evaluate candidate sources for the full Pokémon set catalog.
2. Select and document the reliable source or sources.
3. Prepare a CSV/data PR containing the proposed catalog rows.
4. Review the CSV/data PR for structure, completeness, source quality, and uncertain values.
5. Import into Supabase only after review approval.
6. Record an execution log after the import, including what was imported, when it was imported, and any exceptions or follow-up items.

The import process must remain reviewable and reproducible. Runtime application code must not perform live catalog lookups to compensate for missing catalog data.

## 9. Runtime impact

Phase 4P has no runtime impact.

`SetsPage` continues to use the existing read-only Sets catalog service. This plan does not change queries, services, components, routing, Supabase schema, policies, or deployed data.

## 10. Out of scope

The following are explicitly out of scope for Phase 4P:

- External API runtime usage.
- Live internet lookup in the app.
- Automatic sync.
- Collection progress.
- Filters.
- Search.
- Pagination.
- Set detail pages.
- `public.cards` runtime usage.
- App-code changes.
- Supabase schema changes.
- SQL execution.
- CSV changes.
- Data import.
- Script changes or new scripts.
- Package or dependency changes.
