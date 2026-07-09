# Phase 4F — Canonical Sets Import Approach

## Status

Planning only.

No import has been executed.

## Context

Phase 4D created the canonical `public.sets_catalog` table manually in Supabase.

Phase 4E confirmed that `cards_catalog.set_name` is not reliable enough to populate `sets_catalog` directly because it contains a mix of:

- set names
- set codes
- aliases
- duplicate references
- incomplete metadata

`sets_catalog` remains empty.

## Goal

Define a safe import approach for a future phase.

This phase only documents the decision.

## Decision

Use a reviewed CSV-based import approach for the first population of `sets_catalog`.

The CSV must be reviewed before execution.

No import should run automatically from application runtime code.

## Why CSV-Based Reviewed Import

A reviewed CSV provides the safest balance between control and maintainability.

Benefits:

- easy to inspect before execution
- easy to compare against `cards_catalog.set_name`
- easy to review in a PR before applying
- avoids runtime dependency on external APIs
- avoids noisy imports from mixed set-name data
- supports manual correction before database writes
- allows a clear rollback plan

## Rejected Options For Now

### Direct import from `cards_catalog.set_name`

Rejected.

Reason:

`cards_catalog.set_name` contains mixed values such as set names and set codes.

Examples observed during Phase 4E:

- `Silver Tempest` and `swsh12`
- `Lost Origin` and `swsh11`
- `Obsidian Flames` and `sv3`
- `Pokémon GO` and `pgo`

This would create duplicates or incorrect canonical records.

### Fully automated runtime import

Rejected for now.

Reason:

- database writes must be explicitly approved
- runtime should stay read-only for this area
- external API behavior could change
- failed imports could affect production data
- this project does not use AI-runtime/OpenAI integration

### Manual SQL-only creation of all rows

Rejected for now.

Reason:

- too error-prone
- hard to review at scale
- harder to compare against source data

## Required CSV Columns

The reviewed CSV should contain at minimum:

| column | required | notes |
|---|---|---|
| set_code | yes | stable canonical set code |
| name | yes | canonical set name |
| series | yes | set series |
| release_date | preferred | ISO date format |
| printed_total | preferred | official printed total if available |
| total | preferred | official total if available |
| symbol_url | optional | stable asset URL if available |
| logo_url | optional | stable asset URL if available |
| source | yes | source name used for traceability |
| source_id | preferred | source-specific identifier |

## Generation Metadata

Generation should not block the first import.

Generation can be added later through:

- manual mapping
- a reviewed CSV update
- a separate generation mapping table
- a later enrichment phase

## Validation Before Import

Before any future import, the CSV must be checked for:

- duplicate `set_code`
- missing required fields
- invalid dates
- non-numeric totals
- inconsistent source/source_id values
- obvious duplicate names
- mismatch against observed `cards_catalog.set_name` values

## Suggested Supabase Import Strategy

Future import should be performed only after review.

Preferred approach:

1. create or review CSV
2. validate CSV manually or with a script
3. open docs/data review PR if the CSV is stored in the repo
4. execute import manually in Supabase only after approval
5. verify row count and sample rows
6. compare unmatched `cards_catalog.set_name` values
7. document execution result in a follow-up log

## Rollback Strategy

Before importing:

- confirm `sets_catalog` row count
- export or copy current `sets_catalog` content if it is not empty
- import inside a controlled transaction where possible
- verify counts before commit where possible
- if incorrect, rollback transaction or delete only rows from the approved import batch

A later phase may add an `import_batch_id` column or separate import log table if needed.

## Out of Scope

This phase does not include:

- inserting rows into `sets_catalog`
- adding CSV files
- adding import scripts
- updating `cards_catalog`
- changing application runtime queries
- adding set filters to the UI
- adding generation filters
- adding type filters
- using `public.cards` at runtime
- adding Binder functionality
- adding AI-runtime or OpenAI integration

## Proposed Next Phase

Phase 4G should define the actual canonical CSV template and validation checklist.

No data import should be executed until the CSV content, validation checks, and rollback procedure are reviewed.
