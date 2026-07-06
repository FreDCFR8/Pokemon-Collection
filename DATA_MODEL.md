# Data Model

## Status

Draft for Phase 0. No schema has been approved yet.

## Principles

- Supabase is the only source of truth.
- Every collection record must belong to exactly one authenticated user.
- The model must support more users later.
- Existing Supabase data must be inspected read-only before migration.
- Existing data may not dictate poor architecture.
- v1 collection behavior is read-only until ownership and permissions are proven.

## Core entities

### auth.users

Managed by Supabase Auth.

Used for Lars, Lore, parent/admin, and future accounts.

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

Candidate roles:

- parent_admin
- child

### child_permissions

Permission model for child capabilities.

Candidate fields:

- id
- child_user_id
- granted_by_user_id
- can_view_collection
- can_add_cards
- can_edit_cards
- can_delete_cards
- created_at
- updated_at

This table is a candidate model only. Exact implementation must be approved after RLS design.

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

v1 scope: read-only viewing of collection cards.

Collection mutations are deferred until permission-based writes are designed and approved.

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

Wishlist is not part of the first collection-viewing phase.

## Required ownership rule

A child user may only read their own collection and wishlist records by default.

A child user may only mutate records when explicit permission allows it.

A parent/admin account may exist, but its cross-user capabilities must be explicit and protected by RLS and application rules.

Reference card and set data may be readable by all authenticated users.

## Existing Supabase data

Known context:

- Existing Supabase data likely contains Lars's collection cards.
- It may already be structured around the Pokémon TCG API.

Required before implementation:

1. inspect existing tables read-only
2. identify ownership model
3. identify Pokémon TCG IDs
4. identify whether Lore data exists
5. identify whether RLS exists
6. decide whether to migrate, transform, archive, or keep existing data
7. document migration plan

No migration may happen before this analysis is complete.
