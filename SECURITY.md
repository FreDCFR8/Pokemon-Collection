# Security

## Status

Phase 0 draft.

## Security principles

- Supabase Auth is the authentication provider.
- Row Level Security is mandatory for user-owned data.
- Client-side checks are never sufficient for data ownership.
- API keys and secrets must never be committed.
- OpenAI integration is not part of v1.
- v1 collection behavior is read-only until ownership and permissions are proven.

## User separation

Lars and Lore each have their own account.

A parent/admin account will also exist.

The system must prevent one child user from reading or modifying another child's private collection and wishlist data by default.

Parent/admin access must be explicit. It may not be implemented as an accidental bypass of child data ownership.

## Permission model

Children may delete cards only if they have the rights to do so.

Delete permissions must be controlled by policy and application rules, not only by hiding UI buttons.

Collection writes are deferred until after the read-only collection viewer is stable.

## Row Level Security

RLS policies must be designed before feature implementation.

Minimum required policy direction:

- users can read their own profile
- users can update their own profile only where allowed
- child users can read their own collection items
- child users cannot read another child's collection by default
- child users can create collection items only when permission allows it
- child users can update collection items only when permission allows it
- child users can delete collection items only when permission allows it
- users can read their own wishlist items
- users can modify wishlist items only when permission allows it
- parent/admin cross-user access must be explicitly modeled
- authenticated users can read approved reference card data
- authenticated users can read approved reference set data

## Secrets

Allowed in repository:

- documentation
- public environment variable names
- example `.env` keys without values

Forbidden in repository:

- Supabase service role key
- OpenAI API key
- private tokens
- production secrets

## External API risk

The Pokémon TCG API is external and may fail, change, or rate-limit requests.

The application must not rely on it for user-owned state.

## AI risk

AI Assistant must not be implemented before a dedicated architecture and privacy review.

Potential AI risks:

- accidental sharing of user collection data
- prompt injection
- unclear data retention expectations
- cost control
- child-facing wording and safety
