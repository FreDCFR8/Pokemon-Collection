# Phase 5B — Set progress analysis

## Scope

This phase is documentation-only. It does not change runtime application code, Supabase schema, data files, migrations, dependencies, or SQL execution state.

The goal is to document whether the app can safely calculate per-set collection progress such as:

- Lars: `34 / 258` kaarten
- Lore: `0 / 258` kaarten

Conclusion: **not yet**. The current collection-to-card relation is reliable, but the current card-to-set relation is not explicit enough to calculate set progress safely.

## Relevant current tables and fields

### `sets_catalog`

The documented `public.sets_catalog` schema contains these fields:

- `id uuid primary key`
- `external_source text not null`
- `external_id text null`
- `set_code text null`
- `name text not null`
- `series text null`
- `printed_total integer null`
- `total integer null`
- `release_date date null`
- `generation integer null`
- `logo_url text null`
- `symbol_url text null`
- `source_url text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Important observations:

- `sets_catalog.set_code` exists and is the project-facing set code used by the set catalog import work.
- `sets_catalog.name` is intentionally not unique and is a display label, not a safe join key.
- Earlier schema planning explicitly kept `set_code` non-unique at first, with optional future uniqueness only after the selected source proves codes are stable and collision-free.
- Some initially imported rows were `manual_review` rows with limited metadata, so the set catalog is curated/reviewed data rather than a complete mapping from every card row.

### `cards_catalog`

The documented `public.cards_catalog` schema contains these fields:

- `id uuid primary key`
- `external_source text null`
- `external_id text null`
- `pokemon text not null`
- `set_name text null`
- `number text null`
- `rarity text null`
- `image_small text null`
- `image_large text null`
- `cardmarket_url text null`
- `tcgplayer_url text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Important observations:

- There is currently no documented `cards_catalog.set_code` field.
- There is currently no documented `cards_catalog.set_id` foreign key to `sets_catalog.id`.
- `cards_catalog.set_name` exists, but previous phases describe it as imported/helper data and explicitly warn that it is not complete or canonical enough to populate or drive set catalog behavior.

### `collection_cards`

The documented `public.collection_cards` schema contains these fields:

- `id uuid primary key`
- `collection_id uuid not null references public.collections(id)`
- `card_catalog_id uuid not null references public.cards_catalog(id)`
- `quantity integer not null default 1`
- `condition text null`
- `status text not null default 'owned'`
- `added_at date not null default current_date`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Important naming note: the implemented/documented foreign key column is `collection_cards.card_catalog_id`, not `card_id`. Conceptually, this is the relation from a collection-owned card row to `cards_catalog.id`.

## Reliable relations today

### `collection_cards.card_catalog_id -> cards_catalog.id`

This relation is reliable for finding the catalog card behind an owned/wishlist/trade/missing row. It is the documented foreign key from `collection_cards` to `cards_catalog` and is already used as the collection data model boundary between ownership data and catalog card data.

This means it is safe to answer questions such as: “which catalog card belongs to this collection row?”

### `collection_cards.collection_id -> collections.id`

This relation is reliable for scoping ownership rows to a specific collection. It is the documented foreign key from `collection_cards` to `collections`.

This means it is safe to answer questions such as: “which rows belong to Lars' or Lore's main collection?” once the app has resolved the relevant collection id.

## Relation that is not reliable enough today

### `cards_catalog.set_name -> sets_catalog.name`

This relation is **not** reliable enough for set progress.

Reasons:

- `sets_catalog.name` is not unique by design.
- `cards_catalog.set_name` is not a canonical set identifier.
- Earlier set catalog work explicitly rejected direct import or canonical behavior based on `cards_catalog.set_name` because values may be mixed, incomplete, inconsistent, or only present for cards already in a collection.
- Matching on loose display names would reintroduce client-side or query-layer guesswork and could silently count cards against the wrong set.

