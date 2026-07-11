# Recent Database Changes Log

## Status

This is a compact chronological summary of important database and data decisions that need one central reference before the complete card catalog work starts. It does not replace the detailed Phase 4 and Phase 5 documents; it consolidates the current state after Phase 6A.

## Phase 5V — smart collection filter options

Goal: provide collection-specific filter options for the Collection page.

Change:

- Added database function `get_collection_filter_options`.
- Authenticated users may execute the function.
- `anon` may not execute it.
- The function is not `security definer`.
- The function determines set and rarity options within the chosen collection.
- Set and rarity influence each other.
- Search text does not influence the options.

Result: the Collection page uses the result at runtime for smart set and rarity filters.

Lasting impact: filter options are computed server-side and scoped to the selected collection.

## Phase 5W — set_code mapping and canonical sets

Goal: connect card rows to canonical sets where mappings were proven.

Change:

- `cards_catalog.set_code` was populated for proven mappings.
- Proven mappings were applied.
- `sets_catalog` was extended.
- `287` cards were correctly linked in the controlled mappings.

After verification:

- `mapped_sets_present = 34`
- `correctly_mapped_cards = 287`
- `remaining_or_incorrect_targets = 0`
- `invalid_set_codes = 0`

Result: proven set mappings became usable for runtime set behavior.

Lasting impact: uncertain mappings must not be executed blindly.

## Phase 5Z — double Dex import analysis

Goal: understand why the catalog and collection contained duplicate-looking rows.

Change: analysis only.

Findings:

- Original `cards_catalog` contained `2,190` rows.
- Placeholder and enriched records existed side by side.
- Analysis showed a double import structure.
- End analysis identified:
  - `1,110` placeholder records
  - `1,080` enriched records
  - `901` overlapping card keys
  - `15` extra placeholder duplicates
- Lore had no collection.
- All records were linked to Lars.

Result: the project had enough evidence to plan a targeted cleanup.

Lasting impact: the old `2,190` count is historical and must not be treated as Lars' current collection baseline.

## Phase 6A — collection cleanup

Goal: repair Lars' collection after the faulty double Dex import without losing real collection cards.

Change:

- Placeholder links were replaced by enriched links where safe.
- Faulty duplicate links were merged.
- Quantity was set to `1` for this recovery action.

Final result:

- `1,095` `collection_cards` rows.
- Total quantity `1,095`.
- `1,095` unique catalog links.
- `1,080` enriched links.
- `15` placeholder links.

Result: the cleanup was functionally checked in the app. No real collection-card data was lost.

Lasting impact: Lars' current collection baseline is `1,095` cards.

## Phase 6B — remaining placeholders

Goal: determine whether the 15 remaining placeholders could be safely matched to enriched records.

Change: investigation only; no write was executed.

Result:

- Exactly `15` placeholders were investigated.
- None had a safe enriched match.
- The placeholders were deliberately preserved.

Lasting impact: future relinking is allowed only when a proven unique match exists. Automatic cleanup and automatic delete are forbidden.

## Phase 7A-1 — insert policy for collection_cards

Goal: prepare safe owned-card insertion for a user's own collection.

Change:

- An authenticated user may add a card to their own collection.
- Ownership is checked through `collections` and `profiles` linked to `auth.uid()`.
- Allowed insert values:
  - `quantity = 1`
  - `condition = 'Near Mint'`
  - `status = 'owned'`
- No update policy was added.
- No delete policy was added.
- The existing SELECT policy remained unchanged.

Result: the underlying insert policy is available for a future add-card flow.

Lasting impact: adding cards must use the safe defaults until quantity, condition, update, and delete behavior receive separate phases.

## PR 89 — deliberately closed without merge

Goal: test technical searching in `cards_catalog` and adding from the Collection page.

Change: PR 89 implemented technical search in `cards_catalog` and adding from the Collection page.

Result:

- The functionality worked technically.
- The PR was deliberately not merged.

Reason:

- `cards_catalog` and Lars' collection were almost the same at that moment.
- There were no useful new cards to add.
- The UX flow was conceptually wrong.

Correct future flows:

1. Open a set and add a card from there.
2. Use a general search function across the complete catalog.

Lasting impact: the underlying insert policy remains usable, but the Collection page is not the primary add-card surface.

## Architecture principles

- One source of truth per data type.
- `cards_catalog` for card metadata.
- `collection_cards` for ownership and status.
- `sets_catalog` for canonical set metadata.
- `public.cards` is legacy.
- Database integrity over development speed.
- Data first, UI later.
- No automatic deletes during catalog sync.
- Collection links must never break.
- External APIs only for import and sync.
- Runtime reads from Supabase.
- Server-side filtering and pagination.
- Mobile-first.
- Performance is a core requirement.
- Small controlled PRs.
- One branch per goal.
- Important architecture, database, and security decisions are documented.
- Documentation is not required for every small CSS or text change.
- Documentation is required for:
  - architecture decisions
  - schema changes
  - RLS/security
  - data invariants
  - external integrations
  - import and synchronization behavior
  - irreversible product choices
