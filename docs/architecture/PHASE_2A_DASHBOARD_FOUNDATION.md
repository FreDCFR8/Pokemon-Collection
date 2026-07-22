# Pokémon Collection V3 — Phase 2A Dashboard Foundation

## Status

Phase 2A is active. This document defines the approved implementation boundary for the first real read-only dashboard experience after completion of the identity, role, admin-shell and profile-settings foundation.

## Goal

Replace the current child dashboard placeholder and the administrator overview placeholder with useful, mobile-first summaries built only from existing trusted data and existing access rules.

## Starting point

- Phase 1A through Phase 1E are complete.
- Authentication and central identity runtime are active.
- Trusted roles are `child | admin`.
- Child collection isolation and administrator read access are enforced through RLS.
- The protected administrator shell is active.
- Safe profile display-name management is active.
- Existing Collection, Wishlist, Sets and Search flows are considered stable and must not regress.

## Approved scope

### Child dashboard

For Lars and Lore, the dashboard may show:

- a personal welcome section;
- total collection-card quantity;
- unique catalog cards represented in the collection;
- wishlist-card count;
- a small list of recently added collection cards;
- read-only set-progress summaries when they can be derived safely from existing data;
- quick navigation to Collection, Wishlist, Sets and Search.

### Administrator dashboard

For Frederik, the dashboard may show:

- one safe summary card for Lars;
- one safe summary card for Lore;
- collection totals and wishlist totals per child;
- a compact comparison of both profiles;
- safe empty, loading and error states;
- links into existing protected profile management.

## Data rules

- Use only existing tables, columns, RLS policies and trusted identity state.
- No new database table, view, function, trigger, policy or migration.
- No database writes.
- No service-role credential in the browser.
- Child queries must remain scoped to the authenticated child’s resolved main collection.
- Administrator queries may use only the read access already approved in Phase 1C.
- Aggregate results must be derived from exact existing rows, not from guessed or cached counts.

## Explicit non-goals

- no charts;
- no activity logging or activity timeline;
- no notifications;
- no catalog import or maintenance controls;
- no collection mutations from the dashboard;
- no account, role or ownership actions;
- no system diagnostics implementation;
- no dashboard personalization settings;
- no redesign of Collection, Wishlist, Sets, Search or card-detail flows;
- no performance refactor outside the dashboard data path.

## Recommended implementation order

1. Inspect existing collection, wishlist, catalog and set data services.
2. Define typed read-only dashboard summary models.
3. Implement one shared read-only dashboard service with explicit child/admin paths.
4. Add child dashboard UI.
5. Add administrator overview UI.
6. Add behavioral tests for identity scoping, aggregates, empty states and failures.
7. Run full tests, TypeScript validation, production build and diff checks.
8. Validate the current Vercel Preview on desktop and iPhone before merge.

## UX direction

- Mobile-first and immediately understandable for children.
- Large readable values, compact labels and clear navigation.
- No technical table names, internal roles, raw IDs or database errors.
- Recent-card content must remain visually lightweight and must not introduce a heavy image-loading regression.
- Empty states explain what the user can do next without presenting fake or disabled functionality.
- The admin dashboard remains visually distinct from the child application.

## Acceptance criteria

- Lars sees only statistics derived from Lars’s own collection and wishlist.
- Lore sees only statistics derived from Lore’s own collection and wishlist.
- Frederik sees separate safe summaries for Lars and Lore.
- No child can infer another profile’s counts or recent cards.
- Counts correctly distinguish total quantity from unique cards.
- Recently added cards are ordered deterministically and limited to a small fixed number.
- Existing Collection, Wishlist, Sets, Search, authentication, logout and profile settings continue to work.
- Loading, empty and error states are product-facing and fail safely.
- No migration or database write is introduced.
- Full repository tests and production build pass on the verified remote PR head.
- Desktop and iPhone Preview are accepted before merge.

## Stop conditions

Stop and reassess when:

- a required statistic cannot be derived reliably from existing data;
- implementation requires a new database object or broader RLS permission;
- child data isolation would depend only on UI filtering;
- dashboard queries duplicate an existing authoritative service without a reviewed reason;
- recent-card rendering materially worsens mobile loading behavior;
- the phase expands into charts, logging, notifications, imports or mutation actions.