Therefore, a progress query must not join `cards_catalog.set_name` to `sets_catalog.name`.

## Why set progress cannot be calculated correctly yet

Per-set progress needs two separate counts:

1. The total number of cards in a set, for example `sets_catalog.total` or `sets_catalog.printed_total` depending on the chosen product rule.
2. The number of cards in a specific collection that belong to that same set.

The first count can come from `sets_catalog`. The second count requires a reliable card-to-set mapping. That mapping is missing.

Current blockers:

- `sets_catalog` has `set_code`.
- `cards_catalog` has no documented `set_code`.
- `cards_catalog` has no documented `set_id` reference to `sets_catalog.id`.
- `cards_catalog.set_name` is an import/helper/display field, not a canonical project mapping.
- Some `sets_catalog` rows originated as `manual_review` metadata, so a set row existing does not imply every related `cards_catalog` row can already be joined to it.

Because of this, any progress calculation now would need one of the forbidden approaches:

- using legacy `public.cards`;
- treating `cards_catalog.set_name` as canonical;
- hardcoding progress;
- creating fake mappings;
- matching client-side on loose set names;
- loading all cards client-side and deriving progress in the browser.

Those approaches are not safe for this project.

## Minimal safe solution

Add an explicit set mapping to `cards_catalog` in a later phase before building progress queries or UI.

Two reasonable options are:

### Option A — `cards_catalog.set_code text null`

Add a nullable project set-code column to `cards_catalog`.

Advantages:

- Simple to understand and migrate incrementally.
- Aligns well with Pokémon TCG API-style set identifiers and the existing project-facing `sets_catalog.set_code` concept.
- Easy to use for joins once set-code uniqueness/normalization rules are documented.
- Allows staged backfill without immediately requiring every historical card to resolve to a UUID.

Disadvantages:

- It is a textual foreign key unless the project later adds a formal constraint or uniqueness rule on `sets_catalog.set_code`.
- It still needs a careful mapping/import strategy so codes are not guessed from loose names.

### Option B — `cards_catalog.set_id uuid null references sets_catalog(id)`

Add a nullable direct foreign key from `cards_catalog` to `sets_catalog.id`.

Advantages:

- Relationally clean.
- Provides a strong foreign key to a single `sets_catalog` row.
- Avoids ambiguity if display names or external codes vary.

Disadvantages:

- Requires mapping/migrating existing `cards_catalog` rows to the correct `sets_catalog.id` values.
- More operationally sensitive because the migration must resolve UUID references, not only validated project set codes.
- Less directly aligned with import sources that naturally provide set identifiers as text codes.

## Recommendation for this project

Recommended path:

1. Add `cards_catalog.set_code text null` later as the first explicit project-level card-to-set mapping.
2. Backfill/map it only through a reviewed, deterministic import strategy.
3. Build a read-only progress query only after enough mapping reliability exists.
4. Show set progress on the Sets page only after the read-only query is verified.

This balances safety and incremental delivery. It creates an explicit mapping without prematurely requiring a full UUID foreign-key migration. A later phase can still add a stronger `set_id` relation if the project needs stricter relational guarantees.

## Proposed phasing

- **Phase 5B:** analysis, docs-only.
- **Phase 5C:** Supabase migration plan for `cards_catalog.set_code`.
- **Phase 5D:** safe mapping/import strategy for existing `cards_catalog` rows.
- **Phase 5E:** read-only set progress service.
- **Phase 5F:** SetsPage displays progress.

## Stop-rule assessment

I did not find a documented reliable `cards_catalog.set_code` or `cards_catalog.set_id` relationship in the current architecture documents inspected for this analysis.

The current reliable links stop at:

- `collection_cards.card_catalog_id -> cards_catalog.id`
- `collection_cards.collection_id -> collections.id`

Because no explicit card-to-set mapping is currently documented, the recommendation remains to add `cards_catalog.set_code` first in a later phase, then build the progress query and UI only after that mapping is reliable.
