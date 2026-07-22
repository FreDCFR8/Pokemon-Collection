# Pokémon Collection V3 — Dashboard V2 Reference

## Status

Approved executable visual specification for PR190 (`phase/2c-2-dashboard-redesign`).

This document replaces vague instructions such as “make the dashboard more premium”. It is the binding implementation reference for the child dashboard in Phase 2C-2 and the visual foundation for later page redesigns.

## 1. Governing direction

The dashboard combines three sources of direction:

1. **Information architecture:** inspired by the clear desktop hierarchy of Dex: floating header, identity hero, statistics band, collection selection, insights and recent sets.
2. **Visual identity:** the approved dark Pokémon Collection V3 concept shared in the project chat: deep navy cosmic surfaces, cyan/blue/purple glow, large card imagery and restrained glass effects.
3. **Implementation truth:** existing React architecture, typed dashboard services, Supabase/RLS boundaries and real application data.

The reference image is visually leading. The existing dashboard markup is not leading and may be replaced while services and product behavior remain stable.

## 2. Experience target

The finished dashboard must immediately feel like a premium Pokémon collection product rather than a generic admin dashboard.

The first desktop viewport should communicate, in this order:

1. product navigation and active identity;
2. personal welcome and Pokémon atmosphere;
3. essential collection totals;
4. Pokémon cards as the primary content;
5. collection progress and distribution insights;
6. recent sets and clear next actions.

The design may be rich, but it must remain calm, legible, mobile-first and usable by Lars and Lore.

## 3. Non-negotiable product rules

- Render only real application data.
- Do not invent notifications, prices, membership dates, completion percentages or statistics.
- Wishlist never counts as owned.
- All dashboard formulas remain service-owned.
- UI components do not query Supabase directly unless an explicitly approved service extension is required.
- No database write, migration, RLS or permission change.
- Existing links keep their current destinations.
- No unrelated page redesign in PR190.
- Do not use the generated reference as one flattened background image. The layout must remain real responsive HTML/CSS.

## 4. Desktop page architecture

### 4.1 Canvas

- Full viewport uses a deep navy/near-black background.
- Recommended base range: `#030816` to `#07142a`.
- Add restrained radial gradients behind hero and main content.
- Main content width: approximately 1360–1480 CSS pixels at large desktop sizes.
- Horizontal page padding: 20–32px.
- Vertical section rhythm: 20–28px.
- Content must remain centred and must not stretch without limit.

### 4.2 Floating application header

The header is a standalone floating surface, not a white page title row.

Desktop structure:

```text
[brand]       [Dashboard | Pokédex | Sets | Wishlist | Zoeken | Profiel]       [active profile] [logout]
```

Requirements:

- approximately 64–72px high;
- rounded outer shell, 20–24px radius;
- translucent navy background with subtle blur;
- fine blue/slate border;
- soft shadow and faint internal highlight;
- active navigation item has cyan/blue text and a short glowing underline;
- inactive items remain readable but quiet;
- profile area shows display name and role/context only when real data is available;
- logout remains accessible and clearly labelled;
- sticky behavior is allowed only when it does not obscure content or break iPhone scrolling;
- preserve all current navigation targets and authorization behavior.

The current global navigation may be visually wrapped/recomposed for the dashboard, but PR190 must not alter destinations, permissions or other page layouts.

### 4.3 Identity hero

A single full-width hero sits directly below the floating header.

Desktop composition:

```text
[avatar] [Hallo Lars!]
         [supporting sentence]                  [Pokémon/cosmic artwork]
```

Requirements:

- height target: 180–230px on desktop;
- rounded 24–28px shell;
- cosmic navy/blue/purple gradient background;
- optional subtle decorative card silhouettes;
- avatar 96–124px, circular, with cyan glow ring;
- greeting is large and compact;
- supporting sentence remains one or two lines;
- no grid of action buttons inside the hero;
- artwork occupies the right side but never covers text;
- hero remains useful if no decorative artwork asset is available.

Asset fallback order:

1. approved repository-owned artwork;
2. an original CSS cosmic composition with existing card thumbnails as decorative layers;
3. gradient and abstract glow without character artwork.

Do not copy third-party artwork from Dex. Do not block implementation on an unavailable Pikachu asset.

### 4.4 Integrated statistics band

Place one continuous statistics band overlapping the bottom of the hero slightly or directly beneath it.

Preferred metrics using currently approved data:

- kaarten totaal;
- unieke kaarten;
- wishlist;
- dubbels;
- sets begonnen only when already provided by the service or added through an approved read-only service calculation.

Requirements:

- one shared glass/navy surface;
- five equal segments on wide desktop when five metrics are available;
- vertical dividers rather than separate cards;
- each segment contains a compact icon treatment, large number and small label;
- colored glows differ subtly per metric but do not become a rainbow toy interface;
- numbers remain readable at 50% browser zoom;
- no hover interaction is required unless the metric links to an existing flow.

When only four approved metrics exist, render four balanced segments. Do not invent a fifth value for visual symmetry.

### 4.5 Recent collection section

