# Pokémon Collection V3 — Phase 2C-2 Dashboard Redesign

## Status

Runtime implementation is complete on PR190 and awaits Vercel plus manual Preview validation.

## Goal

Apply the Phase 2C-1 design system to a complete visual redesign of the child and administrator dashboards while preserving Phase 2B data, navigation and read-only behavior.

## Implemented child dashboard

- prominent blue identity and welcome hero;
- profile initial marker and personal-collection context;
- four touch-friendly quick actions;
- visually stronger statistic tiles;
- recent cards with larger artwork and contained metadata;
- accessible set-progress bars with text equivalents;
- structured rarity overview;
- stronger continue-collecting callout;
- mobile-first layout that expands into a two-column desktop composition.

## Implemented administrator dashboard

- dark combined Lars-and-Lore summary surface;
- combined statistics with clear hierarchy;
- separate light personal overview cards;
- profile markers and profile-management links;
- focused set-opportunity progress per child;
- responsive stacking on mobile and side-by-side child cards on desktop.

## Architecture boundaries

- Existing typed Phase 2B dashboard data remains the only input.
- No calculation was moved into the UI.
- No service, query, identity, navigation or mutation behavior changed.
- The redesign composes the existing `ButtonLink` and `StatTile` primitives.
- Styling is isolated to `src/features/dashboard/dashboard.css`.
- No unrelated page stylesheet was changed.

## Accessibility

- Progress bars use progressbar semantics and numerical ARIA values.
- Every visual progress bar retains visible owned, total and missing counts.
- Existing links remain semantic anchors.
- New actions use the 44-pixel design-system control minimum.
- Reduced-motion behavior is preserved.
- Decorative profile and background elements are hidden from assistive technology.

## Responsive requirements

Validate at:

- iPhone portrait;
- normal desktop;
- desktop at 50% browser zoom.

Recent cards intentionally remain at a maximum of two columns inside the bounded dashboard panel so wide viewport zoom does not create narrow cards.

## Explicit non-goals respected

- no redesign of Collection, Wishlist, Sets, Search, Pokédex, Profile or Card Detail;
- no global navigation redesign;
- no new dashboard statistics;
- no UI-side business calculations;
- no Supabase, schema, migration, RLS or permission changes;
- no logging, prices, charts or notifications;
- no package, animation library or icon dependency;
- no broad global CSS rewrite.

## Verification status

- Changed runtime files: `DashboardPanel.tsx` and `dashboard.css`.
- Database writes: `0`.
- Migrations: none.
- RLS or permission changes: none.
- Vercel status: pending at the current remote head.
- Manual iPhone, normal desktop and 50%-zoom checks remain required.

## Stop conditions

Do not merge when:

- the current remote-head Vercel deployment fails;
- content clips, overlaps or becomes unreadable in a required viewport;
- an unrelated page changes materially;
- dashboard navigation or data differs from Phase 2B;
- child and admin dashboards cannot be distinguished clearly;
- a runtime regression remains unresolved.

## Planned follow-up

After approval and merge, the next design phase should focus on one remaining page family at a time. It must reuse the established design system rather than introducing a competing local visual language.
