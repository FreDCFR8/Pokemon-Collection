# Data Model

## Status

Draft for Phase 0. No schema has been approved yet.

## Principles

- Supabase is the only source of truth.
- Every collection record must belong to exactly one authenticated user.
- The model must support more users later.
- Existing Supabase data must be inspected before migration.
- Existing data may not dictate poor architecture.

## Core entities

### auth.users

Managed by Supabase Auth.

Used for Lars, Lore, and future accounts.

### profiles

Application-level user profile.

Candidate fields:

- id
- auth_user_id
- display_name
- avatar_key
- role
- created_at
- updated_at

### cards_reference

Normalized Pokémon card reference data.

Candidate fields:

- id
- pokemon_tcg_card_id
- name
- set_id
- number
- rarity
- image_small_url
- image_large_url
- supertype
- subtypes
- hp
- types
- raw_external_payload
- synced_at

### sets_reference

Pokémon set reference data.

Candidate fields:

- id
- pokemon_tcg_set_id
- name
- series
- printed_total
- total
- release_date
- symbol_url
- logo_url
- raw_external_payload
- synced_at

### collection_items

User-owned collection state.

Candidate fields:

- id
- owner_user_id
- card_reference_id
- quantity
- condition
- language
- variant
- notes
- created_at
- updated_at

### wishlist_items

User-owned wishlist state.

Candidate fields:

- id
- owner_user_id
- card_reference_id
- priority
- notes
- created_at
- updated_at

## Required ownership rule

A user may only read and write their own collection and wishlist records.

Reference card and set data may be readable by all authenticated users.

## Existing Supabase data

Known context:

- Existing Supabase data likely contains Lars's collection cards.
- It may already be structured around the Pokémon TCG API.

Required before implementation:

1. inspect existing tables
2. identify ownership model
3. identify Pokémon TCG IDs
4. decide whether to migrate, transform, or archive
5. document migration plan

No migration may happen before this analysis is complete.
