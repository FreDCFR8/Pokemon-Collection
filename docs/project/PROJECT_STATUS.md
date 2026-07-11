# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-11_

This is a living document. Update it after meaningful merges, database phases or roadmap decisions.

## Current phase

**Phase 7B-2 — controlled test-set import preparation**

The current immediate objective is to validate a reliable source and import method for one complete test set before writing external catalog data to Supabase.

## Repository state

- Default branch: `main`
- Latest merged documentation milestone: PR 90 — architecture consolidation
- Open technical PR: PR 91 — read-only Pokémon TCG API set inspection
- PR 91 currently contains one Vercel Function: `api/catalog/inspect-set.js`
- The latest PR 91 preview deployment is green
- The read-only inspection request for `sv3pt5` returned a Pokémon TCG API timeout
- PR 91 must not be merged until its purpose and next adjustment are agreed

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
- `public.cards` remains legacy and is not used for new runtime functionality

## Active technical question

The current Pokémon TCG API inspection approach timed out when reading the `sv3pt5` test set. The architecture remains valid, but the inspection/import mechanism must become smaller and more reliable.

Preferred direction under evaluation:

- one external source request per set where possible;
- batch processing per set;
- idempotent matching through `card_external_references`;
- dry-run and expected/received validation;
- independent retries per set;
- synchronization logging;
- no automatic deletes.

## Next steps

1. Decide whether PR 91 is simplified, replaced or closed.
2. Validate one reliable read-only source response for `sv3pt5`.
3. Define Phase 7B-2B dry-run matching for existing versus new cards.
4. Import one complete test set with transaction safeguards.
5. Verify duplicates, counts, collection stability and query performance.
6. Only then prepare full catalog synchronization.

## Roadmap

- Phase 7B: reliable full card catalog
- Phase 7C: add cards from an opened set
- Phase 7D: global catalog search and add flow
- Phase 7E: wishlist
- Later: trade, missing, analytics, multi-collection improvements and scanning
