# Pokémon Collection V3 — Phase 2B Dashboard Insights

## Status

Phase 2B is active. This phase extends the Phase 2A read-only dashboards with useful collection insights while preserving the existing identity, RLS and mobile-first boundaries.

## Goal

Turn the dashboard foundation into a more informative collection overview for Lars, Lore and Frederik without introducing logging, charts, mutations or new database objects.

## Starting point

- Phase 1A through Phase 1E are complete.
- Phase 2A dashboard foundation is merged.
- Child and administrator dashboards already use trusted read-only data.
- Collection and wishlist isolation remain enforced by existing RLS.
- Existing Collection, Wishlist, Sets, Search and Profile flows are stable.

## Approved scope

### Child insights

The child dashboard may add:

- compact set progress for a limited number of relevant sets;
- recent owned-card thumbnails using existing small images;
- a rarity distribution summary presented as text or compact counters;
- a safe "verder verzamelen" section based on incomplete owned sets;
- clear links into existing Sets, Collection and Wishlist screens.

### Administrator insights

The administrator dashboard may add:

- a side-by-side Lars and Lore comparison;
- combined owned quantity and unique-card totals;
- duplicate quantities derived from `quantity > 1`;
- a compact list of sets with the largest remaining gaps per child;
- clear separation between personal and combined totals.

## Data rules

- Use only existing tables, columns, RLS policies and authenticated browser access.
- No new table, view, function, trigger, policy or migration.
- No database writes.
- No service-role credentials in the browser.
- Child insight queries must remain scoped to the authenticated child’s resolved collection.
- Administrator insight queries may use only the read access already approved for the admin role.
- Set progress is based on unique owned catalog cards divided by the authoritative catalog-card count for that set.
- Wishlist rows never count as owned progress.
- Duplicate count means extra owned quantity above one per unique card, not duplicate catalog rows.
- Insights must be deterministically ordered and limited.

## Explicit non-goals

- no charts or charting library;
- no activity history or "since last session" claims;
- no event logging;
- no notifications;
- no recommendations based on prices or external marketplaces;
- no collection or wishlist mutations;
- no import or maintenance controls;
- no account, role or ownership actions;
- no new database object or broader RLS permission;
- no redesign of established pages.

## Implementation order

1. Audit the Phase 2A dashboard service and current set catalog fields.
2. Define typed insight models and pure aggregation helpers.
3. Add the smallest read-only queries needed for set totals, rarity counts and duplicate quantities.
4. Extend the child dashboard with limited insights.
5. Extend the administrator overview with comparison insights.
6. Add focused tests for owned/wishlist separation, set progress, duplicates and deterministic limits.
7. Run repository tests, TypeScript validation, production build and diff checks.
8. Validate the Vercel Preview on desktop and iPhone before merge.

## UX direction

- Keep the dashboard readable for children and avoid dense analytics.
- Prefer short labels, large values and compact cards.
- Show at most a small number of sets or rarity groups at once.
- Recent images must use existing small-image URLs and lazy loading.
- Empty states must explain that more insights appear as the collection grows.
- The administrator view remains visually distinct and read-only.

## Acceptance criteria

- Lars sees insights derived only from Lars’s owned collection.
- Lore sees insights derived only from Lore’s owned collection.
- Wishlist cards do not increase owned totals or set progress.
- Set progress uses unique owned cards and authoritative set totals.
- Duplicate quantities are calculated consistently as quantity above one.
- Frederik sees separate and combined totals without exposing raw IDs or technical errors.
- Insights remain limited, deterministic and mobile-friendly.
- Existing navigation and Phase 2A dashboard behavior continue to work.
- No migration, database write or broader permission is introduced.
- Full tests and production build pass on the verified remote PR head.
- Desktop and iPhone Preview are accepted before merge.

## Stop conditions

Stop and reassess when:

- authoritative set totals cannot be derived reliably from existing catalog data;
- a required insight needs logging or historical snapshots;
- implementation requires a new database object or RLS change;
- child isolation depends on client-side filtering rather than RLS;
- query volume or image loading materially harms mobile performance;
- the scope expands into charts, prices, notifications, imports or mutations.

## Standard merge checklist

- Scope is respected.
- Only expected files are changed.
- No migration unless explicitly approved.
- Database writes are zero.
- Tests, TypeScript and production build pass.
- Vercel Preview is green.
- Desktop and iPhone checks pass.
- Existing functionality shows no regression.
- AI documentation is updated when a new avoidable mistake or working agreement is discovered.
