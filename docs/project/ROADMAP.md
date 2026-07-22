# Pokémon Collection V3 — Roadmap

This document shows product direction and phase status. It intentionally avoids implementation detail and historical narrative.

## Status legend

- ✅ completed
- 🚧 active or next
- ⏳ planned
- 🔎 requires design or validation first
- ⛔ closed or blocked

## Foundation

- ✅ clean V3 repository and stack
- ✅ authentication, profiles and collections foundation
- ✅ normalized catalog and collection model
- ✅ RLS foundation
- ✅ stable project charter, decision log and working agreement
- ✅ documentation governance refresh

## Collection data and repair

- ✅ imported collection analysis
- ✅ duplicate import cleanup
- ✅ verified Lars baseline
- ✅ preservation of unresolved real placeholders
- ✅ explicit pagination for collection-scale reads

## Catalog and imports

- ✅ `cards_catalog` runtime source of truth
- ✅ `sets_catalog` canonical set metadata
- ✅ external-reference model
- ✅ search indexes
- ✅ controlled local import tooling
- ✅ dry-run default and explicit write authorization
- ✅ Phase 7B-2F1 through 7B-2F9E — controlled local-import foundation and Batch 1–3 operational processing
- ✅ idempotency hardening for legacy catalog details (PR144–PR146)
- ✅ local pinned dataset profile: 173 sets / 20,324 cards
- ⛔ PR147 bulk workflow closed without merge after technical review
- ✅ PR154: recover 117 canonical set rows and external references without changing existing rows
- ✅ PR156: import 10,703 cards plus 10,703 references for 116 verified sets; direct idempotency result is zero writes
- 🚧 Next: one read-only audit for the 18 exception sets (`svp` plus the 17 excluded review sets)
- 🔎 Manual-review and conflict sets remain write-blocked until that audit has an independently reviewed result

## Identity, access and administration

The app already contains functional login, session, profile and collection-resolution building blocks, but not yet one complete product-ready identity system. The approved architecture and implementation contract is defined in `docs/architecture/PHASE_1A_IDENTITY_ACCESS_ADMIN_CONTRACT.md` and extends `docs/architecture/USER_MANAGEMENT_AND_ACTIVITY.md`.

Approved account model:

- separate authenticated account for Lars;
- separate authenticated account for Lore;
- separate administrator account;
- each child account resolves exactly one child profile;
- no child profile switching;
- guest access is out of scope and has no current priority.

Phase order:

- ✅ Phase 1A — identity, access, administrator, settings and logging architecture contract
- 🚧 Phase 1B — central reactive auth/profile runtime, product login and logout
- 🔎 Phase 1C — trusted role source, role migration and child/admin RLS
- ⏳ Phase 1D — protected administrator shell
- ⏳ Phase 1E — approved user and profile settings
- ⏳ Phase 1F — trusted product activity foundation
- ⏳ Phase 1G — administrator activity view and safe operational status
- ⏳ Phase 1H — restart child dashboard on the proven identity foundation

No administrator UI, dashboard identity, activity logging or role-dependent feature may be implemented by hardcoding a profile or relying only on hidden UI controls.

## Dashboard

The earlier Dashboard D1 design remains useful as a visual and product reference, but its implementation dependencies were incomplete.

- ✅ Dashboard D1 — initial current-state analysis and visual/product direction
- ⛔ PR178 Dashboard D2 — closed without merge after login removal, hardcoded Lars identity and incorrect layout exposed missing identity dependencies
- ⏳ Dashboard restart — Phase 1H, after the required identity and role foundations are implemented
- ⏳ Dashboard data — verified bounded metrics, recent additions and continue-collecting data after the shell is approved
- ⏳ Optional artwork and motion — only after real-device validation

The dashboard may not remove functional auth/profile flows hidden inside technical readiness components. It may not display invented totals, recommendations or an unverified active profile.

## Sets and binder experience

The remaining catalog-import scope is limited to 18 exception sets. PR147 remains closed without merge. The next work is read-only evidence only; automatic writes for those exception sets are not approved.

- ✅ grouped set progress
- ✅ server-side set search and sorting
- ✅ card loading in batches
- ✅ clean three-column binder grid
- ✅ subtle collection-presence indicator
- ✅ add card from opened set
- ✅ secure quantity management

## Card detail

- ✅ functional set-card detail flow
- ✅ Phase 7C-2D1 — shared Card Detail analysis and design
- ✅ Phase 7C-2D2A — shared ownership contracts, projector and read service
- ✅ Phase 7C-2D2B — shared collection-card mutation service
- ✅ Phase 7C-2D2C — shared presentational Card Detail and Sets adapter
- ✅ Phase 7C-2D2D — read-only reuse in Collection
- ✅ Phase 7C-2D2E — Collection Card Detail quantity management
- ✅ Phase 7C-2F — Wishlist add/remove vanuit shared Card Detail (PR116 afgerond)
- ✅ Phase 7C-2G — Wishlist naar collectie (PR118 afgerond)
- ✅ Phase 7C-2H — Wishlist en Collection binder-look
- ✅ Phase 7C-2L — Uniforme kaartgalerij voor Collection, Sets en Wishlist (PR123 afgerond)
- ✅ read-only reuse in Search (Phase 7D-1A)
- ✅ Collection and Wishlist management from Search (Phase 7D-1B / PR125)
- ⏳ reuse in Trade (lowest priority)
- ✅ extended characteristics and metadata
- ✅ previous/next card navigation (PR122 afgerond)

## Collection experience

- ✅ collection overview, search, filters and pagination
- 🔎 Collection V2 product and architecture design
- ✅ read-only shared card detail integration
- ✅ shared card detail quantity management
- ⏳ improved collection browsing and management
- ⏳ multi-collection improvements

## Catalog discovery

- ✅ Phase 7D-1A — global full-catalog search (read-only, PR124 afgerond)
- ✅ Phase 7D-1B — Collection- en Wishlistacties vanuit global Search (PR125)
- ⏳ advanced catalog filters

## Collection states

- ✅ wishlist add/remove vanuit shared Card Detail (PR116 afgerond)
- ✅ wishlist naar collectie vanuit Sets en Wishlist Card Detail
- ⏳ wishlist beheer en read-model uitbreidingen
- ⏳ trade workflow (lowest priority)
- ⏳ missing workflow
- ⏳ condition and status editing

## Data enrichment

- ⏳ price synchronization
- ⏳ price history and value analytics
- ⏳ richer card characteristics
- ⏳ alternative prints and relationships

## Assisted input

- ⏳ scanner and assisted card identification
- ⏳ import/export improvements

## Product focus

Catalogusdekking, betrouwbare toegang en collectiebeheer zijn de primaire productfocus. Trade staat expliciet op de laagste prioriteit. Guest access is niet gepland in de huidige Identity and Access scope.

## Planning rule

Before starting a large product area:

1. define the product flow;
2. define UX and reusable component boundaries;
3. inspect database and security requirements;
4. identify all existing components that combine technical presentation with functional behavior;
5. split implementation into small PR-sized phases;
6. begin coding only after the dependencies and design are approved.

Roadmap order may change after analysis. Stability, data integrity, security and performance remain non-negotiable.
