# Phase 4Q — Full Sets Catalog Source Evaluation

## Purpose

This document evaluates candidate sources for expanding `public.sets_catalog` into a full Pokémon TCG sets catalog, independent from Lars/Lore collection ownership data.

This phase is documentation only. It does **not** choose final import data, execute an import, add scripts, change schemas, generate CSV files, or modify runtime application behavior.

## Target table

`public.sets_catalog` is the long-term runtime source of truth for Pokémon set metadata.

Known columns:

- `id`
- `set_code`
- `name`
- `series`
- `generation`
- `release_date`
- `printed_total`
- `total`
- `symbol_url`
- `logo_url`
- `source`
- `source_id`
- `created_at`
- `updated_at`

## Project decisions

- The runtime app must not call a live external API for set metadata.
- External sources may only be used as offline input while preparing reviewed import data.
- `public.sets_catalog` remains the runtime source of truth.
- If a value is uncertain, unavailable, ambiguous, or not reviewable, keep the field `null`.
- Do not invent set metadata.
- Do not derive missing set rows from `cards_catalog.set_name`.
- Do not use `public.cards` as a source for catalog expansion.
- This phase does not introduce automatic synchronization.

## Evaluation criteria

Each candidate source is evaluated for:

- available fields relevant to `public.sets_catalog`;
- advantages;
- risks;
- maintainability;
- license, usage, and dependency concerns;
- suitability for import into `public.sets_catalog`;
- whether runtime usage is allowed for this project.

## Candidate 1 — Pokémon TCG API sets endpoint

Reference: Pokémon TCG API documentation describes a REST API with JSON responses, including set data endpoints; its developer portal has separate Terms of Service for API key usage.

### Available fields

The sets endpoint is the strongest structured match for the target table. Relevant fields typically include:

| `public.sets_catalog` field | Availability assessment |
| --- | --- |
| `set_code` | Available as an external set identifier/code candidate. Must be mapped deliberately, not assumed blindly. |
| `name` | Available. |
| `series` | Available. |
| `generation` | Not a direct core set field; should remain `null` unless a reviewed project mapping is added later. |
| `release_date` | Available. |
| `printed_total` | Available as printed card count. |
| `total` | Available as total card count. |
| `symbol_url` | Available through set image metadata. |
| `logo_url` | Available through set image metadata. |
| `source` | Could be recorded as `pokemon_tcg_api`. |
| `source_id` | Available from the API set id. |

### Advantages

- Structured JSON is easy to review, transform, and compare.
- Provides stable-looking identifiers suitable for `source_id`.
- Covers many fields already present in `public.sets_catalog`.
- Better suited to repeatable offline preparation than manually scraping web pages.
- Can be sampled and compared against a reviewed CSV before import.

### Risks

- It is an external community/developer API, not the runtime source of truth for this app.
- Terms, rate limits, available data, identifiers, and image URLs can change.
- Some project-specific fields, especially `generation`, are not directly guaranteed.
- Image URLs may introduce external hosting and caching questions if used directly.
- API output still requires human review before import.

### Maintainability

Good for offline preparation because data is structured and repeatable. Poor as a runtime dependency because outages, limits, terms changes, and response changes would directly affect app behavior.

### License, usage, and dependency attention points

- Review and comply with Pokémon TCG API Terms of Service before using an API key or extracting data.
- Preserve source attribution in `source` / `source_id` when data is imported.
- Do not embed live API calls into the application runtime.
- Treat images and logos as separately reviewable assets/URLs, not automatically safe local assets.

### Suitability for import

High suitability as an **offline input** to a reviewable CSV/import process. The API should not be imported directly into production without a reviewed intermediate artifact.

### Runtime usage allowed?

No. Runtime calls to the Pokémon TCG API are not allowed for this project decision. `public.sets_catalog` must serve the app at runtime.

## Candidate 2 — Official Pokémon/TPCi websites

Reference: official Pokémon websites publish set/product/card information under official site terms of use.

### Available fields

| `public.sets_catalog` field | Availability assessment |
| --- | --- |
| `set_code` | Sometimes absent or not presented in database-friendly form. |
| `name` | Usually available. |
| `series` | Sometimes inferable from pages/navigation, but should not be inferred without review. |
| `generation` | Usually not provided as a normalized field. |
| `release_date` | Often available for products/news, but not always normalized for every set. |
| `printed_total` | May be available on some pages, not guaranteed consistently. |
| `total` | May be available on some pages, not guaranteed consistently. |
| `symbol_url` | May appear visually, but reuse rights and extraction method need review. |
| `logo_url` | May appear visually, but reuse rights and extraction method need review. |
| `source` | Could be recorded as `official_pokemon`. |
| `source_id` | No universal stable API id identified for this table. |

### Advantages

- Official source, useful for validating set names, release dates, logos, and public-facing naming.
- Good cross-check source when another structured source has conflicting metadata.
- Reduces risk of relying only on community-maintained data.

### Risks

- Not optimized for complete structured exports.
- Page layout and URLs can change.
- Scraping or automated extraction may conflict with site terms or practical stability.
- Some data may be product/marketing oriented rather than normalized set catalog data.
- Manual extraction from official pages is slow and error-prone for a full catalog.

### Maintainability

Moderate to poor as a primary source. Useful as a validation/reference source, but not ideal for maintaining a full catalog by itself.

### License, usage, and dependency attention points

- Official site terms must be reviewed before copying, scraping, or reusing content.
- Use official pages as references for review, not as a runtime dependency.
- Avoid bulk scraping unless explicitly allowed and operationally necessary.
- Logos and symbols may have separate intellectual-property considerations.

### Suitability for import

