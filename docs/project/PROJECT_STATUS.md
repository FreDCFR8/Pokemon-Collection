# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-11_

This is a living document. Update it after meaningful merges, database phases or roadmap decisions.

## Current phase

**Phase 7B-2B — controlled test-set import design**

The current immediate objective is to design and validate a robust local import method for one complete test set before writing external catalog data to Supabase.

## Repository state

- Default branch: `main`
- Latest merged documentation milestone: PR 90 — architecture consolidation
- PR 91 — read-only Pokémon TCG API set inspection — was closed without merge
- PR 91 proved that the Vercel integration works
- PR 91 also showed that live API calls from a Vercel Function are not the preferred architecture for reliable bulk import because of timeout and recoverability limits
- No import implementation is currently approved for merge

## Current architecture baseline

Runtime application data is read from Supabase.

```text
authenticated user
→ profile
→ collection
→ collection_cards
→ cards_catalog
→ sets_catalog
```

External card APIs are import and synchronization sources only. They are not runtime search engines for the browser application.

## Current database baseline

### Collection

- Lars has one imported collection
- Lore does not yet have an imported collection
- `collection_cards`: 1,095 rows
- total collection quantity: 1,095
- unique catalog links: 1,095
- rows with quantity other than 1: 0

### Card catalog

- `cards_catalog`: 1,095 rows
- linked enriched records: 1,080
- protected placeholder records: 15
- unused catalog records: 0

The previous 2,190-row catalog state was cleaned up. Exactly 1,095 unused legacy placeholders were removed after confirming that they were not referenced by any collection.

### External references

- `card_external_references` exists
- Pokémon TCG API references: 1,058
- unique external IDs: 1,058
- unique catalog links with this source: 1,058
- collection cards without a Pokémon TCG API reference: 37

Internal `cards_catalog.id` values and all `collection_cards` links remained stable during the backfill.

### Sets

- `sets_catalog` is the canonical set metadata source
- project `set_code` values remain internal identifiers
- controlled Phase 5W mappings linked 287 cards correctly
- invalid mapped set codes after verification: 0

## Search and performance readiness

The database has been prepared with:

- `pg_trgm`
- composite index on `set_code` and `number`
- trigram search indexes for card name, set name and card number

Runtime search must use server-side filtering and pagination. The browser must not load the complete catalog or all card images.

## Current product state

Available:

- authentication and profile selection
- collection overview
- server-side collection search and pagination
- set and rarity filters
- intelligent filter-option RPC
- Sets page with grouped progress
- inline set-card viewing

Not yet available:

- adding cards from a set
- global full-catalog search
- adding cards from global search
- wishlist UI
- trade or missing workflows
- full external catalog synchronization

## Protected invariants

- Lars' current collection baseline is 1,095 items
- the 15 placeholders represent real collection items and must not be automatically deleted
- catalog synchronization must not alter collection quantity, condition or status
- catalog synchronization must not replace internal card IDs
- active collection links must never break
- `collection_cards` is never modified by the catalog import process
- `public.cards` remains legacy and is not used for new runtime functionality

## Approved import direction

The catalog import will use a controlled local Node/TypeScript script instead of a live Vercel Function request.

Mandatory design rules:

- processing happens in small resumable batches, preferably one set per run;
- dry-run is always the default behavior;
- database writes are allowed only when the operator explicitly supplies `--write`;
- without `--write`, the script must perform no database writes;
- matching happens primarily through `card_external_references` using source and external card ID;
- existing matches always preserve the current `cards_catalog.id`;
- repeated imports are fully idempotent and must not create duplicate cards or references;
- `collection_cards` is never inserted, updated or deleted by catalog import;
- ambiguous or conflicting matches block writes;
- expected and received counts are validated before writes;
- failed sets can be retried independently;
- synchronization produces a clear report or log;
- no automatic deletes are allowed.

## Next steps

1. Define the exact command-line interface and dry-run report for the local import script.
2. Validate one complete read-only source response for `sv3pt5` through that script.
3. Define deterministic matching outcomes for existing, new, changed, ambiguous and conflicting cards.
4. Review the dry-run result before any use of `--write`.
5. Import one complete test set with transaction safeguards.
6. Verify duplicates, counts, stable internal IDs, collection stability and query performance.
7. Only then prepare full catalog synchronization.

## Roadmap

- Phase 7B: reliable full card catalog
- Phase 7C: add cards from an opened set
- Phase 7D: global catalog search and add flow
- Phase 7E: wishlist
- Later: trade, missing, analytics, multi-collection improvements and scanning