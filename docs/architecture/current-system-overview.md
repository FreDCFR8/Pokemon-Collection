# Current System Overview

## Status

This document captures the current Pokémon Collection V3 architecture after the Phase 6A collection cleanup. Earlier Phase 4 and Phase 5 documents remain useful historical context, especially the `sets_catalog` creation and import policy documents and the set-progress analysis, but any older counts based on the pre-cleanup `2,190` collection rows are superseded here for the current Lars collection baseline.

## 1. Project goal

Pokémon Collection is a professional, mobile-first Pokémon Collection Manager designed for multiple years of continued development. The product must support multiple profiles, multiple collections per profile, and extension of new functionality without breaking existing behavior.

Security, performance, and maintainability are core requirements. `main` must remain stable, and each change should use one focused branch and one focused PR for a clearly defined goal.

## 2. Technology

The current stack is:

- Vite
- React
- TypeScript
- Supabase
- Vercel

## 3. Core tables

### `profiles`

- Links an application profile to Supabase Auth.
- Profile data is user-scoped.
- Lars is currently the profile with an imported collection.
- Lore currently has no imported collection.

### `collections`

- Collection container per profile.
- One profile may later own multiple collections.
- The active main collection is determined through the existing collection-readiness flow.

### `cards_catalog`

- Central card catalog.
- Describes what a card is.
- Exists independently from ownership.
- Currently mostly contains historical card data from Lars' Dex import.
- Will be expanded into a complete card catalog in Phase 7B.

### `collection_cards`

- Links a card from `cards_catalog` to a collection.
- Stores ownership, status, quantity, and condition.
- Is not the card catalog itself.

### `sets_catalog`

- Central source for canonical set metadata.
- `set_code` is the internal project identity for sets.
- Internal set codes are not displayed to end users.

## 4. Legacy

`public.cards` is legacy. It must not be used for new runtime functionality.

New functionality uses:

- `profiles`
- `collections`
- `cards_catalog`
- `collection_cards`
- `sets_catalog`

## 5. Runtime dataflow

Main flow:

```text
authenticated user
→ profile
→ main collection
→ collection_cards
→ cards_catalog
→ sets_catalog
```

Meaning:

- Supabase Auth determines the authenticated user.
- `profiles` determines the application profile for that user.
- `collections` determines the active collection.
- `collection_cards` determines which cards are linked to that collection.
- `cards_catalog` provides card metadata.
- `sets_catalog` provides canonical set metadata.

## 6. Current functional state

Currently available:

- login and authentication
- profile selection
- collection overview
- server-side search within the collection
- server-side filtering
- pagination
- smart set and rarity filters
- Sets page
- progress per set
- sets grouped by series
- set cards can be opened inline

Adding cards is not functionally available yet. PR 89 was deliberately closed without merge because adding cards does not primarily belong on the Collection page.

## 7. Next main phases

- Phase 7B: complete card catalog.
- Phase 7C: add a card from an opened set.
- Phase 7D: general card search over the complete catalog.
- Phase 7E: wishlist.

## 8. Permanent project principles

- One source of truth per data type.
- Data integrity over fast shortcuts.
- External APIs are not used directly as runtime sources.
- Mobile-first UI.
- Server-side filtering and pagination.
- Small, controlled PRs.
- Important architecture, database, and security decisions are documented.
- No regressions are accepted for new functionality.
