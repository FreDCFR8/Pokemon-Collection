# Phase 4V — Full Sets CSV v1 Manual Import SQL

## 1. Status

Phase 4V is SQL preparation only.

This document prepares reviewed SQL for a future manual Supabase import/upsert of the 11 validated rows from `data/sets/full-sets-catalog-v1.csv` into `public.sets_catalog`.

This phase does not execute SQL, does not import data, does not modify the CSV, and does not change application code.

## 2. Safety warning

Review this SQL before any manual execution.

Do not execute this SQL automatically.
Do not execute this SQL through the app.
Do not execute this SQL through a script.

Only run the import block manually in Supabase after the pre-checks have been reviewed and confirmed to be expected.

## 3. Pre-check SQL

Run these checks first. If any result is unexpected, stop and do not run the import SQL.

```sql
-- Current row count in public.sets_catalog.
select count(*) as sets_catalog_count
from public.sets_catalog;

-- Existing rows for the 11 target set codes.
select
  set_code,
  name,
  series,
  generation,
  release_date,
  printed_total,
  total,
  symbol_url,
  logo_url,
  source,
  source_id,
  created_at,
  updated_at
from public.sets_catalog
where set_code in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv45',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
)
order by set_code;

-- Duplicate set_code check across the full target table.
select
  set_code,
  count(*) as row_count
from public.sets_catalog
group by set_code
having count(*) > 1
order by set_code;

-- Paldean Fates mapping check: expected set_code sv45 with source_id sv4pt5.
select
  set_code,
  name,
  source,
  source_id
from public.sets_catalog
where set_code = 'sv45'
   or source_id = 'sv4pt5'
   or name = 'Paldean Fates'
order by set_code, source_id;

-- Source_id conflict check for the 11 incoming source_ids.
-- Expected: no conflicting source_id attached to a different set_code.
select
  set_code,
  name,
  source,
  source_id
from public.sets_catalog
where source_id in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv4pt5',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
)
and set_code not in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv45',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
)
order by source_id, set_code;
```

## 4. Import SQL

Run this block only after the pre-check results have been reviewed and confirmed to be expected.

