# Pokémon Collection V3 — Phase 2C-2 Dashboard Redesign

## Status

Phase 2C-2 is active. This phase applies the merged design system to a complete visual redesign of the child and administrator dashboards while preserving the existing Phase 2B data model, navigation and read-only behavior.

## Goal

Transform the current functional dashboard into the first fully polished Pokémon Collection V3 screen: mobile-first, visually distinctive, card-focused and consistent with the approved premium card-detail reference direction.

## Starting point

- Phase 2A dashboard foundation is merged.
- Phase 2B dashboard insights are merged.
- Phase 2C-1 design tokens and UI primitives are merged.
- Dashboard data, formulas and RLS behavior are already approved.
- The current dashboard is functionally correct but visually generic.

## Approved scope

### Child dashboard

Redesign:

- welcome/identity hero;
- quick actions;
- collection statistics;
- recently added cards;
- set-progress presentation;
- rarity summary;
- continue-collecting recommendation;
- mobile and desktop composition.

### Administrator dashboard

Redesign:

- combined Lars and Lore summary;
- separate child overview cards;
- comparison hierarchy;
- duplicate, wishlist and set-gap presentation;
- mobile and desktop composition.

### Reusable visual elements

Use and, only when a proven reusable need exists, extend:

- semantic design tokens;
- surfaces;
- stat tiles;
- badges;
- buttons and links;
- section headings;
- feedback states;
- progress bars;
- card-thumbnail treatments.

Any extension must remain presentational and reusable beyond the dashboard.

## Visual direction

- Pokémon card imagery is the primary visual content.
- The hero must clearly identify the active child without becoming childish.
- Strong hierarchy: hero → key statistics → recent cards → progress and secondary insights.
- Use calm light surfaces with restrained blue accents, soft depth and controlled rounded geometry.
- Statistics must be easier to scan than the current uniform tiles.
- Recent cards should use larger thumbnails and clearer metadata hierarchy.
- Set progress should use accessible progress bars and exact counts.
- “Verder verzamelen” should feel like a meaningful next step, not an empty text block.
- Desktop expands the same mobile hierarchy rather than introducing a separate layout concept.

## Data and architecture rules

- Reuse the existing `dashboardService.ts` output without adding UI-side calculations.
- UI components render already calculated values only.
- No new Supabase query unless an approved visual requirement cannot be met from the existing typed dashboard state.
- No mutation or implicit navigation.
- Wishlist never counts as owned.
- Set progress remains based on unique owned cards and authoritative set totals.
- Admin combined unique totals remain deduplicated across both children.
- Images use existing small-image URLs and lazy loading.

## Accessibility and responsive requirements

- Mobile-first from 320 CSS pixels.
- Primary controls have at least 44 × 44 CSS pixels.
- Visible keyboard focus.
- Semantic headings and landmark structure.
- Progress values remain understandable without relying on color.
- Decorative imagery uses empty alternative text; meaningful imagery uses useful alternative text.
- Reduced-motion preferences are respected.
- Text remains readable without requiring zoom.
- Desktop and 50% browser zoom must not create clipped or overlapping content.

## Explicit non-goals

- no redesign of Collection, Wishlist, Sets, Search, Pokédex, Profile or Card Detail;
- no global navigation redesign beyond dashboard-local visual compatibility;
- no data model, database, migration, RLS or permission change;
- no new dashboard statistics or formulas;
- no event logging, notifications, prices or marketplace content;
- no chart library;
- no external design-system, animation or icon dependency;
- no broad rewrite of global legacy CSS;
- no speculative theme or dark-mode system.

## Implementation order

1. Inspect the merged Phase 2C-1 primitives and current dashboard markup/CSS.
2. Define the final child and admin dashboard information hierarchy.
3. Add only proven reusable primitives such as progress and thumbnail shells when required.
4. Refactor dashboard presentation into small presentational components.
5. Implement the child dashboard redesign.
6. Implement the administrator dashboard redesign.
7. Verify loading, empty and error states.
8. Run TypeScript, relevant tests, production build and diff checks from the verified remote PR head.
9. Test Vercel Preview on iPhone and desktop, including 50% desktop zoom.
10. Merge only after visual and functional acceptance.

## Acceptance criteria

- The dashboard visibly matches the approved premium Pokémon Collection V3 direction.
- Child identity and primary actions are immediately clear.
- Pokémon card thumbnails receive stronger visual emphasis.
- Statistics, progress and rarity information have distinct visual hierarchy.
- Set progress uses accessible visual progress indicators with exact text values.
- The continue-collecting area presents a clear next step.
- Administrator combined and personal statistics are unmistakably separated.
- Existing dashboard data and formulas remain unchanged.
- Existing links still open the same flows.
- Loading, empty and error states remain safe and understandable.
- No unrelated page is materially restyled.
- No migration, RLS change, database write or new dependency exists.
- TypeScript and production build pass on the verified remote PR head.
- Vercel Preview is accepted on iPhone, normal desktop and 50% desktop zoom.

## Stop conditions

Stop and reassess when:

- the design requires new domain calculations in JSX;
- a requested visual requires database or RLS changes;
- the work starts redesigning another page or global navigation;
- broad global selectors alter unrelated screens;
- card images or queries materially harm mobile performance;
- the admin dashboard exposes technical IDs or raw error details;
- the layout becomes dependent on one fixed viewport width;
- visual polish reduces keyboard, screen-reader or contrast quality.

## Planned follow-up

After Phase 2C-2 is approved and merged, the next page-specific redesign should be selected based on user value and reuse opportunity. Likely candidates are Collection/Wishlist or Sets, but this is not part of this phase.

## Standard merge checklist

- Scope is respected.
- Dashboard-only redesign is confirmed.
- Changed files are expected.
- No database, migration, RLS or dependency change exists.
- Dashboard formulas and service behavior remain unchanged.
- TypeScript, relevant tests and production build pass.
- Diff and remote head are verified.
- Vercel Preview is green.
- iPhone, desktop and 50% zoom checks pass.
- Authentication, navigation and core collection flows show no regression.
- Visual acceptance is explicitly confirmed before merge.
