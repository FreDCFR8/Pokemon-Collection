# Card Catalog Strategy

## Status

This document describes the architecture for the complete card catalog. It separates definitive architecture principles from proposed implementation details and open decisions.

## 1. Goal

Definitive principles:

- `cards_catalog` becomes the central runtime source for all available cards.
- `cards_catalog` must not stay limited to cards Lars owns.
- The Sets page and the general search function use the same catalog.
- `collection_cards` remains exclusively ownership/status per collection.

## 2. External sources

Definitive principles:

- External card APIs are used only for import and synchronization.
- The React browser app never searches directly in an external card API.
- The browser never receives a secret API key.
- The existing `POKEMON_TCG_API_KEY` in Vercel is a leftover from the previous app and is not a mandatory architecture choice.
- The source is chosen based on data quality, freshness, stability, and coverage.
- One source becomes the primary owner of core metadata.
- Secondary sources may only be used for validation, missing metadata, freshness checks, or fallback.
- Multiple sources must not blindly overwrite the same fields.

## 3. Normal runtime flow

```text
external source
→ controlled server-side import/synchronization
→ Supabase cards_catalog
→ Sets page and general search
→ collection_cards
```

Runtime use remains independent from external API availability. External rate limits must not affect the search experience. Supabase is the runtime source.

## 4. Card identity

Definitive principles:

- Card name alone is not a reliable identity.
- Card number alone is not a reliable identity.
- Set plus number is more reliable, but source differences must be managed.
- A primary `external_source` and `external_id` must support idempotent imports.
- Internal database IDs remain stable.
- Existing `collection_cards` links must not change.

Proposed implementation:

- Primary identity on `external_source + external_id`.
- Additional canonical key on normalized set code plus normalized card number.
- A later table for external source references is possible.

Open decision: this identity model must be technically finalized before the first full import.

## 5. Import rules

Definitive principles:

- Imports are idempotent.
- Running the same import again must not create duplicates.
- New cards may be added.
- Metadata may be updated in a controlled way.
- Automatic deletes are forbidden.
- Missing source records are not automatically removed from `cards_catalog`.
- Active `collection_cards` links remain preserved.
- Imports do not change quantity, condition, or status.
- Imports do not replace internal card IDs.
- Every import must be verifiable and recoverable.

## 6. Performance

Definitive principles:

- Search happens server-side in Supabase.
- The full catalog is not loaded into the browser.
- Pagination is mandatory.
- Each request returns only a limited number of results.
- Only necessary columns are selected.
- Filters are applied server-side.
- Search indexes must be added when the schema is ready for them.
- Owned status must not be fetched with one query per card.
- N+1 queries must be avoided.
- Owned and wishlist status are later fetched through one efficient query or RPC.

## 7. Images

Definitive principles:

- `cards_catalog` stores `image_small` and `image_large` as URLs.
- Thumbnails are used in lists.
- The large image is loaded only for detail views.
- Images are lazy loaded.
- Not all images of a set are rendered at once.
- Missing images receive a fallback.
- Images are not copied to Supabase Storage by default in Phase 7B.

Future option: local caching can be investigated later if needed.

## 8. Sets page

Definitive target flow:

- The user opens a set.
- Cards are fetched server-side by `set_code`.
- Cards are paginated or loaded incrementally.
- Owned status is determined efficiently per card.
- The user can add a card from the set.
- Internal `set_code` remains hidden from end users.

## 9. General search function

Definitive target behavior:

- Search across the full `cards_catalog`.
- Search by card name.
- Search by set.
- Search by card number.
- Later filters for rarity, owned, not-owned, and wishlist.
- Debounce and minimum search length are allowed.
- Results are paginated.
- Images are lazy loaded.

## 10. Variants

Important variant concerns:

- normal
- holo
- reverse holo
- promo
- stamped
- alternate art
- trainer gallery
- special illustration
- language variants

Collectible variants must not be merged by accident. Open decision: precise variant modeling must be technically decided before the full import.

## 11. Languages

Definitive principles:

- English is a logical primary catalog language.
- Future support for French, Japanese, and other cards must remain possible.
- Multiple languages must not automatically be considered the same physical card.
- Language strategy is introduced in phases.

## 12. Sets and subsets

Definitive principles:

- Promos, Trainer Gallery, Galarian Gallery, and special subsets must be handled consistently.
- Parent-child relations between main sets and subsets may provide value later.
- Existing `set_code` remains project-canonical.
- Source codes are treated as external identifiers.

## 13. Freshness

A synchronization must at minimum check:

- newest available sets
- release dates
- expected card count per set
- actual imported card count
- missing cards
- import errors
- date of last successful sync

Proposed set statuses:

- `announced`
- `partial`
- `complete`
- `archived`

## 14. Sync logging

A later sync log must at minimum be able to contain:

- `source`
- `started_at`
- `finished_at`
- `status`
- `sets_seen`
- `cards_seen`
- `inserted`
- `updated`
- `unchanged`
- `errors`

## 15. Price data

Definitive principles:

- Price data changes faster than card metadata.
- Price data does not belong in the same catalog synchronization.
- Cardmarket and TCGplayer prices are managed separately later.
- Any price history receives a separate model.

## 16. Management and recovery

Future value:

- Resynchronize one set.
- View incomplete sets.
- Refetch one card.
- View source differences.
- Correct manual mapping.
- Review import results and errors.

## 17. Roadmap

- Phase 7B-0: preserve architecture and recent database decisions.
- Phase 7B-1: database readiness and identity for the complete catalog.
- Phase 7B-2: import one complete test set.
- Phase 7B-3: check completeness, duplicates, and performance.
- Phase 7B-4: controlled synchronization of the complete catalog.
- Phase 7C: add cards from an opened set.
- Phase 7D: general card search.
- Phase 7E: wishlist.