```sql
begin;

insert into public.sets_catalog (
  set_code,
  name,
  series,
  generation,
  release_date,
  printed_total,
  total,
  symbol_url,
  logo_url,
  source,
  source_id
)
values
  ('sv1', 'Scarlet & Violet', 'Scarlet & Violet', null, '2023-03-31', 198, 258, 'https://images.pokemontcg.io/sv1/symbol.png', 'https://images.pokemontcg.io/sv1/logo.png', 'pokemon_tcg_api', 'sv1'),
  ('sv2', 'Paldea Evolved', 'Scarlet & Violet', null, '2023-06-09', 193, 279, 'https://images.pokemontcg.io/sv2/symbol.png', 'https://images.pokemontcg.io/sv2/logo.png', 'pokemon_tcg_api', 'sv2'),
  ('sv3', 'Obsidian Flames', 'Scarlet & Violet', null, '2023-08-11', 197, 230, 'https://images.pokemontcg.io/sv3/symbol.png', 'https://images.pokemontcg.io/sv3/logo.png', 'pokemon_tcg_api', 'sv3'),
  ('sv3pt5', '151', 'Scarlet & Violet', null, '2023-09-22', 165, 207, 'https://images.pokemontcg.io/sv3pt5/symbol.png', 'https://images.pokemontcg.io/sv3pt5/logo.png', 'pokemon_tcg_api', 'sv3pt5'),
  ('sv4', 'Paradox Rift', 'Scarlet & Violet', null, '2023-11-03', 182, 266, 'https://images.pokemontcg.io/sv4/symbol.png', 'https://images.pokemontcg.io/sv4/logo.png', 'pokemon_tcg_api', 'sv4'),
  ('sv45', 'Paldean Fates', 'Scarlet & Violet', null, '2024-01-26', 91, 245, 'https://images.pokemontcg.io/sv4pt5/symbol.png', 'https://images.pokemontcg.io/sv4pt5/logo.png', 'pokemon_tcg_api', 'sv4pt5'),
  ('sv5', 'Temporal Forces', 'Scarlet & Violet', null, '2024-03-22', 162, 218, 'https://images.pokemontcg.io/sv5/symbol.png', 'https://images.pokemontcg.io/sv5/logo.png', 'pokemon_tcg_api', 'sv5'),
  ('sv6', 'Twilight Masquerade', 'Scarlet & Violet', null, '2024-05-24', 167, 226, 'https://images.pokemontcg.io/sv6/symbol.png', 'https://images.pokemontcg.io/sv6/logo.png', 'pokemon_tcg_api', 'sv6'),
  ('sv6pt5', 'Shrouded Fable', 'Scarlet & Violet', null, '2024-08-02', 64, 99, 'https://images.pokemontcg.io/sv6pt5/symbol.png', 'https://images.pokemontcg.io/sv6pt5/logo.png', 'pokemon_tcg_api', 'sv6pt5'),
  ('sv7', 'Stellar Crown', 'Scarlet & Violet', null, '2024-09-13', 142, 175, 'https://images.pokemontcg.io/sv7/symbol.png', 'https://images.pokemontcg.io/sv7/logo.png', 'pokemon_tcg_api', 'sv7'),
  ('sv8', 'Surging Sparks', 'Scarlet & Violet', null, '2024-11-08', 191, 252, 'https://images.pokemontcg.io/sv8/symbol.png', 'https://images.pokemontcg.io/sv8/logo.png', 'pokemon_tcg_api', 'sv8')
on conflict (set_code) do update set
  name = excluded.name,
  series = excluded.series,
  generation = excluded.generation,
  release_date = excluded.release_date,
  printed_total = excluded.printed_total,
  total = excluded.total,
  symbol_url = excluded.symbol_url,
  logo_url = excluded.logo_url,
  source = excluded.source,
  source_id = excluded.source_id,
  updated_at = now()
returning set_code, name, source, source_id;

commit;
```

## 5. Post-check SQL

Run these checks after a reviewed manual import to confirm the expected result.

```sql
-- All 11 set_codes are present.
select
  count(*) as present_target_set_count
from public.sets_catalog
where set_code in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv45',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
);

-- No duplicate set_code values exist.
select
  set_code,
  count(*) as row_count
from public.sets_catalog
group by set_code
having count(*) > 1
order by set_code;

-- Paldean Fates is exactly one row with set_code sv45 and source_id sv4pt5.
select
  count(*) as paldean_fates_exact_match_count
from public.sets_catalog
where set_code = 'sv45'
  and source_id = 'sv4pt5'
  and name = 'Paldean Fates';

-- Generation remains null for all 11 rows.
select
  count(*) as non_null_generation_count
from public.sets_catalog
where set_code in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv45',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
)
and generation is not null;

-- Source is pokemon_tcg_api for all 11 rows.
select
  source,
  count(*) as row_count
from public.sets_catalog
where set_code in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv45',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
)
group by source
order by source;

-- Sample select with all 11 rows.
select
  set_code,
  name,
  series,
  generation,
  release_date,
  printed_total,
  total,
  symbol_url,
  logo_url,
  source,
  source_id
from public.sets_catalog
where set_code in (
  'sv1',
  'sv2',
  'sv3',
  'sv3pt5',
  'sv4',
  'sv45',
  'sv5',
  'sv6',
  'sv6pt5',
  'sv7',
  'sv8'
)
order by release_date, set_code;

-- Count after import.
select count(*) as sets_catalog_count_after_import
from public.sets_catalog;
```

## 6. Stop rule

If a pre-check returns unexpected results, stop.

Do not run the import SQL.
Do not continue with post-checks.
Report the pre-check result for analysis before any import attempt.

## 7. Out of scope

- No SQL execution.
- No Supabase import in this phase.
- No app-code changes.
- No CSV changes.
- No scripts.
- No API sync.
- No runtime changes.
