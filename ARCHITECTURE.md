# Architecture

## Status

Phase 0 draft. No implementation is approved yet.

## Recommended stack

The recommended application stack is:

- Vite
- TypeScript
- React
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security

This choice is based on maintainability, type safety, component separation, mobile performance, and long-term extensibility.

## Application style

The app will be a mobile-first web application optimized first for iPhone Safari.

Desktop support is a responsive extension, not the primary design target.

## Architectural boundaries

The application must be separated into clear layers:

1. UI components
2. feature modules
3. application services
4. data access layer
5. external API clients
6. validation and domain rules

UI components may not directly own persistence logic.

Business rules may not be hidden inside visual components.

External API clients may not be called directly from unrelated UI code.

## Source of truth

Supabase is the only source of truth.

Local storage, IndexedDB, memory caches, and browser caches may only be used for:

- faster loading
- temporary read cache
- offline read support in a later phase

Offline writes are out of scope for v1 and require a separate ADR before implementation.

## User model

Lars and Lore each have their own account.

The architecture must support additional users later without redesigning the database.

All collection data must be user-owned and protected with Row Level Security.

## External systems

The following external systems are allowed:

- Supabase
- Pokémon TCG API
- OpenAI API, later phase only

All integrations must be newly written.

The Pokémon TCG API is a reference data provider, not the application source of truth.

## AI integration

AI Assistant is not required for v1.

The architecture may reserve a navigation position and future integration boundary, but no OpenAI runtime integration should be implemented before a dedicated ADR and phase approval.

## Binder scope

Binder is explicitly deferred.

It must not be implemented until Dashboard, Collection, Sets, Wishlist, and Pokédex are stable.

## Main navigation

Mobile top bar:

- hamburger menu
- search
- AI Assistant entry point, disabled or placeholder until approved

Primary sections:

- Dashboard
- Collection
- Sets
- Wishlist
- Pokédex

Binder is excluded from initial implementation.
