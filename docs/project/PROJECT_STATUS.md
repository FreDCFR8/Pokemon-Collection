# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-13_

This is a living document. Update it after meaningful merges, database phases or roadmap decisions.

## Current phase

**Active phase: Phase 7C-2C2 — manage card quantity from an opened set**

Opened-set cards now support quantity management for an owned Near Mint row in the active collection. The `0 → 1` path keeps the proven safe INSERT with quantity 1, quantity changes above zero use the secured exact `+1` or `-1` UPDATE, and `1 → 0` uses the secured DELETE path.

Other statuses and conditions still count as present for the "In collectie" badge, but are shown as "Beheer via collectie" and are not changed by these controls. Set completion remains based on unique physical card presence (`owned` or `trade`), never on quantity.

## Repository state

- Default branch: `main`
- Latest merged documentation milestone: PR 90 — architecture consolidation
- PR 91 — read-only Pokémon TCG API set inspection — was closed without merge
- PR 91 proved that the Vercel integration works
- PR 91 also showed that live API calls from a Vercel Function are not the preferred architecture for reliable bulk import because of timeout and recoverability limits
- PR 95–98 are merged
- PR 101 — controlled `sv3pt5` catalog write — is merged
- The controlled live write for `sv3pt5` was executed and passed all post-write checks
- The post-write idempotency check passed; there is no remaining `sv3pt5` import blocker
- Catalog writes for other sets remain outside the current approval

## Phase 7B-2E verified import result

The controlled import for Pokémon TCG API set `sv3pt5` (`151`) passed all three verification stages:

- **Pre-write dry-run:** 207 expected and 207 received cards; 71 existing external-reference matches; 136 new cards; 0 ambiguous matches, conflicts or metadata changes; 272 planned writes and 0 actual writes. Result: PASS.
- **Controlled write:** 136 `cards_catalog` records and 136 external references added; 0 fallback references added for existing candidates; 71 existing matches unchanged; 0 failed writes; 207 verified references, 207 unique external references and 207 catalog links; `collection_cards` remained 1,095 → 1,095. Result: PASS with 272 database writes.
- **Post-write idempotency dry-run:** 207 expected and 207 received cards; 207 external-reference matches; 0 new cards, ambiguous matches, conflicts, metadata changes or blocked items; 0 planned and 0 actual database writes. Result: PASS.

The first idempotency attempt encountered one temporary HTTP 404 from the external Pokémon TCG API for `/v2/cards` and performed 0 database writes. The retry succeeded with 1 retry; this was an external API response, not a database or idempotency failure.

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

- Last read-only global baseline before the `sv3pt5` write: 1,095 `cards_catalog` rows, including 1,080 linked enriched records and 15 protected placeholders, with 0 unused catalog records
- `sv3pt5`: 207 verified catalog links through `pokemon_tcg_api`
- The controlled `sv3pt5` import added 136 catalog records

The previous 2,190-row catalog state was cleaned up. Exactly 1,095 unused legacy placeholders were removed after confirming that they were not referenced by any collection.

### External references

- `card_external_references` exists
- Last read-only global baseline before the `sv3pt5` write: 1,058 Pokémon TCG API references, 1,058 unique external IDs, 1,058 unique catalog links with this source and 37 collection cards without a Pokémon TCG API reference
- The controlled `sv3pt5` import added 136 references
- All 207 `sv3pt5` cards now match through external references

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
- explicitly paginated Sets progress reads across more than 1,000 `collection_cards` rows
- read-only per-card collection state in an opened set, limited to the active collection and currently loaded cards
- adding one owned Near Mint copy from an opened set to the active collection when the card is proven absent
- managing an owned Near Mint quantity from an opened set through secured INSERT, exact-step UPDATE and last-copy DELETE paths

Not yet available:

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

The controlled `sv3pt5` write was approved, executed and verified. This is not general permission to write other sets: every expansion to another set requires separately scoped validation and review. Dry-run remains the default, `--write` remains explicit, and `collection_cards` remains excluded from catalog imports.

## Next steps

1. Preview-test the Phase 7C-2C2 quantity controls for Lars and Lore on iPhone and desktop.
2. Treat `sv3pt5` as the verified reference implementation for controlled catalog imports.
3. Do not expand write support to other set or global-search flows until separately reviewed and validated.
4. Preserve dry-run-first import behavior, stable IDs, idempotency and collection isolation.

## Roadmap

- Phase 7B: reliable full card catalog
- Phase 7C: add cards from an opened set
- Phase 7D: global catalog search and add flow
- Phase 7E: wishlist
- Later: trade, missing, analytics, multi-collection improvements and scanning