Medium as a validation source. Low as the sole import source because fields are not consistently structured for all target columns.

### Runtime usage allowed?

No. Runtime dependence on official websites is not allowed. The app must read from `public.sets_catalog`.

## Candidate 3 — Bulbapedia or comparable community wiki

Reference: Bulbapedia documents its original content under a Creative Commons Attribution-NonCommercial-ShareAlike license.

### Available fields

| `public.sets_catalog` field | Availability assessment |
| --- | --- |
| `set_code` | Often available in tables/articles, but format and coverage require review. |
| `name` | Available. |
| `series` | Often available or grouped in article structure. |
| `generation` | May be available or inferable from article organization, but should not be auto-inferred. |
| `release_date` | Often available. |
| `printed_total` | Often available. |
| `total` | Often available, depending on article/table conventions. |
| `symbol_url` | Often displayed, but reuse/licensing must be reviewed carefully. |
| `logo_url` | May be available, but reuse/licensing must be reviewed carefully. |
| `source` | Could be recorded as `bulbapedia` or a comparable source name. |
| `source_id` | No single stable source id; page URL or page title may be possible but must be reviewed. |

### Advantages

- Broad historical coverage and useful context for older and international set history.
- Good for resolving discrepancies or filling review notes.
- Often includes fields that official pages may not expose consistently.

### Risks

- Community-maintained data can contain errors or undocumented changes.
- Licensing can be incompatible with some future uses, especially because of non-commercial/share-alike terms.
- Tables and article formats may change.
- Automated extraction is brittle.
- Data may include interpretations, notes, or regional distinctions that need project-specific review.

### Maintainability

Moderate as a secondary review source. Poor as a direct automated import source unless licensing and extraction stability are explicitly accepted.

### License, usage, and dependency attention points

- Bulbapedia's Creative Commons Attribution-NonCommercial-ShareAlike licensing requires careful legal/product review before reuse.
- Attribution and share-alike obligations may not fit the desired data ownership model.
- Comparable community wikis must be evaluated independently; do not assume identical licensing.

### Suitability for import

Medium to low as direct import input. Better as a cross-check/reference source while reviewing a curated CSV.

### Runtime usage allowed?

No. Runtime wiki access is not allowed.

## Candidate 4 — Manual curated CSV

### Available fields

A curated CSV can be designed to match the target table exactly:

| `public.sets_catalog` field | Availability assessment |
| --- | --- |
| `set_code` | Included when verified. |
| `name` | Included when verified. |
| `series` | Included when verified. |
| `generation` | Included only when there is an explicit reviewed mapping. Otherwise `null`. |
| `release_date` | Included when verified. |
| `printed_total` | Included when verified. |
| `total` | Included when verified. |
| `symbol_url` | Included only when the URL/source is reviewed. Otherwise `null`. |
| `logo_url` | Included only when the URL/source is reviewed. Otherwise `null`. |
| `source` | Included to document provenance. |
| `source_id` | Included when the chosen source has a stable id. Otherwise `null`. |

### Advantages

- Fully reviewable before import.
- Matches the exact project schema and nullability expectations.
- Allows multiple sources to be reconciled without making runtime dependent on any one external source.
- Easy to diff in a PR if a later phase chooses to add data.
- Supports conservative handling: uncertain fields remain `null`.

### Risks

- Manual review takes time.
- Human copy/paste or normalization mistakes are possible.
- Requires a documented process for future updates.
- Without scripts in this phase, validation remains procedural until a later phase.

### Maintainability

High if the CSV is small enough to review, versioned in Git, and paired with an import checklist. It is more maintainable than hidden ad hoc database edits because every row change can be reviewed.

### License, usage, and dependency attention points

- The CSV should record source provenance per row.
- Any copied values must be allowed by the source's terms/license.
- Avoid copying restricted prose or images; store only reviewed metadata and approved URLs.
- Use external sources as input references, not as owned canonical runtime systems.

### Suitability for import

Highest suitability for this project direction, provided it is produced in a later phase and reviewed before import.

### Runtime usage allowed?

The CSV itself is not a runtime dependency. After an approved import, `public.sets_catalog` is the runtime source of truth.

## Recommendation

Use a reviewable offline CSV/import approach in a later phase.

Recommended workflow for a future phase:

1. Use Pokémon TCG API set data as the primary structured input where terms and API usage are acceptable.
2. Cross-check important fields against official Pokémon/TPCi pages where practical.
3. Use Bulbapedia or comparable community wikis only as secondary references, with licensing concerns explicitly reviewed.
4. Produce a CSV that maps only verified values to `public.sets_catalog` columns.
5. Keep uncertain values `null`.
6. Review the CSV in Git before any Supabase import.
7. Import only after a separate execution plan and approval.

## Explicit non-goals for Phase 4Q

This phase does not:

- add effective source data;
- generate a CSV;
- import into Supabase;
- execute SQL;
- add scripts;
- modify UI;
- change filters, search, pagination, or collection progress;
- use `cards_catalog.set_name` to infer missing sets;
- use `public.cards` as input.

## Conclusion

The best direction is a conservative, reviewable, offline CSV/import process. External sources may help prepare and validate data, but they must not become runtime dependencies. `public.sets_catalog` remains the application's authoritative runtime catalog, and uncertain data should remain `null` rather than being guessed.

## References reviewed

- Pokémon TCG API documentation: https://docs.pokemontcg.io/
- Pokémon TCG API Terms of Service: https://dev.pokemontcg.io/terms
- Pokémon official Terms of Use: https://www.pokemon.com/us/legal/terms-of-use
- Bulbapedia copyright statement: https://bulbapedia.bulbagarden.net/wiki/Bulbapedia:Copyrights
