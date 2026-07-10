# Phase 5G — Distinct `cards_catalog.set_name` export execution log

## Status

Completed manually in Supabase.

## Validation results

- `cards_catalog_count = 2190`
- `cards_catalog_rows_with_set_name = 2190`
- `distinct_set_name_count = 125`
- `cards_catalog_rows_with_set_code = 0`

## Export result summary

- first export contained 100 rows / 2160 cards
- second export with offset 100 contained 25 rows / 30 cards
- combined export contains 125 distinct set_name rows
- combined row_count total = 2190

## Export SQL used

```sql
select
  set_name,
  count(*) as row_count
from public.cards_catalog
where set_name is not null
group by set_name
order by row_count desc, set_name asc;
```

## Offset SQL used for remaining rows

```sql
select
  set_name,
  count(*) as row_count
from public.cards_catalog
where set_name is not null
group by set_name
order by row_count desc, set_name asc
offset 100;
```

## Full combined export output

```csv
set_name,row_count
sv35,79
151,71
Silver Tempest,71
swsh12,71
Lost Origin,63
swsh11,63
me1,62
Mega Evolution,60
Obsidian Flames,56
sv3,56
Astral Radiance,53
swsh10,53
Scarlet & Violet,52
sv1,52
Fusion Strike,38
sv5,38
sv7,38
swsh8,38
Paldean Fates,36
Stellar Crown,36
sv45,36
Temporal Forces,36
Crown Zenith,33
swsh12pt5,33
sv9,31
swsh9,31
Brilliant Stars,29
Journey Together,29
me2,29
Surging Sparks,29
sv8,29
Destined Rivals,28
sv10,28
pgo,27
Pokémon GO,27
Black Bolt,26
sv105b,26
Phantasmal Flames,25
sv6,24
sv105w,22
sv2,22
White Flare,22
Champion's Path,21
swsh35,21
Evolving Skies,20
Paldea Evolved,20
swsh7,20
Twilight Masquerade,20
me25,17
Ascended Heroes,15
svp,15
SWSH Black Star Promos,15
swshp,15
Paradox Rift,14
sv4,14
Prismatic Evolutions,13
Scarlet & Violet Black Star Promos,13
sv85,13
swsh4,12
Vivid Voltage,12
Crown Zenith Galarian Gallery,11
swsh12pt5gg,11
Chilling Reign,8
swsh6,8
BREAKpoint,6
Rebel Clash,6
swsh2,6
xy9,6
Silver Tempest Trainer Gallery,5
Sword & Shield,5
swsh1,5
swsh12tg,5
mcd23,4
McDonald's Collection 2023,4
me3,4
Mega Evolution Black Star Promos,4
mep,4
Perfect Order,4
ba22c,3
Battle Academy 2022 (Cinderace),3
Battle Styles,3
cel25,3
Celebrations,3
Chaos Rising,3
mcd24,3
McDonald's Collection 2024,3
me4,3
Steam Siege,3
swsh5,3
xy11,3
Astral Radiance Trainer Gallery,2
bw9,2
Celestial Storm,2
Crimson Invasion,2
Darkness Ablaze,2
Lost Origin Trainer Gallery,2
mcd22,2
McDonald's Collection 2022,2
Plasma Freeze,2
Scarlet & Violet Promos,2
sm4,2
sm7,2
swsh10tg,2
swsh11tg,2
swsh3,2
ba22p,1
Battle Academy 2022 (Pikachu),1
Brilliant Stars Trainer Gallery,1
cclb,1
Cosmic Eclipse,1
Guardians Rising,1
Lost Thunder,1
mcd19fr,1
McDonald's Collection 2019 (French),1
Pokémon TCG Classic (Blastoise),1
Shining Fates,1
Shining Legends,1
sm1,1
sm12,1
sm2,1
sm35,1
sm8,1
Sun & Moon,1
swsh45,1
swsh9tg,1
```

## Result

- export completed successfully
- 125 distinct set_name values documented
- row_count total matches cards_catalog_count
- cards_catalog.set_code remains null for all rows
- no mapping was created
- no backfill was executed

## Out of scope

- no mapping
- no backfill
- no update SQL
- no FK/index/not-null
- no progress query
- no UI
- no CSV generation
- no data changes
- no public.cards usage
- no internet/API lookup

## Next phase

Phase 5H — create reviewed mapping draft from exported set_name values.
