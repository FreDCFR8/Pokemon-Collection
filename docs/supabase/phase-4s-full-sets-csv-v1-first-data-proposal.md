# Phase 4S — Full Sets CSV v1 First Data Proposal

## Purpose

Phase 4S is a **data proposal only** for `data/sets/full-sets-catalog-v1.csv`. It adds a small first batch of reviewed Pokémon set rows so the CSV structure from Phase 4R can be evaluated with real data before any import workflow exists.

This phase does not change the runtime application and does not make `public.sets_catalog` depend on any external source at runtime.

## Scope and safety

Phase 4S is intentionally limited to CSV data and documentation:

- No Supabase import was executed.
- No SQL was executed.
- No app code was changed.
- No package or dependency files were changed.
- No scripts were added.
- No automatic API sync was added or run.
- No runtime external API integration was added.
- No `public.cards` data was used.
- No `cards_catalog.set_name` data was used as a source.
- No Bulbapedia data was copied.
- No scraping was performed.

Import into Supabase is explicitly out of scope for this phase and may only happen in a later, separately reviewed phase.

## Source used

The source recorded in the CSV is `pokemon_tcg_api`.

Rows use structured Pokémon TCG API set metadata fields only where the value is reviewable for this first proposal:

- project-canonical `set_code`, preserving existing codes from the current seed data when a set is already present;
- stable Pokémon TCG API set id as `source_id`;
- set `name`;
- `series`;
- `release_date`;
- `printed_total`;
- `total`;
- `symbol_url`;
- `logo_url`.

## Project set codes and source ids

`set_code` is the project-canonical set code and must not be blindly treated as the same value as the Pokémon TCG API id. `source_id` records the Pokémon TCG API set id. These values can differ when the project already has an existing canonical code for the same set.

For example, Paldean Fates keeps the existing project `set_code` `sv45`, while its Pokémon TCG API id remains recorded as `source_id` `sv4pt5`. This avoids introducing duplicate or conflicting catalog rows for the same set in later phases.

Release dates are recorded as ISO dates in `YYYY-MM-DD` format when present.

## Rows added

This proposal adds **11 data rows** to `data/sets/full-sets-catalog-v1.csv`.

The batch is intentionally small even though the CSV is intended to grow into a full catalog. A small first batch keeps review practical, makes CSV validation easy, and allows the team to confirm source attribution, column mapping, URL handling, and null/empty-field policy before larger additions are proposed.

## Fields intentionally left empty

The `generation` column is intentionally left empty for every row in this proposal. The selected source data does not provide an explicit project-approved generation mapping for these set rows, and this phase must not infer or guess generation values.

Any future uncertain, unavailable, ambiguous, or not-yet-reviewed value must remain empty/null instead of being guessed. Later phases may add values only when they are backed by an explicit, reliable, and reviewable source or project-approved mapping.

## Import status

No import was performed in Phase 4S. The CSV remains a review artifact only. Supabase import planning and execution must happen in a later phase with its own scope, checks, and review.