Section title: **Recent toegevoegd**.

This is the primary content section and must visually prioritise actual Pokémon card images.

Desktop requirements:

- 6–8 cards visible where viewport width permits;
- use real card aspect ratio;
- image width target around 130–170px at normal desktop zoom;
- no large white tile behind each card;
- use subtle image shadow and small glow;
- metadata below image: Pokémon name, set, number/date where already available;
- metadata is secondary to the image;
- entire row may horizontally scroll when content exceeds width;
- include a clear “Bekijk collectie” link;
- use `loading="lazy"` except for the first highly visible image when justified;
- missing image placeholder preserves card dimensions.

At 50% browser zoom, cards may increase per row but must not become tiny unreadable thumbnails.

### 4.6 Insights row

Use three panels on wide desktop and stack progressively on narrower widths.

#### Panel A — Voortgang per set

- display up to four approved `setInsights`;
- show set name, exact owned/total text and percentage;
- accessible horizontal progress bar;
- one restrained accent color per row is allowed;
- include “Bekijk alle sets”.

#### Panel B — Rarityverdeling

- compact donut or ring visualization is permitted;
- must use existing rarity insight data;
- include an adjacent legend with exact counts;
- visualization remains understandable through text without color;
- no charting dependency unless explicitly approved; prefer CSS conic-gradient or small internal SVG.

#### Panel C — Uniek versus dubbels

- only show if the necessary values already exist in the service output;
- use exact approved definition of duplicate quantity;
- ring visualization plus text labels;
- do not derive new business metrics inside JSX;
- if the comparison cannot be represented honestly from existing data, replace this panel with the existing “Verder verzamelen” insight rather than inventing a percentage.

Panel visual style:

- dark navy raised surfaces;
- 18–22px radius;
- subtle border and glow;
- clear headings;
- no dense axes, legends or enterprise-dashboard chrome.

### 4.7 Recent sets section

Section title: **Recentste sets**.

This requires a controlled read-only service extension because the current dashboard insights only describe sets already represented in the collection.

Permitted data source:

- `sets_catalog` through the existing browser Supabase client and existing RLS/read permissions.

Required fields only:

- canonical set identifier/code;
- name;
- release date;
- logo or symbol URL where available;
- authoritative total/printed total required for display;
- personal owned count only when safely derived through the central dashboard service.

Ordering:

- newest release date first;
- deterministic fallback by name or set code;
- limit to 4–6 sets.

Set tile requirements:

- dark surface with softly illuminated image area;
- prominent set logo/symbol;
- set name;
- release date or compact progress text;
- personal progress bar when data exists;
- whole tile or explicit action links to the existing Sets flow;
- no marketplace or price information.

Failure behavior:

- recent sets failure must not break the rest of the dashboard;
- show a compact safe unavailable state or omit the section with a documented reason;
- never expose raw Supabase errors.

## 5. Mobile architecture

The mobile dashboard uses the same content order and identity, not a separate visual product.

### 5.1 Header

- compact 56–64px floating header;
- brand or active page label at left;
- profile/logout control at right;
- primary app navigation should use the current proven mobile pattern unless a later dedicated navigation phase approves a bottom navigation redesign;
- do not squeeze all desktop navigation labels into the header.

### 5.2 Hero

- avatar approximately 64–76px;
- greeting remains prominent;
- artwork sits to the right or becomes a background crop;
- minimum useful hero height around 150px;
- text never overlaps artwork.

### 5.3 Statistics

- 2-column grid or horizontally scrollable band;
- minimum touch and readable number size;
- no five tiny equal columns.

### 5.4 Cards

- horizontal scroll with 2–2.5 cards visible;
- snap behavior is optional and must respect reduced motion;
- preserve comfortable touch spacing.

### 5.5 Insights and sets

- stack vertically;
- legends remain beneath or beside compact visualizations;
- recent sets may horizontally scroll;
- avoid tall empty panels.

## 6. Visual language

### 6.1 Core palette

Use semantic tokens rather than hardcoding every component.

Suggested dashboard-specific semantic range:

- canvas: `#030816`;
- elevated canvas: `#07142a`;
- glass surface: `rgba(10, 27, 58, 0.78)`;
- solid panel: `#0b1933`;
- border: `rgba(98, 155, 255, 0.24)`;
- text: `#f7fbff`;
- muted text: `#9fb1cb`;
- cyan accent: `#00c8ff`;
- blue accent: `#2f7cff`;
- purple accent: `#7c3cff`;
- green accent: `#20d67b`;
- amber accent: `#ffb31f`;
- red accent: `#f04464`.

These values may be tuned for contrast, but the overall character must remain deep navy with cyan/blue/purple energy.

### 6.2 Surfaces

- glass effect is restrained and limited to header/hero/stat band;
- ordinary content panels are mostly solid dark surfaces;
- use one-pixel translucent borders;
- use internal highlights sparingly;
- avoid heavy white outlines.

### 6.3 Glow

- glow indicates focus and hierarchy;
- use around active navigation, avatar, hero artwork and selected metric icons;
- do not apply glow to every card, line and label;
- reduced-motion does not need to remove static glow.

