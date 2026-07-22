# Pokémon Collection V3 — Dashboard D1 Analysis and Design Contract

## 1. Purpose

Dashboard D1 defines the product, data and implementation contract for replacing the current technical readiness screen with the first real child-facing dashboard.

This phase is documentation-only. It does not authorize runtime code, database migrations, RLS changes, external runtime dependencies or visual asset additions.

## 2. Current state confirmed from `main`

The dashboard is currently implemented directly inside `src/App.tsx` through `DashboardPage`.

It renders:

- the Phase 3B header and configuration-readiness hero;
- `EnvConfigStatusCard`;
- `AuthStateCard`;
- `LoginPanel`;
- `ProfileReadinessCard`;
- `CollectionReadinessCard`;
- `CollectionCardsPreviewCard`;
- `ProfileStatusCard`;
- one placeholder card for the future dashboard.

The current dashboard is therefore an operational startup surface, not a product dashboard. It mixes authentication diagnostics, public configuration checks, profile and collection readiness, database-table terminology and a long collection preview in the normal child route.

The current global shell also still shows:

- the product eyebrow `Phase 3B`;
- a generic hamburger button without an approved menu flow;
- a horizontally scrolling top navigation;
- a legacy Pokédex placeholder route.

The readiness components may remain useful as development evidence, but they must not remain visible in the normal child dashboard after Dashboard D2.

## 3. Product goal

The dashboard is the calm, visual home screen for the active child profile.

For Lars and Lore it must answer, without technical language:

1. Whose collection is active?
2. How large is my collection?
3. What is on my wishlist?
4. Which sets am I collecting?
5. What did I add recently?
6. Where can I continue?

The dashboard is not:

- an authentication screen;
- a database diagnostic page;
- a full collection listing;
- an administrator console;
- a replacement for Sets, Collection, Wishlist or Search.

## 4. Approved visual direction

The selected direction is the third dashboard concept: a dark, modern, premium interface with a deep navy foundation and blue-purple accents.

Required characteristics:

- iPad-first and fully responsive to iPhone;
- strong contrast and readable text;
- large touch targets;
- visually rich but calm;
- card artwork remains more important than metadata;
- restrained translucency and glow;
- no heavy animation required for comprehension;
- no visual effect may weaken performance, accessibility or legibility.

The concept image is inspiration, not a pixel-perfect implementation contract. Real runtime values and existing card images replace all illustrative placeholder values.

## 5. Dashboard information architecture

### 5.1 Profile hero

Shows:

- active profile display name;
- greeting such as `Hallo Lars!`;
- one short child-friendly supporting sentence;
- optional profile image or approved fallback;
- no technical role, profile ID, child key or session terminology.

The active profile must be unmistakable. Profile switching is not introduced here unless separately approved under Phase 9.

### 5.2 Primary action tiles

Four large, fully clickable tiles:

1. **Mijn collectie**
   - primary value: total physical copies or another explicitly approved collection total;
   - optional supporting value: unique collected cards;
   - destination: Collection.

2. **Wishlist**
   - primary value: number of wishlist cards;
   - destination: Wishlist.

3. **Sets**
   - primary value: number of started sets;
   - destination: Sets.

4. **Zoeken**
   - no invented count required;
   - supporting text: discover cards;
   - destination: global Search.

Each tile must have loading, ready, empty and error-safe behavior. A failed query must never be presented as zero.

### 5.3 Recent additions

A compact horizontal or responsive card strip with at most six real cards.

Each item shows:

- card image from `cards_catalog.image_small`, with safe fallback;
- card name;
- set name;
- optional concise date only when useful.

Behavior:

- sorted by the collection-specific addition timestamp, newest first;
- selecting a card opens the existing shared Card Detail;
- `Bekijk alles` navigates to Collection;
- no quantity, condition, raw status, internal ID or database label in the overview.

### 5.4 Continue collecting

At most three relevant sets with:

- set name;
- collected unique-card count;
- set total;
- completion percentage;
- visually labelled progress;
- destination to that set binder.

Initial selection must be deterministic and explainable. Preferred first rule:

1. sets with at least one physically collected card;
2. exclude completed sets unless no incomplete started sets exist;
3. rank by highest meaningful progress, with deterministic tie-breaking.

No recommendation engine or behavioral profiling is introduced in D2/D3.

### 5.5 Navigation

Dashboard D2 must use the existing application destinations and hash-routing behavior unless a separate navigation phase approves a router migration.

The visual target is a stable bottom navigation on child devices for:

- Dashboard;
- Collection;
- Sets;
- Wishlist;
- Search.

Pokédex is not part of the approved primary dashboard navigation. Its current placeholder must not block dashboard work, but removal or repositioning must be explicit in Dashboard D2 scope.

## 6. Data definitions

Dashboard figures must have one documented meaning.

