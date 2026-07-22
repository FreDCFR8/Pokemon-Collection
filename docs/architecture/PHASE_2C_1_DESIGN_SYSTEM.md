# Pokémon Collection V3 — Phase 2C-1 Design System

## Status

Phase 2C-1 is active. This phase establishes the reusable visual foundation for the later page redesigns without changing product flows, data behavior or page-specific information architecture.

## Goal

Create a small, explicit and mobile-first design system that lets Dashboard, Collection, Wishlist, Sets, Search and Card Detail adopt one consistent Pokémon Collection V3 visual language in later phases.

The design system must support the approved reference direction: calm light surfaces, strong card imagery, clear hierarchy, rounded but controlled geometry, compact metadata, touch-friendly controls and a polished desktop expansion of the same mobile structure.

## Starting point

- Authentication, roles and profile flows are stable.
- Phase 2A and Phase 2B provide the dashboard data and insight foundation.
- Existing pages contain working but visually inconsistent CSS and component patterns.
- The detailed page redesigns intentionally follow after this phase.
- Existing functionality and navigation must remain unchanged.

## Approved scope

### 1. Design tokens

Introduce one central token layer for:

- neutral and semantic colors;
- page and surface backgrounds;
- text hierarchy;
- borders and dividers;
- focus and interactive states;
- spacing scale;
- border-radius scale;
- shadows;
- typography sizes, weights and line heights;
- content widths;
- responsive breakpoints;
- transition durations and easing;
- image aspect ratios where globally reusable.

Tokens must use semantic names. Page-specific names and Pokémon-type-specific hardcoding do not belong in the global token layer unless a later approved design decision requires them.

### 2. Foundational primitives

Create or formalize the smallest reusable visual primitives needed by later phases:

- page container;
- section header;
- surface/card shell;
- stat tile;
- badge/chip;
- primary, secondary, quiet and icon-button variants;
- empty, loading and error-state shell;
- compact metadata row;
- responsive grid helpers only where genuine reuse exists.

Primitives must remain presentational. They do not fetch data, resolve identity, navigate implicitly or own business rules.

### 3. Accessibility states

The system must define and visibly support:

- keyboard focus;
- hover where supported;
- active/pressed state;
- disabled state;
- loading state;
- reduced-motion preference;
- sufficient text and control contrast;
- minimum touch target of 44 by 44 CSS pixels for primary interactive controls.

### 4. Compatibility layer

Existing pages may receive only the minimum import or wrapper changes required to prove the primitives compile and can be adopted safely.

A small isolated showcase or existing low-risk component may demonstrate the tokens and primitives. This is not permission to redesign Dashboard, Collection, Wishlist, Sets, Search or Card Detail in this phase.

### 5. Documentation

Document:

- token naming rules;
- component responsibilities;
- when to reuse versus create a new primitive;
- mobile-first behavior;
- accessibility requirements;
- prohibited page-level business logic inside design-system components;
- migration guidance for later page redesign phases.

## Explicit non-goals

- no complete dashboard redesign;
- no Collection, Wishlist, Sets, Search or Card Detail redesign;
- no navigation restructure;
- no new product functionality;
- no data fetching or mutation changes;
- no Supabase, schema, RLS or migration changes;
- no charting, animation library or icon library migration;
- no broad CSS rewrite merely to make all old files use tokens immediately;
- no removal of existing stable styles before their replacement page phase;
- no speculative component library with unused abstractions;
- no dark-mode implementation unless separately approved;
- no Pokémon type-theme system unless separately approved.

## Architecture rules

1. Tokens are the single source of truth for reusable visual values.
2. UI primitives accept content and visual variants; they do not calculate domain data.
3. Domain components compose primitives rather than extending them with hidden business behavior.
4. Existing stable page CSS remains in place until that page receives its dedicated redesign phase.
5. A token or primitive is added only when at least one approved real use exists.
6. Global styles must not use broad selectors that unexpectedly alter existing screens.
7. Component class names or CSS modules must prevent accidental style leakage.
8. Responsive behavior starts from the narrow mobile layout and expands progressively.
9. Motion must be optional, short and disabled under `prefers-reduced-motion`.
10. No external dependency is added unless the same result cannot reasonably be achieved with the current stack.