### 6.4 Typography

- keep existing system font unless a separately approved package/font change is made;
- headings: strong, compact, semibold/bold;
- body: regular with generous line height;
- numbers: bold and clearly separated from labels;
- no uppercase paragraphs;
- eyebrow labels are short and used sparingly.

## 7. Component architecture

Preferred dashboard presentation split:

- `DashboardShell`
- `DashboardFloatingHeader` only when integration can remain dashboard-scoped
- `DashboardHero`
- `DashboardStatsBand`
- `DashboardRecentCards`
- `DashboardSetProgress`
- `DashboardRarityChart`
- `DashboardDuplicateChart` or `DashboardContinueCollecting`
- `DashboardRecentSets`
- existing loading/error/empty feedback primitives

Rules:

- components receive typed props;
- components do not fetch data;
- data orchestration stays in the dashboard service/container layer;
- visual helpers may calculate CSS-safe presentation values from already calculated percentages, but may not redefine domain formulas;
- avoid one monolithic `DashboardPanel.tsx`;
- avoid speculative generic components not used by PR190.

## 8. Data/service extension rules

Allowed service work:

- add a typed recent-set summary to dashboard state;
- add a central count of begun sets only if the definition is explicitly documented and tested;
- reuse already loaded collection rows and set metadata where possible;
- paginate/bound reads and select only required columns.

Definition for **sets begonnen**, when included:

> Number of distinct set codes containing at least one unique `owned` catalog card for the active collection.

Wishlist and trade rows do not count.

Any service extension must include focused tests for:

- owned/wishlist separation;
- distinct set counting;
- recent-set ordering and limit;
- missing logo/release date handling;
- deterministic output.

## 9. Accessibility

- semantic headings follow document order;
- interactive elements use native links/buttons;
- all controls have visible focus;
- minimum touch target 44 × 44px;
- card images have meaningful alt text where the card is content;
- decorative hero layers use empty alt or CSS backgrounds;
- charts include complete textual legends/counts;
- progress bars expose min/max/current and visible exact text;
- color is never the only information carrier;
- respect `prefers-reduced-motion`;
- verify contrast against actual dark surfaces.

## 10. Performance

- no complete catalog load;
- bound recent cards and recent sets;
- use existing small card images for dashboard thumbnails;
- avoid large uncompressed hero images;
- decorative background should prefer CSS gradients and one optimized asset;
- no N+1 requests;
- no new large UI/chart dependency;
- avoid excessive backdrop-filter layers on mobile.

## 11. Exact implementation sequence

1. Inspect current `App`, shell/header and dashboard integration points.
2. Confirm which header elements can be styled dashboard-locally without changing other pages.
3. Refactor dashboard presentation into focused components.
4. Implement dark dashboard canvas and floating header compatibility.
5. Implement hero with asset-safe fallback.
6. Implement statistics band from existing metrics.
7. Implement prominent recent-card row.
8. Implement set progress and rarity visualization.
9. Implement unique/duplicate panel only when the existing data model supports it honestly; otherwise use continue collecting.
10. Add typed bounded recent sets service output.
11. Implement recent sets tiles.
12. Implement mobile layout.
13. Verify loading, empty, partial-data and error states.
14. Run tests, TypeScript, build and diff checks from the verified remote PR head.
15. Test Vercel Preview on iPhone, normal desktop and 50% desktop zoom.
16. Compare screenshots against this specification and perform a visual correction round inside PR190.

## 12. Visual acceptance checklist

The implementation is not accepted merely because it is dark.

It must satisfy all of the following:

- floating header clearly reads as a premium application surface;
- hero is full-width and atmospheric, not a blue side card;
- statistics read as one integrated band;
- Pokémon cards dominate the main content hierarchy;
- white dashboard cards and business-admin styling are gone from the dashboard;
- insights feel designed for a collection product;
- recent sets create a clear final section;
- no section has equal visual weight by default;
- the page remains coherent at 50% zoom;
- mobile preserves hierarchy and does not become a long sequence of generic boxes;
- unrelated pages remain materially unchanged.

## 13. Explicit rejection conditions

Reject the implementation when any of these occur:

- current PR190 light layout is merely recolored dark;
- hero remains a narrow left column;
- recent cards remain small list items or generic tiles;
- charts display invented percentages;
- set data is hardcoded;
- generated reference artwork is embedded as a flattened dashboard screenshot;
- third-party Dex assets or branding are copied;
- business logic moves into JSX;
- other pages are unintentionally restyled;
- service errors become raw UI text;
- build success is used as a substitute for visual review.

## 14. PR190 completion evidence

PR190 must contain:

- exact changed-file list;
- remote head SHA;
- test/typecheck/build results;
- confirmation of zero database writes/migrations/RLS changes;
- desktop screenshot at normal zoom;
- desktop screenshot at 50% zoom;
- iPhone screenshot;
- short comparison against sections 4, 5 and 12 of this document;
- explicit remaining visual deviations, if any.
