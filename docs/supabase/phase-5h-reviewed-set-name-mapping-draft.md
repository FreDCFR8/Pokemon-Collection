# Phase 5H — Reviewed `set_name` to `set_code` mapping draft

## 1. Status

Draft only. No SQL executed. No data changed.

## 2. Purpose

Create a reviewed mapping draft from `cards_catalog.set_name` to `sets_catalog.set_code`.

## 3. Mapping columns

Both mapping tables use these columns:

| cards_catalog_set_name | row_count | set_code | sets_catalog_name | review_status | notes |
| --- | ---: | --- | --- | --- | --- |

## 4. Review statuses

- `approved`
- `pending`

## 5. Approved mapping table

Only exact matches against the current curated `sets_catalog` code/name list are included as approved. This is still a draft and does not authorize a backfill.

| cards_catalog_set_name | row_count | set_code | sets_catalog_name | review_status | notes |
| --- | ---: | --- | --- | --- | --- |
| 151 | 71 | sv3pt5 | 151 | approved | Exact sets_catalog name match. |
| Silver Tempest | 71 | swsh12 | Silver Tempest | approved | Exact sets_catalog name match. |
| swsh12 | 71 | swsh12 | Silver Tempest | approved | Exact set_code match. |
| Lost Origin | 63 | swsh11 | Lost Origin | approved | Exact sets_catalog name match. |
| swsh11 | 63 | swsh11 | Lost Origin | approved | Exact set_code match. |
| Obsidian Flames | 56 | sv3 | Obsidian Flames | approved | Exact sets_catalog name match. |
| sv3 | 56 | sv3 | Obsidian Flames | approved | Exact set_code match. |
| Astral Radiance | 53 | swsh10 | Astral Radiance | approved | Exact sets_catalog name match. |
| swsh10 | 53 | swsh10 | Astral Radiance | approved | Exact set_code match. |
| Scarlet & Violet | 52 | sv1 | Scarlet & Violet | approved | Exact sets_catalog name match. |
| sv1 | 52 | sv1 | Scarlet & Violet | approved | Exact set_code match. |
| Fusion Strike | 38 | swsh8 | Fusion Strike | approved | Exact sets_catalog name match. |
| sv5 | 38 | sv5 | Temporal Forces | approved | Exact set_code match. |
| sv7 | 38 | sv7 | Stellar Crown | approved | Exact set_code match. |
| swsh8 | 38 | swsh8 | Fusion Strike | approved | Exact set_code match. |
| Paldean Fates | 36 | sv45 | Paldean Fates | approved | Exact sets_catalog name match. |
| Stellar Crown | 36 | sv7 | Stellar Crown | approved | Exact sets_catalog name match. |
| sv45 | 36 | sv45 | Paldean Fates | approved | Exact set_code match. |
| Temporal Forces | 36 | sv5 | Temporal Forces | approved | Exact sets_catalog name match. |
| Crown Zenith | 33 | swsh12pt5 | Crown Zenith | approved | Exact sets_catalog name match. |
| swsh12pt5 | 33 | swsh12pt5 | Crown Zenith | approved | Exact set_code match. |
| sv9 | 31 | sv9 | Journey Together | approved | Exact set_code match. |
| swsh9 | 31 | swsh9 | Brilliant Stars | approved | Exact set_code match. |
| Brilliant Stars | 29 | swsh9 | Brilliant Stars | approved | Exact sets_catalog name match. |
| Journey Together | 29 | sv9 | Journey Together | approved | Exact sets_catalog name match. |
| Surging Sparks | 29 | sv8 | Surging Sparks | approved | Exact sets_catalog name match. |
| sv8 | 29 | sv8 | Surging Sparks | approved | Exact set_code match. |
| Destined Rivals | 28 | sv10 | Destined Rivals | approved | Exact sets_catalog name match. |
| sv10 | 28 | sv10 | Destined Rivals | approved | Exact set_code match. |
| pgo | 27 | pgo | Pokémon GO | approved | Exact set_code match. |
| Pokémon GO | 27 | pgo | Pokémon GO | approved | Exact sets_catalog name match. |
| sv6 | 24 | sv6 | Twilight Masquerade | approved | Exact set_code match. |
| sv2 | 22 | sv2 | Paldea Evolved | approved | Exact set_code match. |
| Evolving Skies | 20 | swsh7 | Evolving Skies | approved | Exact sets_catalog name match. |
| Paldea Evolved | 20 | sv2 | Paldea Evolved | approved | Exact sets_catalog name match. |
| swsh7 | 20 | swsh7 | Evolving Skies | approved | Exact set_code match. |
| Twilight Masquerade | 20 | sv6 | Twilight Masquerade | approved | Exact sets_catalog name match. |
| Paradox Rift | 14 | sv4 | Paradox Rift | approved | Exact sets_catalog name match. |
| sv4 | 14 | sv4 | Paradox Rift | approved | Exact set_code match. |

