# Pokémon Collection V3 — Functional Specification

## 1. Purpose and authority

This document is the functional source of truth for Pokémon Collection V3. It describes what the product should do, for whom, through which principal user flows and with which lasting product boundaries.

It complements, but does not replace:

- `docs/project/PROJECT_CHARTER_V2.md` for project identity and permanent principles;
- `docs/project/ROADMAP.md` for phase status and planned direction;
- `docs/project/UX_GUIDELINES.md` for lasting interaction and presentation rules;
- `docs/project/DECISION_LOG.md` for approved decisions and their reasons;
- architecture documents for technical implementation constraints.

This specification distinguishes current capabilities from planned capabilities. A planned capability is not implementation authorization. Architecture, security, database and UX review remain required before coding.

## 2. Product vision

Pokémon Collection V3 is a professional, family-oriented collection manager for Lars, Lore and their administrator. The product helps users browse the shared Pokémon card catalog, understand sets, manage personal collection state and progressively build richer collection workflows without sacrificing clarity, safety or performance.

The product should feel like a focused card application rather than an administrative database interface.

## 3. Primary users and devices

### 3.1 Lars

Lars is a child user who primarily uses the application on iPad.

His principal goals are:

- browse Pokémon sets and cards;
- see which cards he owns;
- add and manage cards in his own collection;
- maintain his own wishlist;
- use future child-approved collection features.

### 3.2 Lore

Lore is a child user with the same product capabilities and restrictions as Lars. Her collection-specific state remains separate from Lars' state.

### 3.3 Administrator

The administrator is the parent or responsible adult.

The administrator's future goals include:

- manage household access and child profiles;
- review meaningful activity by Lars and Lore;
- manage supported settings;
- use explicitly approved recovery controls;
- view household-level collection information;
- oversee productized maintenance functions when separately approved.

### 3.4 Device priorities

- iPad is the primary child-use device.
- iPhone remains a primary development and mobile-review device.
- Desktop remains supported for administration, maintenance and broader review.
- Core child flows must not depend on hover, keyboard or desktop-only layouts.

## 4. Product principles

All functional areas follow these principles:

1. Cards remain visually central.
2. Child flows use as few decisions and taps as practical.
3. Internal IDs, database language and source terminology are hidden from users.
4. Collection state is always scoped to the active authorized profile and collection.
5. Shared catalog metadata remains separate from user-owned collection state.
6. Overview screens stay calm; detail screens contain management actions.
7. Loading, empty, error, pending and confirmed states are required product states.
8. Failed reads are never presented as confirmed absence.
9. Destructive actions require clear feedback and safeguards appropriate to their risk.
10. Administrator functions are visually and technically separated from child mode.
11. New functionality should reuse established flows instead of creating page-specific variants.
12. The product must remain usable as catalog size and household functionality grow.

## 5. Functional status vocabulary

This specification uses:

- **Current:** available in the product and part of the approved functional baseline.
- **Planned:** approved product direction but not necessarily designed or implemented.
- **Design required:** the need is recognized, but important behavior remains unresolved.
- **Non-goal:** intentionally outside current product scope.

## 6. Application entry and session

### 6.1 Fixed production access

The household uses one stable production URL. New approved production deployments update the application behind that fixed URL without requiring Lars or Lore to receive a new link.

The application may be placed on each iPad home screen for app-like access.

### 6.2 Authentication

**Current:** authentication, profiles, collections and Row Level Security form part of the foundation.

**Design required:** the final household access model must determine whether the product uses one protected parent account with child-profile selection, separate authenticated accounts or another approved model.

### 6.3 Active profile

The application must always know which authorized profile and collection are active before permitting collection-specific mutations.

The active child identity must be sufficiently visible to prevent editing the wrong collection, while avoiding technical account language in child mode.

## 7. Global navigation

The principal child navigation areas are:

- Sets;
- Collection;
- Wishlist;
- Search;
- Card Detail as a contextual destination.

Future areas may include Statistics, Scanner and child-appropriate profile controls.

Administrator navigation is separate and may include:

- household overview;
- profiles and access;
- Activities;
- settings;
- supported recovery;
- household statistics.

Navigation should remain compact and consistent across iPad and iPhone. Adding a feature does not automatically justify a permanent top-level navigation item.

## 8. Home or dashboard

### 8.1 Purpose

The dashboard should answer: whose collection is active, what is the most useful next action and what recent collection progress matters.

### 8.2 Current status

A definitive product dashboard is not yet established as a core completed area.

### 8.3 Planned child dashboard

Possible content includes:

- active profile identity;
- collection totals;
- wishlist total;
- recently opened or changed cards;
- set progress highlights;
- direct access to Sets, Collection, Wishlist and Search.

The dashboard must remain concise and must not duplicate entire feature pages.

