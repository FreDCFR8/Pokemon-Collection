# Supabase Schema Plan

## Status

Phase 0 draft. No database changes are approved yet.

## Purpose

Define the intended Supabase direction before implementation.

Existing Supabase data must first be inspected read-only.

## Principles

- Supabase is the only source of truth.
- Supabase Auth identifies users.
- Row Level Security protects user-owned data.
- Client-side checks are not security boundaries.
- Existing data may be reused only after analysis.
- Existing schema may not force poor architecture.

## Roles

### Parent/admin

A parent/admin account will exist.

The parent/admin role may eventually manage children, permissions, and data recovery flows, but exact capabilities must be defined before implementation.

### Child user

Lars and Lore each have separate accounts.

Children may only access data permitted by RLS and the application permission model.

## Candidate tables

### profiles

Application profile linked to Supabase Auth.

Candidate columns:

- id
- auth_user_id
- display_name
- role
- created_at
- updated_at

Candidate roles:

- parent_admin
- child

### child_permissions

Optional permission table for child capabilities.

Candidate columns:

- id
- child_user_id
- granted_by_user_id
- can_view_collection
- can_add_cards
- can_edit_cards
- can_delete_cards
- created_at
- updated_at

This table is not approved for implementation yet, but it documents the likely need for permission-driven actions.

### cards_reference

Card reference data linked to Pokémon TCG API identifiers.

### sets_reference

Set reference data linked to Pokémon TCG API identifiers.

### collection_items

User-owned collection records.

v1 only needs read access for viewing existing cards.

Candidate columns:

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

Future user-owned wishlist records.

Not required for first collection-viewing implementation.

## RLS requirements

Minimum policy direction:

- parent/admin capabilities must be explicit
- child users can view their own collection
- child users can delete only when permission allows it
- child users may not access another child's private data by default
- reference data can be readable by authenticated users

## Required read-only inspection

Before writing migrations or app code, inspect:

- existing table names
- existing columns
- existing primary keys
- existing Pokémon TCG IDs
- existing ownership fields, if any
- existing Lars data volume
- whether Lore has data
- whether RLS is enabled
- whether current policies exist
- whether data is safe to migrate

## Phase 1 recommendation

The first implementation phase should not mutate collection data.

It should prove:

- authentication works
- user identity is known
- read-only access to owned collection data can be displayed
- no cross-user access is possible

## Stop Rule

If existing Supabase data does not clearly map to user-owned records, stop and design a migration plan before implementing collection features.
