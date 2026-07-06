# RLS Redesign Plan

## Status

Phase 0 draft.

This document defines the required Row Level Security redesign before the new application connects to real collection data.

No database changes are approved by this document.

## Context

The existing Supabase table `public.cards` contains the current card data.

Current known state:

- `public.cards` contains 2190 rows
- all rows currently belong to `collection = 'Lars'`
- all rows currently have `status = 'owned'`
- no Lore collection rows are currently present
- ownership is stored as text in the `collection` column
- `collection` is not linked to Supabase Auth users
- RLS is enabled on `public.cards`
- existing policies are too broad for the new project

The existing table is useful as legacy source data, but it is not suitable as the final security model.

## Security problem

The new application requires real user separation.

The existing `collection` text field can identify legacy data groups, but it cannot safely enforce:

- Lars-only access
- Lore-only access
- parent/admin access
- future users
- permission-based collection changes
- secure ownership through Supabase Auth

For the new project, user-owned data must be linked to authenticated users and protected by Row Level Security policies.

## Decision

The current `public.cards` table must be treated as legacy source data.

It must not become the final user-owned collection table.

The new application must use a redesigned ownership model based on:

- Supabase Auth users
- application profiles
- explicit roles
- explicit permissions
- Row Level Security policies based on authenticated identity

## Required roles

The application must support at least these roles:

### Parent/admin

The parent/admin account exists to manage or supervise the collection system.

Exact permissions still need to be approved before implementation.

Possible future permissions:

- view Lars collection
- view Lore collection
- manage child permissions
- perform imports
- perform corrections
- review sensitive changes

### Child user

Lars and Lore each have their own account.

Each child account owns or accesses its own collection data through explicit policy rules.

Children may only perform change actions when the permission model allows it.

## Target security principles

The final RLS model must follow these principles:

1. Supabase Auth is the identity source.
2. User-owned rows must reference an authenticated user or profile.
3. Client-side profile selection is not a security boundary.
4. RLS must prevent cross-user access by default.
5. Parent/admin access must be explicit.
6. Child permissions must be explicit.
7. Read permissions and write permissions must be separate.
8. No broad public write behavior is allowed.
9. Legacy data must be mapped before it becomes trusted user-owned data.
10. All migrations must have a rollback plan.

## Candidate target tables

The exact schema is not approved yet, but the following direction is recommended.

### profiles

Stores application-level profile data linked to Supabase Auth.

Candidate columns:

- `id uuid primary key`
- `auth_user_id uuid not null`
- `display_name text not null`
- `role text not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Candidate roles:

- `parent_admin`
- `child`

### child_permissions

Stores what each child account may do.

Candidate columns:

- `id uuid primary key`
- `child_profile_id uuid not null`
- `granted_by_profile_id uuid not null`
- `can_view_collection boolean not null default true`
- `can_add_cards boolean not null default false`
- `can_edit_cards boolean not null default false`
- `can_remove_cards boolean not null default false`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

This table is not required for the first read-only collection viewer, but it is needed before write features are added.

### collection_items

Stores secure user-owned collection records.

Candidate columns:

- `id uuid primary key`
- `owner_profile_id uuid not null`
- `card_reference_id uuid null`
- `legacy_card_id uuid null`
- `quantity integer not null default 1`
- `condition text null`
- `language text null`
- `variant text null`
- `notes text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### cards_reference

Stores normalized Pokémon card reference data.

Candidate columns:

- `id uuid primary key`
- `pokemon_tcg_card_id text null`
- `pokemon text not null`
- `set_name text null`
- `number text null`
- `rarity text null`
- `image_small text null`
- `image_large text null`
- `cardmarket_url text null`
- `tcgplayer_url text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### legacy_cards_import

Optional table or view for preserving imported legacy rows.

Candidate purpose:

- preserve original `public.cards` rows
- keep migration traceability
- avoid losing source data
- allow comparison between old and new records

This should only be created after migration planning is approved.

## Legacy mapping plan

Current legacy source:

```txt
public.cards.collection = 'Lars'