## Proposed structure

The exact file names may follow current repository conventions after inspection, but the intended responsibility split is:

- one central token stylesheet;
- one global baseline stylesheet with narrowly scoped reset and typography rules;
- one folder for presentational primitives;
- one public barrel export for approved primitives;
- focused tests for component variants and accessibility behavior;
- this architecture document as the migration contract.

Avoid one very large universal stylesheet and avoid page components importing internal token implementation details directly.

## Visual direction

### Surfaces

- light neutral application background;
- white or subtly tinted raised surfaces;
- restrained borders rather than heavy outlines;
- soft shadows used only to separate meaningful layers;
- consistent corner radii with fewer competing values.

### Typography

- strong but compact page titles;
- clear supporting text;
- short uppercase or emphasized eyebrow labels used sparingly;
- numeric statistics prominent without overwhelming the content;
- metadata smaller but still readable on iPhone.

### Controls

- clear primary action hierarchy;
- quieter secondary and tertiary actions;
- icon buttons use accessible labels and consistent dimensions;
- no tiny text links as the only important mobile action;
- destructive styling remains reserved for genuinely destructive actions.

### Cards and imagery

- Pokémon card imagery remains visually important;
- thumbnails use stable aspect ratios and object fitting;
- metadata does not compete with the card image;
- placeholders preserve layout to prevent large shifts.

## Implementation order

1. Inspect current global CSS entrypoints, typography, reusable components and duplicated values.
2. Inventory only the values and patterns required by the approved reference direction.
3. Add semantic tokens without globally changing existing pages.
4. Add the smallest presentational primitives.
5. Add one contained proof of integration.
6. Add focused tests and accessibility checks.
7. Run TypeScript, relevant tests, production build and diff checks from the verified remote PR head.
8. Verify the proof integration in Vercel Preview on iPhone and desktop.
9. Keep the PR in draft until the design-system contract and proof integration are approved.

## Acceptance criteria

- A central semantic token layer exists.
- Reusable primitives exist for the approved categories without domain logic.
- Existing page behavior and visual structure remain materially unchanged outside the isolated proof integration.
- No broad selector causes regressions on existing screens.
- Focus, disabled and reduced-motion behavior are defined.
- Touch targets meet the mobile requirement where the new primitives are used.
- No new database object, query, mutation or permission is introduced.
- No unnecessary package is added.
- TypeScript, relevant tests and production build pass on the verified remote PR head.
- Vercel Preview is green.
- The proof integration is accepted on iPhone and desktop.
- The next page-specific redesign can consume the design system without changing its core contract.

## Stop conditions

Stop and reassess when:

- the work begins redesigning a complete page;
- a primitive starts owning dashboard, collection, wishlist or set business logic;
- global styles unexpectedly alter established flows;
- the token layer becomes a duplicate of page-specific CSS rather than a semantic foundation;
- unused speculative variants are being added;
- a new dependency is proposed without a proven need;
- accessibility would be reduced compared with the existing implementation;
- the reference design requires a product-flow or information-architecture change rather than a visual primitive.

## Planned follow-up

After Phase 2C-1 is approved and merged:

- Phase 2C-2 applies the system to the Dashboard redesign;
- later focused phases apply it to Collection, Wishlist, Sets, Search and Card Detail;
- each page phase may extend the system only through a reviewed reusable need, not by adding local competing tokens.

## Standard merge checklist

- Scope is respected.
- Only expected design-system and proof-integration files are changed.
- No page redesign is hidden inside the phase.
- No database or RLS change exists.
- No unnecessary dependency exists.
- TypeScript, relevant tests and production build pass.
- Diff and changed-file scope are verified.
- Vercel Preview is green.
- iPhone and desktop proof checks pass.
- Existing authentication, Dashboard, Collection, Wishlist, Sets, Search and Card Detail flows show no regression.
- Documentation reflects any lasting design-system decision.