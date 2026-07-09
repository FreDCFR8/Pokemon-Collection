# Phase 4I — Canonical Sets CSV Review Log

## Status

Review planning only.

## Source File

CSV under review:

`data/sets/sets-catalog-canonical-v1.csv`

## Purpose

Phase 4I documents the review rules for the Phase 4H canonical sets CSV v1 before any Supabase import is allowed.

## Review Rules

The CSV may only be considered ready for import after confirming:

- the CSV header matches the approved template
- every row has exactly 11 columns
- every row has a non-empty `set_code`
- every row has a non-empty `name`
- every row has `source` set to `manual_review`
- unconfirmed fields remain empty
- no release dates were guessed
- no totals were guessed
- no URLs were guessed
- no generation values were guessed
- no source_id values were guessed
- no rows were added from `cards_catalog.set_name` without review

## Data Integrity Decision

Codex or any automated assistant must not enrich this CSV from memory, internet lookup, APIs, or assumptions.

Missing values must remain empty until they are confirmed by a reviewed source.

## Current CSV v1 Scope

The Phase 4H CSV v1 is intentionally small and incomplete.

It contains an initial reviewed list of set code and set name pairs only.

It is not yet a full canonical catalog.

## Import Decision

No import is approved in Phase 4I.

Import may only be considered in a later phase after:

- CSV structure validation
- manual content review
- duplicate review
- Supabase import SQL or copy strategy review
- rollback strategy review

## Relationship to Existing Data

`cards_catalog.set_name` may be used as a validation helper.

It must not be treated as the canonical source for set identity.

## Out of Scope

- no Supabase import
- no writes
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

Phase 4I is complete once this docs-only review log is merged.
