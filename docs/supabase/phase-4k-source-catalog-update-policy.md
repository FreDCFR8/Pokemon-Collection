# Phase 4K — Source & Catalog Update Policy

## Status

Policy approved after Phase 4H–4J groundwork.

## Context

The project now has:

- a canonical `public.sets_catalog` table
- a Phase 4H canonical CSV v1
- a Phase 4I CSV review log
- a Phase 4J CSV structure validation log

The initial setup was intentionally strict.

Future ordinary set-data updates should be lighter, while schema, runtime and import-process changes must remain strictly reviewed.

## Source Strategy

The app source of truth is:

`public.sets_catalog`

External sources may only be used as input for reviewed data updates.

Preferred source flow:

1. external reference source
2. reviewed CSV or data update file
3. PR review
4. Supabase import or update
5. app reads from `public.sets_catalog`

The app must not depend on a live external API for normal runtime set data.

## Accepted Reference Sources

Allowed reference sources for future review may include:

- Pokémon TCG API as candidate source
- official Pokémon card database as manual verification source
- manually reviewed project CSV files

These sources are reference inputs only.

They are not the runtime source of truth.

## `cards_catalog.set_name`

`cards_catalog.set_name` may be used as a validation helper.

It must not be treated as the canonical source for set identity.

No bulk import from `cards_catalog.set_name` is allowed without a separate reviewed plan.

## Data Integrity Rules

Missing values must remain empty until confirmed.

Do not guess:

- release dates
- totals
- URLs
- generation values
- series values
- source IDs
- set codes
- set names

Do not enrich data from memory, internet lookup, APIs, or assumptions unless the phase explicitly approves a reviewed source extraction.

## Ordinary Set Update Flow

After the initial catalog import process exists, future small set updates may use a compact flow.

For a new set with only confirmed `set_code` and `name`:

1. update the approved CSV or data update file
2. open one data-only PR
3. verify the row structure
4. verify `set_code` uniqueness
5. verify no guessed fields were added
6. merge after review
7. import/update through the approved import process

This does not require a new source strategy, review log, validation log, and import strategy every time.

## When One Compact PR Is Enough

A compact data PR is acceptable when:

- only set data is changed
- the schema does not change
- no runtime code changes
- no import script changes
- no package/dependency changes
- no new source mechanism is introduced
- no automatic API usage is introduced
- no guessed fields are added

## When A Full Phase Is Required

A full reviewed phase is still required for:

- database schema changes
- RLS changes
- new import mechanism
- scripts or automation
- runtime Supabase queries
- app UI changes
- new external API usage
- source policy changes
- bulk imports from noisy data
- mapping `cards_catalog` to `sets_catalog`
- changing uniqueness rules
- changing existing rows with uncertain impact

## Update Types

### New set

Add a new row with confirmed identifiers.

Minimum acceptable fields:

- `set_code`
- `name`
- `source`

Other fields may stay empty.

### Metadata enrichment

Adding release dates, totals, generation, series, logo URLs or symbol URLs requires a documented source.

### Correction

Changing existing canonical data requires a short reason in the PR body.

### Removal

Deleting set rows should be avoided.

If a set should no longer be active, a future archive/status design is preferred over deletion.

## Import Policy

Data PRs do not automatically import data into Supabase.

Import or update must happen through the approved import process.

The app continues reading only from `public.sets_catalog`.

## Runtime Policy

The app must not call Pokémon TCG API or other external set sources at runtime for normal set list display.

Runtime reads should use Supabase.

## Out of Scope

- no Supabase import
- no Supabase writes
- no runtime queries
- no app UI changes
- no CSV content changes
- no scripts
- no package changes
- no external API calls
- no internet lookup
- no Binder work
- no AI/OpenAI runtime

## Phase Decision

Phase 4K is complete once this docs-only policy is reviewed and merged.
