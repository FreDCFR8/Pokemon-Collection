# Phase 4G — Canonical CSV Template & Validation Checklist

## Status

Planning only.

No CSV data file has been added.

No import has been executed.

## Context

Phase 4F selected a reviewed CSV-based import approach for the future population of `public.sets_catalog`.

Phase 4G defines the CSV template and validation checklist.

This phase does not add the actual CSV file.

## Goal

Define the structure and validation requirements for a future canonical sets CSV.

The CSV will be reviewed in a later phase before any Supabase import is executed.

## CSV Template

The future CSV should use this column order:

```csv
set_code,name,series,generation,release_date,printed_total,total,symbol_url,logo_url,source,source_id
