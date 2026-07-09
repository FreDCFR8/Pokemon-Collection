# Phase 4E — Sets Catalog Population Strategy

## Status

Planning only.

No data import has been executed.

## Context

Phase 4D created the canonical `public.sets_catalog` table manually in Supabase.

After creation, the table was verified with:

| check_type | result |
|---|---|
| table | sets_catalog |
| rls | true |
| policy | Authenticated users can read sets catalog |
| trigger | sets_catalog_updated_at |
| count | 0 |

## Current Data Snapshot

A Phase 4E pre-check was executed against `public.cards_catalog`.

Result:

| metric | value |
|---|---:|
| cards_catalog_count | 2190 |
| distinct_set_name_count | 125 |
| missing_set_name_count | 0 |
| sets_catalog_count | 0 |

Top observed `cards_catalog.set_name` values included both set names and set codes:

| set_name | card_count |
|---|---:|
| sv35 | 79 |
| 151 | 71 |
| Silver Tempest | 71 |
| swsh12 | 71 |
| Lost Origin | 63 |
| swsh11 | 63 |
| me1 | 62 |
| Mega Evolution | 60 |
| Obsidian Flames | 56 |
| sv3 | 56 |
| Astral Radiance | 53 |
| swsh10 | 53 |
| Scarlet & Violet | 52 |
| sv1 | 52 |
| Fusion Strike | 38 |
| sv5 | 38 |
| sv7 | 38 |
| swsh8 | 38 |
| Paldean Fates | 36 |
| Stellar Crown | 36 |
| sv45 | 36 |
| Temporal Forces | 36 |
| Crown Zenith | 33 |
| swsh12pt5 | 33 |
| sv9 | 31 |
| swsh9 | 31 |
| Brilliant Stars | 29 |
| Journey Together | 29 |
| me2 | 29 |
| Surging Sparks | 29 |
| sv8 | 29 |
| Destined Rivals | 28 |
| sv10 | 28 |
| pgo | 27 |
| Pokémon GO | 27 |
| Black Bolt | 26 |
| sv105b | 26 |
| Phantasmal Flames | 25 |
| sv6 | 24 |
| sv105w | 22 |
| sv2 | 22 |
| White Flare | 22 |
| Champion's Path | 21 |
| swsh35 | 21 |
| Evolving Skies | 20 |
| Paldea Evolved | 20 |
| swsh7 | 20 |
| Twilight Masquerade | 20 |
| me25 | 17 |
| Ascended Heroes | 15 |

## Findings

`cards_catalog.set_name` is useful as an analysis and comparison source, but it is not reliable enough to populate `sets_catalog` directly.

Observed issues:

- it contains both set names and set codes
- it contains duplicate references to the same set
- examples include `Silver Tempest` and `swsh12`
- examples include `Lost Origin` and `swsh11`
- examples include `Obsidian Flames` and `sv3`
- examples include `Pokémon GO` and `pgo`
- it may contain aliases or import artifacts
- it does not provide canonical metadata such as release date, printed total, total, logo, symbol, or generation

## Decision

Do not import from `cards_catalog.set_name` into `sets_catalog`.

`cards_catalog.set_name` may only be used later as:

- a comparison source
- a mapping aid
- a validation aid
- a way to detect unmatched cards after canonical import

## Canonical Source Requirement

A future phase must define a canonical set source before inserting rows into `sets_catalog`.

The canonical source should provide at minimum:

- set code
- set name
- series
- release date
- printed total
- total
- symbol URL if available
- logo URL if available

Generation metadata may be added either:

- during import, if reliable
- manually later
- through a separate mapping phase

## Out of Scope

This phase does not include:

- inserting rows into `sets_catalog`
- updating `cards_catalog`
- changing application runtime queries
- adding set filters to the UI
- adding generation filters
- adding type filters
- using `public.cards` at runtime
- adding Binder functionality
- adding AI-runtime or OpenAI integration

## Proposed Next Phase

Phase 4F should define the canonical set import approach.

Options to evaluate:

1. manual curated SQL insert
2. scripted import from a trusted Pokémon TCG source
3. CSV-based import reviewed before execution
4. hybrid import plus manual generation mapping

No import should be executed until the source and rollback strategy are documented and reviewed.
