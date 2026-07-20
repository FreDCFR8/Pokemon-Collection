# Remaining Set Catalog Recovery — Design Review

## Purpose

This document defines the review boundary for restoring missing canonical set coverage after the verified read-only baseline of 20 July 2026. It does not authorize a database write.

## Verified baseline

- Dataset: `PokemonTCG/pokemon-tcg-data` at `0af6250a22495e4a3e9f60ff45fc3fedc2e0563d`.
- Dataset profile: 173 sets and 20,324 cards.
- Baseline report hash: `30c9044a0f52b7dba0cb164cff99ce8fbd2f8d14ca1ce7c75b1a03b60ab51288`.
- Baseline analysis hash: `dd8391f56de294adb8e47d5a56d3d770c335a8ca7fffbfd907f08bb072cf2d6e`.
- 39 sets are `PASS`.
- 117 sets have no candidate mapping and are proposed only for human review in `config/catalog/remaining-set-catalog-mapping-review.json`.
- 15 existing sets have card identity/reference or metadata conflicts and remain untouched.
- `cel25c` and `zsv10pt5` remain manual review.

## Proposed mapping rule — review only

For a proposed entry, the local pinned manifest provides the exact source set ID, name, series, card count and JSON path. The proposed new internal `set_code` equals the source set ID, and the proposed external identity is `pokemon_tcg_api:<setId>`.

This is a proposed convention, not an approved write rule. The later write phase must validate that each proposed set is still absent from `sets_catalog` and `set_external_references`, then insert only the reviewed entries.

## Explicit exclusions

- No existing `sets_catalog` row may be changed.
- No existing `set_external_references` row may be changed.
- No writes to `cards_catalog`, `card_external_references` or `collection_cards`.
- No automatic action for the 17 excluded sets listed in the review artifact.
- No card import is included.

## Required approval before implementation

The next implementation PR may exist only after the exact 117-entry review artifact is accepted. It must be a set-catalog/reference-only phase with exact before/after counts, transaction-safe behavior, postchecks and a repeat read-only validation.