### 8.4 Planned administrator dashboard

Possible content includes:

- child-profile overview;
- recent meaningful activity;
- household collection totals;
- alerts requiring administrator attention;
- links to access management, Activities and settings.

Exact content requires a dedicated design phase.

## 9. Sets

### 9.1 Purpose

Sets provides structured browsing of the canonical Pokémon set catalog and each active profile's progress within those sets.

### 9.2 Current capabilities

- display canonical sets from `sets_catalog`;
- group and browse sets;
- server-side search and sorting;
- display collection progress;
- open a set binder;
- load card results in controlled batches.

### 9.3 Functional rules

- Internal set codes are not shown as primary product labels.
- Progress represents unique collected cards according to approved possession statuses.
- Quantity greater than one does not increase set completion.
- Incomplete or failed collection-state reads must not show false progress.
- Set browsing must remain performant as the catalog grows.

### 9.4 Planned improvements

- stronger set discovery and filtering;
- richer set summaries where useful;
- clearer progress comparison between household profiles where explicitly designed;
- optional favorite or tracked sets only after separate product approval.

## 10. Binder

### 10.1 Purpose

The binder is the visual card overview inside a selected set or collection context.

### 10.2 Current capabilities

- card-led grid presentation;
- controlled incremental loading;
- subtle confirmed collection-presence marker;
- opening Card Detail by selecting a card;
- consistent gallery behavior across Sets, Collection and Wishlist.

### 10.3 Functional rules

- Card imagery dominates the tile.
- Names, rarity, quantity controls and management actions do not clutter the grid.
- The complete card tile is interactive.
- Presence markers represent confirmed state only.
- The grid remains touch-safe and accessible.

### 10.4 iPad behavior

The binder must use the available iPad width effectively without making cards so small that recognition or touch accuracy suffers. The definitive iPad column count must be based on real-device testing rather than inherited automatically from iPhone.

## 11. Card Detail

### 11.1 Purpose

Card Detail is the shared product surface for understanding one card and managing its collection state.

### 11.2 Current capabilities

- shared use from Sets, Collection, Wishlist and Search;
- large card image with fallback behavior;
- name, set and card number;
- available catalog characteristics and metadata;
- previous and next navigation where context supports it;
- collection quantity management;
- wishlist add and remove;
- moving a wishlist card to collection;
- confirmed mutation feedback.

### 11.3 Functional hierarchy

Card Detail prioritizes:

1. close or back action;
2. large card image;
3. card name;
4. set and card number;
5. current collection or wishlist state;
6. primary management control;
7. concise status feedback;
8. available secondary characteristics.

Unavailable data is omitted instead of displayed as empty technical fields.

### 11.4 Planned capabilities

- condition editing;
- broader status editing;
- notes;
- folders or organization;
- favorite state;
- trade and missing actions;
- price and value sections when the price architecture is ready.

Each planned control must integrate into the shared detail model rather than create a separate page-specific card detail.

## 12. Collection

### 12.1 Purpose

Collection shows cards belonging to the active authorized collection and enables safe ownership management.

### 12.2 Current capabilities

- collection overview;
- server-side search, filters and pagination;
- shared card gallery;
- shared Card Detail;
- quantity management;
- confirmed server-backed ownership state.

### 12.3 Functional rules

- Collection shows collection-specific state, not duplicated catalog metadata.
- Quantity represents physical copies.
- Removing the final owned copy follows the approved delete transition.
- Mutations must preserve card identity and unrelated collection fields.
- Cross-profile collection access is forbidden.

### 12.4 Planned Collection V2

A dedicated design phase should define:

- improved browsing and organization;
- richer sorting and filters;
- multi-collection behavior;
- condition and status management;
- bulk actions, only when they can remain safe and understandable;
- collection summaries and progress views.

Collection V2 must not become a dense spreadsheet interface.

## 13. Wishlist

### 13.1 Purpose

Wishlist records cards the active profile wants but does not currently treat as collected ownership.

### 13.2 Current capabilities

- add or remove wishlist state from shared Card Detail;
- browse wishlist using the shared card gallery;
- move a card from wishlist to collection;
- use shared mutation and confirmation behavior.

### 13.3 Functional rules

- Wishlist state belongs in `collection_cards` as collection-specific status.
- Wishlist does not count as collected set completion.
- Moving to collection must produce a clear confirmed final state.
- Wishlist and owned states must not be represented simultaneously in a contradictory way for the same approved collection-state model.

### 13.4 Planned improvements

- richer wishlist filters and organization;
- optional priority or notes after separate design;
- administrator visibility only according to the approved household model;
- future links to price or availability information only when trustworthy sources exist.

## 14. Global Search

### 14.1 Purpose

Search provides access to the full internal catalog independent of the user's current collection.

### 14.2 Current capabilities