### 6.1 Total physical copies

Sum of `collection_cards.quantity` for physical-possession statuses approved by the collection charter.

Current lasting rule:

- `owned` and `trade` count as physically present;
- `wishlist` and `missing` do not.

This value is not the same as unique collected cards.

### 6.2 Unique collected cards

Count of distinct `card_catalog_id` values in the active collection with a physical-possession status.

Quantity greater than one does not increase this value.

### 6.3 Wishlist count

Count of distinct wishlist card identities in the active collection. The implementation must confirm whether the current invariant permits duplicate wishlist rows; the query must not silently inflate the result.

### 6.4 Started sets

Count of sets with at least one unique physically collected card in the active collection.

### 6.5 Set completion

Use the already approved completion rule:

- unique catalog cards only;
- `owned` and `trade` count;
- `wishlist` and `missing` do not;
- quantity does not increase completion;
- denominator comes from canonical set catalog data.

### 6.6 Recent additions

The dashboard requires a verified collection-specific timestamp suitable for sorting recent additions. Before implementation, Dashboard D3 must prove the production column and semantics with read-only evidence. It must not assume that an old preview date or generic creation timestamp is correct.

## 7. Current reusable foundation

The existing application already provides useful boundaries:

- `checkCollectionReadiness` resolves the active main collection;
- Collection uses `cards_catalog` joined to `collection_cards`;
- Collection has exact server-side count behavior and paginated card reads;
- shared Card Detail is reused across product areas;
- set completion rules are already documented and implemented elsewhere in the product;
- Collection, Sets, Wishlist and Search already exist as destinations.

These foundations should be reused, but the dashboard must not call full page loaders merely to extract small summary values. Page services are presentation-specific and may load unnecessary fields or records.

## 8. Required dashboard read boundary

Dashboard D3 should introduce one clear read boundary, for example:

- `src/features/dashboard/dashboardService.ts`;
- `src/features/dashboard/dashboardTypes.ts`;
- `src/features/dashboard/DashboardPage.tsx`;
- small presentational dashboard components inside the same feature.

The service should return one typed dashboard state containing independently safe sections:

- profile summary;
- collection metrics;
- recent additions;
- continue-collecting sets.

Preferred implementation properties:

- resolve authorized active profile and collection once;
- bounded queries only;
- exact counts or server-side aggregation;
- no complete collection or catalog download;
- no N+1 ownership or set queries;
- partial section failure may degrade that section without inventing values;
- safe user-facing errors without URLs, IDs or database internals;
- stale requests must not overwrite newer profile or navigation state.

A single database RPC may be considered only after read-only schema evidence and RLS review. It is not automatically required. Multiple small parallel queries are acceptable when their semantics remain clear and bounded.

## 9. Readiness and diagnostics disposition

Dashboard D2 must remove the following from the normal Dashboard render path:

- `EnvConfigStatusCard`;
- `AuthStateCard`;
- `LoginPanel`;
- `ProfileReadinessCard`;
- `CollectionReadinessCard`;
- `CollectionCardsPreviewCard`;
- `ProfileStatusCard`;
- the Dashboard placeholder card;
- Phase 3B product-facing wording.

Removal from the child route does not automatically mean deletion of every component.

Before deleting files, D2 must inspect whether they are imported or tested elsewhere. Valid outcomes:

1. delete genuinely obsolete readiness UI and tests;
2. retain low-level readiness services used by real pages;
3. move diagnostics to a future protected administrator area only through a separate approved phase.

Do not keep hidden diagnostic DOM in the child dashboard merely to preserve old code.

## 10. Visual implementation constraints

### Theme

Use dashboard-scoped tokens or variables rather than spreading hard-coded colors through components.

The dark dashboard may define:

- page background;
- elevated panel background;
- bordered translucent surface;
- primary blue;
- secondary violet;
- success/progress color;
- warning and error colors;
- primary and secondary text;
- focus ring.

The new tokens must not accidentally restyle Collection, Sets, Wishlist or Card Detail in Dashboard D2.

### Artwork

Initial implementation must be strong without a large licensed character illustration.

Approved initial hero treatment:

- abstract light or card shapes;
- subtle stars or particles implemented efficiently;
- optional approved profile sprite or fallback only after asset-source and caching decisions.

Real card images come from the existing catalog. No fabricated trading cards may be shipped.

### Motion

- optional and subtle;
- respect `prefers-reduced-motion`;
- no continuous expensive animation;
- no motion required to understand state.

### Accessibility

- text contrast suitable for dark surfaces;
- visible focus states;
- icon-only controls have accessible names;
- status not communicated by color alone;
- progress includes readable text;
- touch targets approximately 44 × 44 CSS pixels or larger;
- card strips remain keyboard usable on desktop.

## 11. Responsive contract

### iPhone

