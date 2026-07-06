# Security

## Status

Phase 0 draft.

## Security principles

- Supabase Auth is the authentication provider.
- Row Level Security is mandatory for user-owned data.
- Client-side checks are never sufficient for data ownership.
- API keys and secrets must never be committed.
- OpenAI integration is not part of v1.

## User separation

Lars and Lore each have their own account.

The system must prevent one user from reading or modifying another user's private collection and wishlist data.

## Row Level Security

RLS policies must be designed before feature implementation.

Minimum required policies:

- users can read their own profile
- users can update their own profile only where allowed
- users can read their own collection items
- users can create collection items for themselves only
- users can update their own collection items
- users can delete their own collection items only
- users can read their own wishlist items
- users can modify their own wishlist items
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