- server-side full-catalog search;
- controlled result sizes;
- shared Card Detail;
- Collection and Wishlist actions through secured shared mutation services.

### 14.3 Functional rules

- Runtime search uses the internal Supabase catalog, not a live external card API.
- Search never loads the complete catalog into the browser.
- Search actions use the same business rules as Sets, Collection and Wishlist.
- Failed ownership confirmation must not be treated as successful state.

### 14.4 Planned improvements

- advanced catalog filters;
- better result grouping and sorting;
- recent searches or saved filters only if they add clear value without clutter;
- scanner handoff into Search or Card Detail when scanning is implemented.

## 15. Collection states

The approved collection-specific statuses are:

- `owned`;
- `wishlist`;
- `trade`;
- `missing`.

### 15.1 Current product focus

The mature current flows center on `owned` and `wishlist`.

### 15.2 Planned trade workflow

Trade remains the lowest-priority collection-state workflow. Before implementation it requires design for:

- which cards are offered;
- quantity and condition;
- whether trade is household-only or involves external users;
- privacy and contact boundaries;
- completion and cancellation behavior.

### 15.3 Planned missing workflow

Missing may support explicit set-completion planning, but it must be distinguished clearly from wishlist and from a card simply not being in the collection.

## 16. Profiles and user management

### 16.1 Current foundation

Profiles and collections already exist and link collection ownership to authenticated users.

### 16.2 Planned administrator capabilities

- create, activate or manage child profiles according to the approved account model;
- manage authorized access;
- see which profile and collection are active;
- review profile-level activity;
- use protected administrator settings.

### 16.3 Child safeguards

- Lars and Lore manage only their own authorized collection state.
- Profile switching is deliberate.
- Administrator controls are hidden in child mode and protected server-side.
- The application must not trust arbitrary client-provided profile or collection identifiers.

Detailed architecture is defined in `docs/architecture/USER_MANAGEMENT_AND_ACTIVITY.md`.

## 17. Activities

### 17.1 Purpose

**Activities** is the administrator-facing history of meaningful product changes.

### 17.2 Planned recorded actions

Examples include:

- card added or removed from collection;
- quantity changed;
- wishlist state changed;
- wishlist card moved to collection;
- condition or status changed;
- note, folder or favorite changed;
- access or administrator setting changed;
- supported restore action executed.

Routine browsing, card views and search typing are not logged by default.

### 17.3 Administrator experience

The future Activities area may support:

- chronological timeline;
- filtering by child, collection, action and date;
- concise before-and-after context;
- clear distinction between child and administrator actions;
- access to supported restore controls.

### 17.4 Functional integrity

An activity entry must correspond to a successful trusted mutation. A failed mutation must not produce a false success entry. History is not silently rewritten when an action is restored.

## 18. Recovery and undo

### 18.1 Purpose

Recovery helps an administrator correct a deliberately limited set of accidental actions.

### 18.2 Planned behavior

- Only explicitly reversible actions show **Restore** or **Herstellen**.
- Recovery validates current state and authorization again.
- Recovery creates a new compensating action and preserves history.
- Recovery is blocked when later changes make the original inverse unsafe.
- Product-level recovery does not replace backups or operational database recovery.

The initial reversible action list requires explicit design and approval.

## 19. Statistics and analytics

### 19.1 Planned child statistics

Possible child-facing statistics include:

- total unique cards;
- total physical copies;
- completed or near-completed sets;
- recent collection growth;
- favorite Pokémon, types or sets where meaningful.

These should encourage collection exploration without turning the app into a competitive surveillance tool.

### 19.2 Planned administrator statistics

Possible household views include:

- totals per child;
- household catalog coverage;
- collection and wishlist trends;
- activity summaries;
- data-quality or maintenance alerts that are understandable to a non-technical administrator.

### 19.3 Source of truth

Every statistic must define whether it derives from current collection state, activity history, price history or another approved source. Activity logs must not be treated automatically as the sole source of current truth.

## 20. Price and value information

### 20.1 Status

Price synchronization, price history and value analytics are planned but remain separate from stable catalog metadata.

### 20.2 Functional principles

- Prices display source and freshness when relevant.
- Missing or stale prices are not presented as current certainty.
- Value totals distinguish collection quantity and price availability.
- Child-facing price presentation requires explicit product approval.
- Price data does not alter card identity or collection ownership.

## 21. Scanner and assisted identification

### 21.1 Purpose

A future scanner should reduce the effort required to find and add a physical card.

### 21.2 Planned flow

A likely flow is:

```text
scan or photo
→ candidate identification
→ user confirmation
→ shared Card Detail
→ approved Collection or Wishlist action
```

### 21.3 Functional rules

- Scanner results are suggestions, not unquestioned truth.
- The user confirms the intended card before mutation.
- Ambiguous results remain unresolved rather than selecting silently.
- Scanner functionality reuses catalog search, Card Detail and existing mutation services.