- two-column primary tile grid;
- recent cards may use a bounded horizontal strip;
- continue-collecting sets stack vertically;
- fixed or sticky bottom navigation must respect safe areas and never cover content;
- no horizontal page overflow.

### iPad portrait

- four primary tiles may fit in one row when readable, otherwise two by two;
- recent cards and continue-collecting content may share the available width only when neither becomes cramped;
- touch-first remains primary.

### iPad landscape and desktop

- dashboard uses a bounded content width;
- recent cards may occupy the larger column and set progress a smaller side column;
- content must not stretch into an empty desktop-wide canvas;
- hover is optional enhancement only.

Breakpoints follow content needs, not specific device names.

## 12. State model

The dashboard needs explicit states:

- initial loading;
- profile unavailable;
- collection unavailable;
- ready with data;
- ready with empty collection;
- section-level loading where later refreshes apply;
- section-level error;
- full blocking error only when the authorized profile or collection cannot be resolved.

Skeletons should match final geometry and avoid large layout shifts.

## 13. Performance contract

- no full collection load;
- no full sets load solely for dashboard totals;
- no more than the approved recent-card limit;
- thumbnails only in dashboard strips;
- lazy-load noncritical images;
- avoid image-heavy hero content in the first visual phase;
- aggregate server-side when a result could exceed Supabase/PostgREST response limits;
- measure on the real production-sized Lars collection;
- verify iPad and iPhone scrolling and first meaningful render.

## 14. Security and privacy contract

- all collection-specific dashboard data remains scoped through authenticated user → profile → collection;
- RLS remains the final boundary;
- client-provided collection IDs are not trusted independently;
- no administrator metrics or cross-child activity on a child dashboard;
- no technical errors, UUIDs, source IDs, tokens or Supabase terminology shown;
- no new service-role or external API call from the browser.

## 15. Phase split after D1

### Dashboard D2 — Shell and visual replacement

Scope:

- extract `DashboardPage` from `App.tsx` into a dashboard feature;
- replace the readiness UI in the Dashboard route;
- implement dark responsive shell, hero, four tiles and section placeholders/skeletons;
- align primary navigation with the approved dashboard direction;
- no new dashboard aggregation or schema work;
- no fake production values.

D2 may use safe empty/loading presentation until D3 connects verified data.

### Dashboard D3 — Verified data integration

Scope:

- prove required production columns and invariants read-only;
- add typed bounded dashboard read service;
- connect collection metrics;
- connect recent additions;
- connect continue-collecting sets;
- reuse shared Card Detail and existing destinations;
- test partial failures, empty state and real collection scale.

### Dashboard D4 — Optional visual enrichment

Scope only after separate approval:

- approved profile imagery or cached sprite;
- refined abstract hero artwork;
- subtle motion;
- final polish based on real-device evidence.

D4 must not hide unresolved data, accessibility or performance issues.

## 16. Dashboard D2 acceptance criteria

Before D2 can merge:

- Dashboard contains no Phase 2/3 readiness panels or technical terminology;
- no invented totals or recommendations are displayed;
- Collection, Sets, Wishlist and Search remain reachable;
- active destination is clear;
- iPhone and iPad layouts match the responsive contract;
- loading and empty placeholders are product-facing;
- keyboard focus and touch targets are usable;
- no unrelated feature styling regresses;
- TypeScript, automated tests and production build pass;
- Vercel Preview is manually reviewed on iPhone and iPad;
- exact changed files and remote PR head are verified.

## 17. Dashboard D3 acceptance evidence

Before D3 can merge:

- read-only evidence identifies all production columns and status semantics used;
- metric definitions match this contract;
- count and aggregation queries are bounded and RLS-scoped;
- recent additions return no more than the approved limit and sort deterministically;
- set progress matches existing Sets completion behavior for sampled sets;
- a failed section never appears as zero or empty success;
- no N+1 request pattern;
- empty collection behavior is tested;
- Lars-scale performance is measured;
- shared Card Detail opens from recent cards;
- navigation to selected set binder works;
- no writes are introduced by dashboard loading.

## 18. Explicit non-goals

Dashboard D1–D3 do not introduce:

- administrator dashboard;
- activity timeline;
- notifications;
- profile switching;
- personalized recommendation engine;
- price or collection-value summaries;
- scanner shortcuts;
- achievements or gamification;
- external live Pokémon API dependency;
- router migration;
- global redesign of all product pages.

These require their own approved product phases.

## 19. Decision summary

The technical startup dashboard will be replaced, not cosmetically patched.

Implementation will preserve proven profile, collection, catalog, RLS, shared Card Detail and navigation foundations while introducing a dedicated bounded dashboard feature. Dashboard D2 owns the visual child-facing replacement; Dashboard D3 owns verified data integration; optional artwork and motion are deferred to D4.
