# Phase 2 Auth and Profile Plan

## Status

Phase 2 design draft.

This document prepares the account, profile, and ownership structure for the new Pokémon Collection app.

No database changes are approved by this document.

No runtime Supabase integration is approved by this document.

## Goal

Define the minimum safe account model before the application connects to real collection data.

The app must support:

- parent/admin
- Lars
- Lore

The app must also prepare a safe future mapping from the existing Supabase data to the new account/profile model.

## Non-goals

Phase 2 does not implement:

- collection viewing
- collection writes
- card import
- database migration
- AI
- Binder
- legacy code reuse

## Current known Supabase state

The existing Supabase table is:

```txt
public.cards
