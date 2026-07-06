# ADR-009: Authentication Strategy

## Status

Draft

## Context

Lars and Lore each need a separate account and a completely separate collection. A parent/admin account is also required. The architecture must allow more users later.

## Decision

The application will use Supabase Auth for authentication.

Each person gets their own authenticated user account.

Initial account types:

- parent_admin
- child_lars
- child_lore

Application-specific profile data will live in a separate `profiles` table linked to Supabase Auth users.

User-owned tables must reference the authenticated user owner and be protected with Row Level Security.

Parent/admin capabilities must be explicit and policy-driven.

The first collection version is read-only. Collection changes are out of scope until the permission model is approved.

## Consequences

Positive:

- clear ownership model
- better preparation for multiple users
- supports secure RLS policies
- avoids fragile client-side profile switching
- supports future parent/admin management flows

Negative:

- requires login flow from early phases
- requires careful profile creation and onboarding
- parent/admin behavior adds permission-model complexity

## Resolved decisions

- A parent/admin account will exist.
- Lars and Lore each have separate accounts.
- Existing Supabase data must be inspected read-only first.
- The first collection feature is viewing cards only.
- Collection changes require explicit rights and a later approved phase.

## Remaining questions

- Can parent/admin view both child collections in the first read-only version?
- Can parent/admin grant and revoke collection permissions?
- Should sensitive collection changes create an audit trail?

## Enforcement

No user-owned data table may be implemented without an ownership field and RLS policy plan.