## 22. Import and maintenance

### 22.1 Operational catalog import

Catalog import is an administrator or operator workflow, not a child feature.

Current product rules include:

- controlled local or server-side import;
- dry-run first;
- explicit write authorization;
- stable internal IDs;
- idempotency;
- no automatic collection-data mutation;
- no automatic catalog deletes;
- resumable set-based processing.

### 22.2 Productized maintenance

A future administrator interface may expose limited, understandable status or maintenance actions only after separate architecture and security approval.

The product must not expose service-role credentials, raw SQL or a general database console.

## 23. Settings

### 23.1 Planned child settings

Child settings should remain minimal. Possible examples include:

- display preferences;
- accessible motion or text options;
- profile avatar or theme within approved limits.

### 23.2 Planned administrator settings

Possible administrator settings include:

- household access;
- child-profile configuration;
- protected profile switching;
- activity retention choices where legally and technically appropriate;
- feature availability for child profiles;
- notification preferences if notifications are introduced.

Every administrator setting requires clear scope, safe defaults and server-side enforcement where it affects permissions.

## 24. Notifications

Notifications are not an approved core feature yet.

Possible future notifications require separate design for:

- useful trigger;
- intended recipient;
- delivery channel;
- privacy;
- frequency;
- ability to disable;
- avoiding pressure or excessive engagement for children.

## 25. Accessibility and child usability

Every user-facing area must support:

- practical touch targets;
- accessible names for icon-only actions;
- readable status text rather than color-only meaning;
- visible focus behavior where keyboard use applies;
- safe dialog scrolling and iPad viewport behavior;
- clear pending and success feedback;
- no reliance on technical vocabulary.

Child usability review includes real iPad testing with attention to reachability, accidental taps, comprehension and profile clarity.

## 26. Performance behavior

Functional completeness includes acceptable performance.

Required behavior:

- server-side search, filtering and pagination;
- controlled card batches;
- thumbnails in overview grids;
- large images only in detail;
- lazy image loading;
- no full-catalog browser processing;
- no unbounded activity or collection timelines;
- explicit pagination or aggregation for large reads;
- no N+1 ownership reads.

A feature that is correct but impractical on iPad is not product-complete.

## 27. Error and recovery states

Every data-driven feature defines:

- loading;
- empty;
- filtered-empty where relevant;
- error;
- retry;
- pending mutation;
- confirmed success or refreshed truth;
- unknown state when truth cannot be established.

Errors must be understandable without exposing secrets or database implementation details.

## 28. Privacy and household boundaries

- Collection-specific state is visible only according to approved household permissions.
- Administrator access is explicit and protected.
- Activity history records only information needed for trust, recovery and support.
- Tokens, credentials and unnecessary personal information are never stored in product history.
- Future sharing, friends or trading outside the household requires a separate privacy and security design.

## 29. Non-goals

The following are not current automatic product goals:

- a public social network;
- open messaging between children and unknown users;
- a general marketplace;
- live external API dependence for normal catalog browsing;
- a technical database administration console;
- universal undo for every action;
- gamification designed to pressure daily engagement;
- automatic card identification without user confirmation;
- combining catalog metadata and user ownership in one duplicated model.

## 30. Feature design template

Before implementing a new functional area, define:

1. user and product goal;
2. entry point and navigation;
3. current and resulting state;
4. primary and secondary actions;
5. loading, empty, error and pending behavior;
6. permissions and profile scope;
7. data source of truth;
8. reuse of existing Card Detail, gallery or mutation services;
9. iPad, iPhone and desktop expectations;
10. accessibility behavior;
11. performance limits;
12. non-goals;
13. acceptance evidence;
14. documentation impact.

## 31. Open product decisions

The following require explicit design before implementation:

- final household authentication and profile-selection model;
- administrator re-authentication or PIN behavior;
- definitive dashboard content;
- iPad binder column and layout behavior;
- Collection V2 organization model;
- trade and missing workflows;
- child visibility of activity history;
- initial reversible action list;
- activity retention;
- child-facing price visibility;
- exact statistics and their source of truth;
- scanner provider and confidence flow;
- whether notifications are valuable enough to add.

These points must not be guessed inside implementation PRs.

## 32. Functional definition of done

A functional area is complete only when:

- its intended user goal is clear;
- behavior matches this specification or an approved newer decision;
- permissions and profile scope are proven;
- database truth and UI state remain aligned;
- loading, empty, error, pending and retry states exist;
- iPad and relevant mobile behavior are manually tested;
- desktop is reviewed where relevant;
- accessibility requirements are met;
- performance remains practical at realistic scale;
- shared components and mutation rules are reused appropriately;
- technical and UX review are approved;
- durable documentation is updated.
