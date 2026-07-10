# Phase 5F — Safe `cards_catalog.set_code` backfill strategy

## 1. Status

Planning only. No SQL executed. No data changed.

## 2. Goal

Define a safe strategy to backfill `cards_catalog.set_code` later.

## 3. Current state

- `cards_catalog.set_code` exists.
- All 2190 `cards_catalog` rows currently have `set_code` null.
- `cards_catalog` has 125 distinct `set_name` values.
- `sets_catalog` currently has 21 curated sets.
- Only 11 sets have enriched metadata.
- Remaining sets may have limited/manual_review metadata.

## 4. Why direct `set_name` mapping is unsafe

- `set_name` is a display/import helper.
- `set_name` is not canonical.
- Names may differ from `sets_catalog.name`.
- Spelling, spacing, or variant issues are possible.
- Not every `set_name` is currently in `sets_catalog`.
- Wrong mapping would create wrong progress counters.

## 5. Safe mapping principles

- Never guess.
- Never use internet/API lookup in Codex.
- Never map fuzzy names automatically.
- Only map values after explicit review.
- Unmapped rows remain null.
- Empty/null `set_code` is acceptable until confirmed.
- No `public.cards` usage.
- No client-side mass matching.

## 6. Recommended mapping source

Use a reviewed mapping table/document in a later phase:

`cards_set_name_mapping_v1`

Suggested columns:

- `cards_catalog_set_name`
- `set_code`
- `sets_catalog_name`
- `confidence`
- `review_status`
- `notes`

Rules:

- Only `review_status = approved` may be used for update SQL.
- `confidence` is descriptive only, not automation authority.
- If uncertain, leave `set_code` blank/null.
- One `cards_catalog_set_name` may map to one `set_code` only after approval.

## 7. Proposed workflow

- Phase 5F: strategy docs-only.
- Phase 5G: export/analyse distinct `cards_catalog.set_name` values.
- Phase 5H: create reviewed mapping CSV/document.
- Phase 5I: manual SQL plan for approved mappings only.
- Phase 5J: execute backfill manually and record execution log.
- Phase 5K: read-only progress service.
- Phase 5L: SetsPage progress UI.

## 8. Required pre-checks before future backfill

Document SQL:

### Count `cards_catalog` rows

```sql
select count(*) as cards_catalog_count
from public.cards_catalog;
```

### Count rows with `set_code` null

```sql
select count(*) as cards_catalog_set_code_null_count
from public.cards_catalog
where set_code is null;
```

### Count rows with `set_code` not null

```sql
select count(*) as cards_catalog_set_code_not_null_count
from public.cards_catalog
where set_code is not null;
```

### List distinct `set_name` with counts

```sql
select
  set_name,
  count(*) as row_count
from public.cards_catalog
group by set_name
order by set_name;
```

### List `sets_catalog` `set_code`/`name`/`source`/`source_id`

```sql
select
  set_code,
  name,
  source,
  source_id
from public.sets_catalog
order by set_code;
```

### Detect mapping rows with duplicate `cards_catalog_set_name`

```sql
select
  cards_catalog_set_name,
  count(*) as mapping_row_count
from cards_set_name_mapping_v1
group by cards_catalog_set_name
having count(*) > 1
order by cards_catalog_set_name;
```

### Detect mapping rows with `set_code` not existing in `sets_catalog`

```sql
select
  mapping.cards_catalog_set_name,
  mapping.set_code
from cards_set_name_mapping_v1 mapping
left join public.sets_catalog sets
  on sets.set_code = mapping.set_code
where mapping.review_status = 'approved'
  and mapping.set_code is not null
  and sets.set_code is null
order by mapping.cards_catalog_set_name;
```

### Estimate rows affected by approved mappings

```sql
select
  mapping.cards_catalog_set_name,
  mapping.set_code,
  count(cards.id) as estimated_rows_affected
from cards_set_name_mapping_v1 mapping
join public.cards_catalog cards
  on cards.set_name = mapping.cards_catalog_set_name
where mapping.review_status = 'approved'
  and mapping.set_code is not null
group by
  mapping.cards_catalog_set_name,
  mapping.set_code
order by mapping.cards_catalog_set_name;
```

## 9. Future update strategy

Use only approved mapping rows.

Update `cards_catalog.set_code` by exact `set_name` equality only against reviewed mapping values.

Do not use `LIKE`, `ILIKE`, similarity, fuzzy matching, or partial matching.

## 10. Stop rules

Stop if:

- Mapping contains duplicate `cards_catalog_set_name`.
- Mapping references unknown `set_code`.
- Approved mapping count is lower than expected.
- Affected row count differs from precomputed estimate.
- Any `set_name` is ambiguous.
- Any mapping was generated from guesses.
- App behavior changes unexpectedly.

## 11. Out of scope

- No actual mapping file yet.
- No backfill.
- No SQL execution.
- No progress query.
- No UI.
- No FK/index/not-null.
- No `public.cards`.
- No external API/internet enrichment.

## 12. Recommendation

Proceed next with Phase 5G: document/export distinct `cards_catalog.set_name` values with row counts.
