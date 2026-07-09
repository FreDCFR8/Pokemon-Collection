# Phase 4B — Canonical Sets Catalog Design

## Scope

Phase 4B is a documentation-only design phase for a future canonical Pokémon sets catalog. It does not change runtime behavior, does not execute SQL, does not create Supabase objects, and does not add API integrations.

## 1. Probleemstelling

The Collection data currently contains cards with `cards_catalog.set_name`. Those values are useful for displaying the set name of cards already present in a collection, but they are incomplete as a source for all Pokémon sets.

`cards_catalog.set_name` is not suitable as the full Sets source because:

- It only contains set names for cards that already exist in `cards_catalog`.
- It can miss complete sets that are not yet represented by an owned/imported card.
- It is a card-level descriptive value, not a canonical set identity.
- It cannot reliably provide set metadata such as series, official totals, release dates, logos, symbols, or generation mapping.
- It may contain legacy/import naming differences that should not define the canonical catalog.

The SetsPage therefore needs its own canonical set catalog as an independent source of truth before it can become a complete Sets overview.

## 2. Doel van de canonical set catalog

A canonical set catalog should later support:

- A complete Sets page that is not limited to sets already present in the collection.
- A set overview with stable set identity and display metadata.
- A set-detail page for one selected set.
- Progress per set, calculated from canonical set totals and owned cards.
- Filtering the Collection by set after a reliable set identity exists.
- Possible generation-based grouping or filtering.
- Possible card import/enrichment by mapping cards to canonical set identities.

The catalog should be designed as stable read-only reference data for the app, not as user-generated collection data.

## 3. Voorgesteld datamodel

Proposed table:

```text
public.sets_catalog
```

