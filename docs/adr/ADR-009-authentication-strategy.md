# ADR-009: Authentication Strategy

## Status

Draft

## Context

Lars and Lore each need a separate account and a completely separate collection. The architecture must also allow more users later.

## Decision

The application will use Supabase Auth for authentication.

Each person gets their own authenticated user account.

Application-specific profile data will live in a separate `profiles` table linked to Supabase Auth users.

User-owned tables must reference the authenticated user owner and be protected with Row Level Security.

## Consequences

Positive:

- clear ownership model
- better preparation for multiple users
- supports secure RLS policies
- avoids fragile client-side profile switching

Negative:

- requires login flow from early phases
- requires careful profile creation and onboarding

## Open questions

- Will there be an admin/parent account?
- Can a parent manage both child collections?
- Are destructive actions such as deleting cards restricted?

These questions must be answered before advanced management features are implemented.

## Enforcement

No user-owned data table may be implemented without an ownership field and RLS policy plan.
