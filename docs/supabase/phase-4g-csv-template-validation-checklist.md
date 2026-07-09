# Phase 4G — Canonical CSV Template & Validation Checklist

## Status

- Planning only.
- No CSV data file added.
- No import executed.

## Context

Phase 4F selected a reviewed CSV-based import approach for the future population of `public.sets_catalog`.

Phase 4G defines the canonical CSV template and validation checklist.

This phase does not add an actual CSV file.

## CSV Template

The future CSV must use this exact header and column order:

```csv
set_code,name,series,generation,release_date,printed_total,total,symbol_url,logo_url,source,source_id
```

## Field Requirements

### Required Fields

- `set_code`
- `name`
- `series`
- `source`

### Preferred Fields

- `release_date`
- `printed_total`
- `total`
- `source_id`

### Optional Fields

- `generation`
- `symbol_url`
- `logo_url`

## Column Rules

- `set_code` must be unique.
- `release_date` must use ISO `YYYY-MM-DD` format when filled.
- `printed_total` and `total` must be integers greater than or equal to `0` when filled.
- `printed_total` must not exceed `total` unless explicitly explained during review.
- `symbol_url` and `logo_url` must be valid URLs when filled.
- `source` values must be consistent across rows.

## Validation Checklist

Before a CSV can be considered ready for review, verify that:

- The header exactly matches the canonical template.
- There are no extra or missing columns.
- The file is UTF-8 encoded.
- There are no empty rows.
- Required fields are not missing.
- Every `set_code` is unique.
- Suspicious duplicate `name` values are manually reviewed.
- Dates are valid.
- Counts are valid.
- URLs are valid.
- `source` and `source_id` usage is consistent.

## Comparison Against `cards_catalog.set_name`

Comparison against `cards_catalog.set_name` is validation help only.

It must not make `cards_catalog.set_name` canonical.

Use the comparison to detect:

- Missing set names or codes.
- Aliases.
- Mapping conflicts.
- Duplicate values.

## Import Blocking Issues

The CSV must not be imported while any of the following issues remain unresolved:

- Duplicate `set_code` values.
- Missing required fields.
- Invalid dates.
- Invalid totals.
- Incorrect CSV structure.
- Obvious duplicate canonical records.
- Unclear `source` values.
- Unexplained aliases or conflicts.

## Non-Blocking Review Issues

The following issues should be reviewed, but do not automatically block later import preparation:

- Missing `release_date` values.
- Missing `printed_total` values.
- Missing `total` values.
- Missing `source_id` values.
- Missing `generation` values.
- Missing symbol or logo URLs.
- Unmatched `cards_catalog.set_name` values.

## Supabase Mapping

CSV columns map one-to-one to `sets_catalog` columns.

`id`, `created_at`, and `updated_at` are managed by Supabase.

## Out of Scope

This phase does not include:

- Adding a CSV file.
- Running an insert or import.
- Adding scripts.
- Updating `cards_catalog`.
- Changing app or runtime queries.
- Adding UI filters.
- Adding `public.cards` runtime usage.
- Adding Binder.
- Adding AI or OpenAI runtime usage.

## Proposed Next Phase

Phase 4H prepares the first reviewed canonical CSV content.

Phase 4H may add a CSV file, but must not execute an import.
