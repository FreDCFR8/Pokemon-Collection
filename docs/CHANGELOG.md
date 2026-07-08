# Changelog

## Phase 3B — App Shell & Collection Tab Cleanup

- Moved the readiness, login, status, and collection preview stack into a dedicated Dashboard page.
- Changed the Collection tab to render only the real read-only `CollectionPage`, without dashboard/debug blocks.
- Kept hash navigation, Dashboard fallback behavior, `aria-current`, and placeholder-only Sets, Wishlist, and Pokédex tabs.
- Documented the Phase 3B scope, tab split, non-goals, and rollback plan.

## Phase 3A — Read-only Collection Page Foundation

- Added a read-only Collection-tab page for the signed-in user's main collection.
- Added server-side pagination with a fixed page size of 24 cards.
- Added safe count and page queries through `collection_cards` and `cards_catalog`.
- Added mobile-first card grid, empty state, and Previous / Next navigation.
- Documented the Phase 3A scope, query path, pagination policy, performance rationale, security expectations, non-goals, and rollback plan.

## Phase 2Y — Preview Query Sorting Fix

- Changed the collection cards preview query to start from `cards_catalog` with an inner `collection_cards` filter for the current main collection.
- Moved preview sorting to root-level catalog fields (`pokemon`, `set_name`, `number`) so the first preview cards align with the direct alphabetic Supabase check.
- Kept the count query on `collection_cards`, preserved read-only behavior, avoided `public.cards`, and documented that legacy technical names remain a data-quality cleanup outside this phase.

## Phase 2X — Read-only Collection Cards Service

- Added a read-only collection cards preview service that reuses profile and collection readiness before reading `collection_cards` with nested `cards_catalog` data for the signed-in user's main collection.
- Added a UI card that reports config, login, profile, collection, loading, ready, empty, and error states while showing total count and a maximum of 12 preview cards.
- Documented that `public.cards` remains unused at runtime and that writes, imports, gallery, binder, wishlist, pricing, Pokémon TCG API, AI, local storage, SQL, and RLS changes remain out of scope.

## Phase 2W — Manual Legacy Cards Import Execution Log

- Added a documentation-only execution log for the manually performed Lars legacy import in Supabase SQL Editor.
- Documented dry-run, catalog import, collection ownership import, and final verification results for 2190 Lars records.
- Confirmed no runtime code changed, no app query was added, no `public.cards` writes occurred, no Lore import was performed, no UUIDs or secrets were documented, and no rollback was executed.

## Phase 2V — Legacy Cards Import SQL Plan

- Added a documentation-only SQL plan for a future Lars-only import from legacy `public.cards` into `public.cards_catalog` and `public.collection_cards`.
- Documented the correct `pokemon` and `number` column names, Lars source filtering, null handling, status validation, invalid-row skips, Lars main collection count guard, idempotent inserts, and rollback order.
- Confirmed no SQL was executed, no runtime code was changed, no real UUIDs or secrets were added, and `public.cards` remains untouched.

## Phase 2U — Legacy Cards Import Design

- Added a documentation-only design for a future controlled import from legacy `public.cards` into `cards_catalog` and `collection_cards`.
- Documented known legacy source fields, target-model mapping, catalog import identity, Lars ownership mapping, dry-run analysis queries, import safety requirements, risks, rollback concept, and the Phase 2V follow-up.
- Confirmed no SQL was executed, no import or migration was run, no runtime code was changed, and no app query or data write was added.

## Phase 2T - Collection Readiness Service

- Toegevoegd: collection readiness service die na profile readiness alleen eigen `public.collections` leest via `profile.id`.
- Toegevoegd: UI-kaart met refresh, hoofdcollectiestatus en expliciete bevestiging dat kaarttabellen en legacy `public.cards` niet gebruikt worden.
- Geen SQL, RLS-wijzigingen, writes, imports of kaartqueries toegevoegd.


## Phase 2R — Collection Schema Migration Plan

- Added a documentation-only SQL migration plan for the future `collections`, `cards_catalog`, and `collection_cards` tables.
- Included manual Supabase SQL Editor drafts for table creation, indexes, `updated_at` triggers, select-only RLS policies, placeholder-only main collection seed data, verification queries, and rollback.
- Confirmed this phase does not execute SQL, change runtime app code, import `public.cards`, seed catalog/card ownership data, add app queries, or introduce writes from the app.

## Phase 2Q — Collection Data Model Design

- Documented option B as the selected collection architecture: new `collections`, `cards_catalog`, and `collection_cards` tables around existing `profiles`.
- Clarified that legacy `public.cards` remains untouched as a possible import source only, not the source of truth or a security boundary.
- Captured conceptual relationships, security/RLS direction, out-of-scope items, and the proposed Phase 2R migration-plan follow-up without adding SQL, migrations, runtime queries, or app code.

## Phase 2P — Profile Readiness Service

- Added a profile readiness service that checks the active Supabase session and reads the signed-in user's own `public.profiles` record through the existing browser client boundary.
- Added a UI card that reports signed-out, missing config, missing profile, ready profile, and error states while showing display name, username, role, and child key when available.
- Confirmed this phase does not load collection data, does not use the cards table, does not write data, and does not change migrations, RLS, GitHub Actions, or Vercel workflows.

## Phase 2N — Profile Schema Migration Plan

- Added a documentation-only SQL migration plan for the future `public.profiles` table.
- Included manual Supabase SQL Editor steps for table creation, indexes, `updated_at` trigger, select-own RLS policy, placeholder-only seed data, verification queries, and rollback.
- Confirmed no real UUIDs, runtime code, Supabase app queries, collection reads, cards-table usage, automatic migration execution, RLS production changes, or workflow changes are included.

## Phase 2M — Profile Schema Design

- Added documentation for the future `profiles` table, roles, Lars/Lore/parent records, profile readiness flow, and RLS direction.
- Clarified that `auth.uid()` is the security boundary and that collection data must remain unloaded until profile ownership and access rules are safely designed.
- Confirmed this phase is documentation-only with no runtime code, SQL, migrations, RLS changes, queries, writes, cards access, or workflow changes.

## Phase 2L — Controlled Supabase Login Activation

- Activated controlled Supabase Auth sign-in through the existing auth login service for known usernames only.
- Kept `hiddenAuthEmail` internal while reporting login execution and confirmed session status in LoginPanel.
- Confirmed this phase does not load profile data, collection data, cards-table data, migrations, RLS changes, or workflow changes.

## Phase 2K — Auth Login Service Skeleton

- Added a disabled Auth Login Service Skeleton that reuses the login action boundary without importing Supabase clients or executing auth calls.
- Updated LoginPanel to prepare login through the new service while keeping login execution, profile data, and collection data disabled/not loaded.
- Documented that `loginExecuted` remains `false` and `hiddenAuthEmail` is not used for an auth call in this phase.

## Phase 2J — Login Activation Skeleton

- Added a local username-to-hidden-auth-target mapping skeleton for `lars` and `lore`.
- Updated the login action boundary and LoginPanel status display without enabling Supabase Auth calls, profile reads, collection reads, writes, migrations, or RLS changes.
- Documented the Phase 2J acceptance criteria and confirmed the hidden auth email remains internal only.

## Phase 2I — Login Activation Design

- Added a documentation-only design for future username + password login activation.
- Recommended hidden per-child pseudo-email mapping for Supabase Auth combined with a future `profiles` table.
- Confirmed that no runtime login call, database migration, writes, RLS changes, GitHub Actions changes, or Vercel workflow changes are part of this phase.
