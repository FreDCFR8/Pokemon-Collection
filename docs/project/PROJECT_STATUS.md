# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-13_

This is a living document. Update it after meaningful merges, database phases or roadmap decisions.

## Current phase

**Phase 7B-2E — controlled write for sv3pt5**

The current immediate objective is to add an explicitly authorized, idempotent and recoverable write mode to the local catalog import for `sv3pt5`, while keeping dry-run as the default and keeping `collection_cards` outside the import process.

## Repository state

- Default branch: `main`
- Latest merged documentation milestone: PR 90 — architecture consolidation
- PR 91 — read-only Pokémon TCG API set inspection — was closed without merge
- PR 91 proved that the Vercel integration works
- PR 91 also showed that live API calls from a Vercel Function are not the preferred architecture for reliable bulk import because of timeout and recoverability limits
- PR 95–98 are merged
- The Phase 7B-2E write implementation is under review; no live catalog write is approved yet

## Phase 7B-2D live dry-run evidence

The local live dry-run for Pokémon TCG API set `sv3pt5` (`151`) passed with exactly 207 of 207 cards. It found 71 existing external-reference matches and 136 new cards, with 0 ambiguous matches, 0 conflicts, 0 metadata changes and 0 database writes.

Phase 7B-2E now adds the controlled write capability. The actual write may run only after code review and another green local dry-run of the new PR.

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
- Sets page with a fullscreen read-only set overlay
- server-side set filtering, catalog cards loaded in batches of 30, search and name sorting

Being fixed in Phase 7C-1B:

- collection progress reads above 1,000 `collection_cards` rows must be explicitly paginated so set counts are not truncated by Supabase/PostgREST response limits

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

Catalog writes remain blocked until the Phase 7B-2E code is reviewed, its new local dry-run is green and the user explicitly confirms readiness for the controlled write.

## Next steps

1. Review the complete Phase 7B-2E PR diff.
2. Run the new local dry-run and reconfirm 71 existing matches, 136 new cards, 0 ambiguous matches, conflicts and metadata changes, and 0 database writes.
3. Keep `--write` blocked until the user explicitly confirms readiness after those checks.
4. Execute the controlled `sv3pt5` write locally and verify references, stable internal IDs and the unchanged `collection_cards` count.
5. Continue Phase 7C work only from the verified catalog result.

## Roadmap

- Phase 7B: reliable full card catalog
- Phase 7C: add cards from an opened set
- Phase 7D: global catalog search and add flow
- Phase 7E: wishlist
- Later: trade, missing, analytics, multi-collection improvements and scanning