Proposed fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid primary key` | Internal stable primary key used by the app and future relational references. |
| `external_source` | `text` | Name of the source system, for example `pokemon_tcg_api`, `manual`, or another curated source label. |
| `external_id` | `text` | Stable set identifier from the external source, when available. |
| `set_code` | `text` | Human-readable or source-provided set code, when reliable enough to display or map. |
| `name` | `text not null` | Canonical display name of the set. Required because every set must have a user-visible name. |
| `series` | `text null` | Series or era grouping, for example Scarlet & Violet or Sword & Shield, when available. |
| `printed_total` | `integer null` | Official printed card count when the source distinguishes printed cards from secret/extra cards. |
| `total` | `integer null` | Total card count including secret/extra cards when available. |
| `release_date` | `date null` | Official or curated release date for sorting, grouping, and timeline views. |
| `generation` | `integer null` | Optional generation mapping for later generation filters, only after the mapping rules are clear. |
| `logo_url` | `text null` | Optional URL for the set logo asset. |
| `symbol_url` | `text null` | Optional URL for the set symbol asset. |
| `source_url` | `text null` | Optional URL to the source record or documentation page used for traceability. |
| `created_at` | `timestamptz` | Timestamp for when the catalog row was created. |
| `updated_at` | `timestamptz` | Timestamp for when the catalog row was last updated. |

This is a design proposal only. No table, migration, trigger, index, seed, or RLS policy is created in Phase 4B.

## 4. Uniqueness / constraints ontwerp

Recommended constraints for a later migration plan:

- `unique(external_source, external_id)` when rows are imported or curated from a source with stable external identifiers.
- Optional `unique(set_code)` only if the selected source and data policy prove that `set_code` is globally reliable.
- Do not make `name` unique. Set names can overlap, vary by region/language, or have variants that should not be collapsed only by display name.

Additional later validation can consider non-negative totals and consistency between `printed_total` and `total`, but those rules should be defined in a SQL migration plan rather than implemented now.

## 5. Relatie met `cards_catalog`

In a later phase, `cards_catalog` should be linked to the canonical catalog through one of these approaches:

- Add a `set_id` reference to `sets_catalog.id` once the mapping is reliable.
- Maintain an external set id/code mapping that can connect card records to catalog set records during enrichment or import.

Phase 4B does not change `cards_catalog`. It includes no backfill, no migration, no new relationship, and no data update. Existing `cards_catalog.set_name` remains a display/import field and must not become the full Sets source.

## 6. Generation

`generation` is not currently available in `cards_catalog`. It may be practical to store generation at the set level in `sets_catalog` because most cards in a set usually belong to the same broad release era.

This can help future filters for generation 1 through 9, but it must be treated carefully:

- Some sets or cards may not map cleanly to a single game generation.
- Special, promotional, anniversary, or cross-era products may need explicit rules.
- A set-level generation field should only be used in runtime filtering after a clear mapping policy is documented and applied.
- Card-level exceptions may require later enrichment if set-level generation is not precise enough.

## 7. Type-filter

Type does not belong on `sets_catalog`. Pokémon/card type is card-level data and should be handled through future card enrichment.

A future type filter requires a separate enrichment design for card records. If implemented later, English type labels should use:

- Lightning
- Fire
- Water
- Grass
- Psychic
- Fighting
- Darkness
- Metal
- Dragon
- Colorless

Phase 4B does not implement type data, type filtering, or any card enrichment.

## 8. Mogelijke bronnen

Possible sources for a later seed/import strategy:

- Pokémon TCG API as a possible structured source for sets and set assets.
- Manual import as a fallback when automated source data is incomplete or not desired.
- A project-owned curated catalog when data needs to be reviewed, corrected, or stabilized.

An external source must not become a runtime dependency without a separate ADR. The app should prefer reading its own Supabase catalog at runtime once the catalog exists.

## 9. Security / RLS ontwerp

`sets_catalog` should be treated as read-only catalog data.

Possible later security direction:

- Authenticated users may be allowed to read catalog rows.
- Writes should be limited to admin/service-role/manual migration workflows.
- Child users must never be able to create, update, or delete `sets_catalog` rows from the app.
- RLS must be designed and activated separately in a later migration/security phase.

No RLS policy, database role, or Supabase change is added in Phase 4B.

## 10. Performance

The future SetsPage should avoid loading heavy nested data for all sets at once.

Performance guidelines for later phases:

- Load the SetsPage with pagination, grouping, or a lightweight list query if the catalog grows large.
- Do not load all cards for every set in the Sets overview.
- Calculate set detail and collection progress separately from the overview list.
- Consider indexes later on:
  - `set_code`
  - `name`
  - `series`
  - `generation`
  - `release_date`

Index choices should be made in the later SQL migration plan based on actual query patterns.

## 11. Fasevoorstel

Proposed follow-up phases:

### Phase 4C — Sets Catalog Migration Plan

Documentation-only SQL plan for the future `public.sets_catalog` table, constraints, indexes, timestamps, and RLS direction.

### Phase 4D — Manual Supabase Sets Table Creation

Manual SQL execution in Supabase after the migration plan is reviewed and accepted.

### Phase 4E — Sets Catalog Seed Plan

Choose the source/import strategy, define validation rules, and decide whether the first catalog comes from Pokémon TCG API, manual import, or a curated project-owned dataset.

### Phase 4F — Read-only Sets Query Service

Add a runtime read-only query service that reads from the canonical `sets_catalog` table without writes or external runtime API calls.

### Phase 4G — Sets Page List UI

Update the SetsPage to show the real canonical sets list from the read-only service.

### Phase 4H — Collection Set Filter

Add Collection filtering by set only after the canonical set catalog exists and card-to-set mapping is reliable.

## 12. Explicit non-goals

Phase 4B explicitly does not include:

- SQL.
- Database changes.
- Runtime Supabase queries.
- Pokémon TCG API calls.
- `cards_catalog` changes.
- `collection_cards` changes.
- Set import.
- Fake data.
- A hardcoded full set list.
- Collection set filtering.
- A set-detail page.
- Progress calculation.
- Generation filter implementation.
- Type filter implementation.
- `App.tsx` changes.
- UI changes.
