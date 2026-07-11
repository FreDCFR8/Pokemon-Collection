# Collection Data Model

## Status

This document captures the current collection and card model after Phase 6A. Earlier Phase 4 and Phase 5 documents remain historical context for `sets_catalog`, `cards_catalog.set_code`, and set progress, but pre-cleanup collection counts are superseded here.

## 1. Catalog versus collection

`cards_catalog` means: what a card is.

`collection_cards` means: which collection owns that card, or which status that card has in that collection.

Rules:

- One `cards_catalog` record can be used by multiple collections.
- Card metadata must not be duplicated per user.
- Ownership does not belong in `cards_catalog`.
- Card metadata does not belong in `collection_cards`.

## 2. Relationships

- `collection_cards.collection_id` references `collections.id`.
- `collection_cards.card_catalog_id` references `cards_catalog.id`.
- `collections.profile_id` references `profiles.id`.

## 3. Unique constraint

The current uniqueness rule is:

```sql
UNIQUE (
  collection_id,
  card_catalog_id,
  condition,
  status
)
```

This means the same card cannot exist twice in the same collection with exactly the same `condition` and `status`. The same card can technically have different statuses. This allows wishlist support later through the same table.

## 4. Checks and allowed values

`quantity` must be greater than `0`.

Allowed `status` values:

- `owned`
- `wishlist`
- `trade`
- `missing`

`wishlist` is not functionally used yet. `trade` and `missing` are not functionally used yet. These values already exist in the data model.

## 5. Current standard for owned insert

Current safe default values for new owned inserts are:

- `quantity = 1`
- `condition = 'Near Mint'`
- `status = 'owned'`

This is the current safe default for new additions. Later quantity and condition functionality needs a separate phase. Update or delete functionality must not be opened without a separate RLS and UI phase.

## 6. Phase 6A — cleanup of Lars' collection

Cause:

- The old Dex export/import contained placeholder and enriched versions side by side.
- A large part of the collection was therefore duplicated.
- Lore had no collection yet.
- All `2,190` original collection items belonged to Lars.

Before cleanup:

- `2,190` `collection_cards` rows.
- `1,110` placeholder links.
- `1,080` enriched links.
- `901` card keys appeared in both versions.
- `15` extra duplicate placeholder links.
- One quantity conflict.

After cleanup:

- `1,095` `collection_cards` rows.
- Total quantity: `1,095`.
- `1,095` unique catalog links.
- No quantity different from `1`.
- `1,080` enriched card links.
- `15` remaining placeholder links.

Lars' current collection baseline is `1,095` cards. This baseline was functionally checked in the app.

## 7. Decision around quantity 2

During this one-time cleanup, the user decided that cards that reached quantity `2` because of the faulty double Dex import could be restored to quantity `1`.

This was a recovery decision for the faulty import. It is not a general business rule. Future real duplicate copies must later be manageable through normal quantity functionality.

## 8. The 15 remaining placeholders

The 15 remaining records represent real cards in Lars' collection. They must not be deleted.

Current decision:

- They currently have no proven unique enriched counterpart.
- Phase 6B confirmed that no safe enriched match exists.
- Automatic cleanup is forbidden.
- Automatic delete is forbidden.
- Future catalog synchronization may only relink them when one reliable unique match is proven.
- When in doubt, they remain preserved.

## 9. Invariants

- `collection_cards` is the source of truth for ownership and status.
- `cards_catalog` is the source of truth for card metadata.
- Collection links must never break because of catalog synchronization.
- Catalog records with active collection links must not be automatically deleted.
- Imports may enrich metadata.
- Imports must not blindly replace internal IDs.
- Synchronizations must not remove collection items.
- Synchronizations must not change quantity.
- Synchronizations must not change condition or status.
- The 15 placeholders are protected against automatic cleanup.

## 10. RLS and ownership

At a high level:

- Authenticated users can read only their own profile and collections.
- `collection_cards` is scoped through the owner of the collection.
- Inserting into `collection_cards` is allowed only for a collection owned by the logged-in user.
- Update and delete are not opened for the app yet.