## 6. Pending mapping table

All remaining Phase 5G exported `set_name` values stay pending with blank `set_code` and `sets_catalog_name` values.

| cards_catalog_set_name | row_count | set_code | sets_catalog_name | review_status | notes |
| --- | ---: | --- | --- | --- | --- |
| sv35 | 79 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| me1 | 62 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Mega Evolution | 60 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| me2 | 29 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Black Bolt | 26 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| sv105b | 26 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Phantasmal Flames | 25 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| sv105w | 22 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| White Flare | 22 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Champion's Path | 21 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh35 | 21 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| me25 | 17 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Ascended Heroes | 15 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| svp | 15 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| SWSH Black Star Promos | 15 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swshp | 15 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Prismatic Evolutions | 13 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Scarlet & Violet Black Star Promos | 13 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| sv85 | 13 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh4 | 12 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Vivid Voltage | 12 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Crown Zenith Galarian Gallery | 11 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh12pt5gg | 11 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Chilling Reign | 8 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh6 | 8 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| BREAKpoint | 6 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Rebel Clash | 6 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh2 | 6 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| xy9 | 6 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Silver Tempest Trainer Gallery | 5 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Sword & Shield | 5 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh1 | 5 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh12tg | 5 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| mcd23 | 4 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| McDonald's Collection 2023 | 4 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| me3 | 4 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Mega Evolution Black Star Promos | 4 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| mep | 4 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Perfect Order | 4 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| ba22c | 3 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Battle Academy 2022 (Cinderace) | 3 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Battle Styles | 3 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| cel25 | 3 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Celebrations | 3 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Chaos Rising | 3 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| mcd24 | 3 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| McDonald's Collection 2024 | 3 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| me4 | 3 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Steam Siege | 3 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh5 | 3 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| xy11 | 3 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Astral Radiance Trainer Gallery | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| bw9 | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Celestial Storm | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Crimson Invasion | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Darkness Ablaze | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Lost Origin Trainer Gallery | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| mcd22 | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| McDonald's Collection 2022 | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Plasma Freeze | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Scarlet & Violet Promos | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| sm4 | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| sm7 | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh10tg | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh11tg | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh3 | 2 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| ba22p | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Battle Academy 2022 (Pikachu) | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Brilliant Stars Trainer Gallery | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| cclb | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Cosmic Eclipse | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Guardians Rising | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Lost Thunder | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| mcd19fr | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| McDonald's Collection 2019 (French) | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Pokémon TCG Classic (Blastoise) | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Shining Fates | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Shining Legends | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| sm1 | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| sm12 | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| sm2 | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| sm35 | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| sm8 | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| Sun & Moon | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh45 | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |
| swsh9tg | 1 |  |  | pending | Not present in current curated sets_catalog list or requires manual review. |

## 7. Summary

- total exported set_name rows = 125
- approved mapping rows = 39
- pending mapping rows = 86
- estimated cards covered by approved mappings = 1465
- estimated cards remaining pending = 725
- no data changed

## 8. Safety rules

- approved mappings are a draft only
- no update SQL may be generated in this phase
- no mapping may be used until reviewed again in Phase 5I
- pending values must remain null
- never use fuzzy matching
- never use public.cards
- never use internet/API lookup

## 9. Out of scope

- no SQL execution
- no backfill
- no update SQL
- no FK/index/not-null
- no progress query
- no UI
- no CSV generation
- no Supabase data changes

## 10. Next phase

Phase 5I — manual SQL plan for approved mappings only.
