-- Phase 7B set-catalog recovery: one-time transactional execution
-- Dataset: PokemonTCG/pokemon-tcg-data@0af6250a22495e4a3e9f60ff45fc3fedc2e0563d
-- Review file: config/catalog/remaining-set-catalog-mapping-review.json
-- Review blob SHA: b726e5a0635d28e164b7c1548e6ea0a66f8701bd
-- Approved scope: 117 NEW rows only; 17 excluded sets; no cards; no updates.
--
-- Run this complete file once in the Supabase SQL Editor as the project owner.
-- It is intentionally fail-closed: if any planned identity already exists, it raises
-- before INSERT. PostgreSQL then rolls back the whole transaction.

begin;

create temporary table phase_7b_expected_sets (
  set_code text primary key,
  name text not null,
  series text not null,
  source text not null,
  external_id text not null
) on commit drop;

insert into phase_7b_expected_sets (set_code, name, series, source, external_id) values
  ('base1', 'Base', 'Base', 'pokemon_tcg_api', 'base1'),
  ('base2', 'Jungle', 'Base', 'pokemon_tcg_api', 'base2'),
  ('base3', 'Fossil', 'Base', 'pokemon_tcg_api', 'base3'),
  ('base4', 'Base Set 2', 'Base', 'pokemon_tcg_api', 'base4'),
  ('base5', 'Team Rocket', 'Base', 'pokemon_tcg_api', 'base5'),
  ('base6', 'Legendary Collection', 'Other', 'pokemon_tcg_api', 'base6'),
  ('basep', 'Wizards Black Star Promos', 'Base', 'pokemon_tcg_api', 'basep'),
  ('bp', 'Best of Game', 'Other', 'pokemon_tcg_api', 'bp'),
  ('bw1', 'Black & White', 'Black & White', 'pokemon_tcg_api', 'bw1'),
  ('bw10', 'Plasma Blast', 'Black & White', 'pokemon_tcg_api', 'bw10'),
  ('bw11', 'Legendary Treasures', 'Black & White', 'pokemon_tcg_api', 'bw11'),
  ('bw2', 'Emerging Powers', 'Black & White', 'pokemon_tcg_api', 'bw2'),
  ('bw3', 'Noble Victories', 'Black & White', 'pokemon_tcg_api', 'bw3'),
  ('bw4', 'Next Destinies', 'Black & White', 'pokemon_tcg_api', 'bw4'),
  ('bw5', 'Dark Explorers', 'Black & White', 'pokemon_tcg_api', 'bw5'),
  ('bw6', 'Dragons Exalted', 'Black & White', 'pokemon_tcg_api', 'bw6'),
  ('bw7', 'Boundaries Crossed', 'Black & White', 'pokemon_tcg_api', 'bw7'),
  ('bw8', 'Plasma Storm', 'Black & White', 'pokemon_tcg_api', 'bw8'),
  ('bwp', 'BW Black Star Promos', 'Black & White', 'pokemon_tcg_api', 'bwp'),
  ('col1', 'Call of Legends', 'HeartGold & SoulSilver', 'pokemon_tcg_api', 'col1'),
  ('dc1', 'Double Crisis', 'XY', 'pokemon_tcg_api', 'dc1'),
  ('det1', 'Detective Pikachu', 'Sun & Moon', 'pokemon_tcg_api', 'det1'),
  ('dp1', 'Diamond & Pearl', 'Diamond & Pearl', 'pokemon_tcg_api', 'dp1'),
  ('dp2', 'Mysterious Treasures', 'Diamond & Pearl', 'pokemon_tcg_api', 'dp2'),
  ('dp3', 'Secret Wonders', 'Diamond & Pearl', 'pokemon_tcg_api', 'dp3'),
  ('dp4', 'Great Encounters', 'Diamond & Pearl', 'pokemon_tcg_api', 'dp4'),
  ('dp5', 'Majestic Dawn', 'Diamond & Pearl', 'pokemon_tcg_api', 'dp5'),
  ('dp6', 'Legends Awakened', 'Diamond & Pearl', 'pokemon_tcg_api', 'dp6'),
  ('dp7', 'Stormfront', 'Diamond & Pearl', 'pokemon_tcg_api', 'dp7'),
  ('dpp', 'DP Black Star Promos', 'Diamond & Pearl', 'pokemon_tcg_api', 'dpp'),
  ('dv1', 'Dragon Vault', 'Black & White', 'pokemon_tcg_api', 'dv1'),
  ('ecard1', 'Expedition Base Set', 'E-Card', 'pokemon_tcg_api', 'ecard1'),
  ('ecard2', 'Aquapolis', 'E-Card', 'pokemon_tcg_api', 'ecard2'),
  ('ecard3', 'Skyridge', 'E-Card', 'pokemon_tcg_api', 'ecard3'),
  ('ex1', 'Ruby & Sapphire', 'EX', 'pokemon_tcg_api', 'ex1'),
  ('ex10', 'Unseen Forces', 'EX', 'pokemon_tcg_api', 'ex10'),
  ('ex11', 'Delta Species', 'EX', 'pokemon_tcg_api', 'ex11'),
  ('ex12', 'Legend Maker', 'EX', 'pokemon_tcg_api', 'ex12'),
  ('ex13', 'Holon Phantoms', 'EX', 'pokemon_tcg_api', 'ex13'),
  ('ex14', 'Crystal Guardians', 'EX', 'pokemon_tcg_api', 'ex14'),
  ('ex15', 'Dragon Frontiers', 'EX', 'pokemon_tcg_api', 'ex15'),
  ('ex16', 'Power Keepers', 'EX', 'pokemon_tcg_api', 'ex16'),
  ('ex2', 'Sandstorm', 'EX', 'pokemon_tcg_api', 'ex2'),
  ('ex3', 'Dragon', 'EX', 'pokemon_tcg_api', 'ex3'),
  ('ex4', 'Team Magma vs Team Aqua', 'EX', 'pokemon_tcg_api', 'ex4'),
  ('ex5', 'Hidden Legends', 'EX', 'pokemon_tcg_api', 'ex5'),
  ('ex6', 'FireRed & LeafGreen', 'EX', 'pokemon_tcg_api', 'ex6'),
  ('ex7', 'Team Rocket Returns', 'EX', 'pokemon_tcg_api', 'ex7'),
  ('ex8', 'Deoxys', 'EX', 'pokemon_tcg_api', 'ex8'),
  ('ex9', 'Emerald', 'EX', 'pokemon_tcg_api', 'ex9'),
  ('fut20', 'Pokémon Futsal Collection', 'Other', 'pokemon_tcg_api', 'fut20'),
  ('g1', 'Generations', 'XY', 'pokemon_tcg_api', 'g1'),
  ('gym1', 'Gym Heroes', 'Gym', 'pokemon_tcg_api', 'gym1'),
  ('gym2', 'Gym Challenge', 'Gym', 'pokemon_tcg_api', 'gym2'),
  ('hgss1', 'HeartGold & SoulSilver', 'HeartGold & SoulSilver', 'pokemon_tcg_api', 'hgss1'),
  ('hgss2', 'HS—Unleashed', 'HeartGold & SoulSilver', 'pokemon_tcg_api', 'hgss2'),
  ('hgss3', 'HS—Undaunted', 'HeartGold & SoulSilver', 'pokemon_tcg_api', 'hgss3'),
  ('hgss4', 'HS—Triumphant', 'HeartGold & SoulSilver', 'pokemon_tcg_api', 'hgss4'),
  ('hsp', 'HGSS Black Star Promos', 'HeartGold & SoulSilver', 'pokemon_tcg_api', 'hsp'),
  ('mcd11', 'McDonald''s Collection 2011', 'Other', 'pokemon_tcg_api', 'mcd11'),
  ('mcd12', 'McDonald''s Collection 2012', 'Other', 'pokemon_tcg_api', 'mcd12'),
  ('mcd14', 'McDonald''s Collection 2014', 'Other', 'pokemon_tcg_api', 'mcd14'),
  ('mcd15', 'McDonald''s Collection 2015', 'Other', 'pokemon_tcg_api', 'mcd15'),
  ('mcd16', 'McDonald''s Collection 2016', 'Other', 'pokemon_tcg_api', 'mcd16'),
  ('mcd17', 'McDonald''s Collection 2017', 'Other', 'pokemon_tcg_api', 'mcd17'),
  ('mcd18', 'McDonald''s Collection 2018', 'Other', 'pokemon_tcg_api', 'mcd18'),
  ('mcd19', 'McDonald''s Collection 2019', 'Other', 'pokemon_tcg_api', 'mcd19'),
  ('mcd21', 'McDonald''s Collection 2021', 'Other', 'pokemon_tcg_api', 'mcd21'),
  ('neo1', 'Neo Genesis', 'Neo', 'pokemon_tcg_api', 'neo1'),
  ('neo2', 'Neo Discovery', 'Neo', 'pokemon_tcg_api', 'neo2'),
  ('neo3', 'Neo Revelation', 'Neo', 'pokemon_tcg_api', 'neo3'),
  ('neo4', 'Neo Destiny', 'Neo', 'pokemon_tcg_api', 'neo4'),
  ('np', 'Nintendo Black Star Promos', 'NP', 'pokemon_tcg_api', 'np'),
  ('pl1', 'Platinum', 'Platinum', 'pokemon_tcg_api', 'pl1'),
  ('pl2', 'Rising Rivals', 'Platinum', 'pokemon_tcg_api', 'pl2'),
  ('pl3', 'Supreme Victors', 'Platinum', 'pokemon_tcg_api', 'pl3'),
  ('pl4', 'Arceus', 'Platinum', 'pokemon_tcg_api', 'pl4'),
  ('pop1', 'POP Series 1', 'POP', 'pokemon_tcg_api', 'pop1'),
  ('pop2', 'POP Series 2', 'POP', 'pokemon_tcg_api', 'pop2'),
  ('pop3', 'POP Series 3', 'POP', 'pokemon_tcg_api', 'pop3'),
  ('pop4', 'POP Series 4', 'POP', 'pokemon_tcg_api', 'pop4'),
  ('pop5', 'POP Series 5', 'POP', 'pokemon_tcg_api', 'pop5'),
  ('pop6', 'POP Series 6', 'POP', 'pokemon_tcg_api', 'pop6'),
  ('pop7', 'POP Series 7', 'POP', 'pokemon_tcg_api', 'pop7'),
  ('pop8', 'POP Series 8', 'POP', 'pokemon_tcg_api', 'pop8'),
  ('pop9', 'POP Series 9', 'POP', 'pokemon_tcg_api', 'pop9'),
  ('ru1', 'Pokémon Rumble', 'Other', 'pokemon_tcg_api', 'ru1'),
  ('si1', 'Southern Islands', 'Other', 'pokemon_tcg_api', 'si1'),
  ('sm10', 'Unbroken Bonds', 'Sun & Moon', 'pokemon_tcg_api', 'sm10'),
  ('sm11', 'Unified Minds', 'Sun & Moon', 'pokemon_tcg_api', 'sm11'),
  ('sm115', 'Hidden Fates', 'Sun & Moon', 'pokemon_tcg_api', 'sm115'),
  ('sm3', 'Burning Shadows', 'Sun & Moon', 'pokemon_tcg_api', 'sm3'),
  ('sm5', 'Ultra Prism', 'Sun & Moon', 'pokemon_tcg_api', 'sm5'),
  ('sm6', 'Forbidden Light', 'Sun & Moon', 'pokemon_tcg_api', 'sm6'),
  ('sm75', 'Dragon Majesty', 'Sun & Moon', 'pokemon_tcg_api', 'sm75'),
  ('sm9', 'Team Up', 'Sun & Moon', 'pokemon_tcg_api', 'sm9'),
  ('sma', 'Hidden Fates Shiny Vault', 'Sun & Moon', 'pokemon_tcg_api', 'sma'),
  ('smp', 'SM Black Star Promos', 'Sun & Moon', 'pokemon_tcg_api', 'smp'),
  ('sve', 'Scarlet & Violet Energies', 'Scarlet & Violet', 'pokemon_tcg_api', 'sve'),
  ('svp', 'Scarlet & Violet Black Star Promos', 'Scarlet & Violet', 'pokemon_tcg_api', 'svp'),
  ('swsh45sv', 'Shining Fates Shiny Vault', 'Sword & Shield', 'pokemon_tcg_api', 'swsh45sv'),
  ('tk1a', 'EX Trainer Kit Latias', 'EX', 'pokemon_tcg_api', 'tk1a'),
  ('tk1b', 'EX Trainer Kit Latios', 'EX', 'pokemon_tcg_api', 'tk1b'),
  ('tk2a', 'EX Trainer Kit 2 Plusle', 'EX', 'pokemon_tcg_api', 'tk2a'),
  ('tk2b', 'EX Trainer Kit 2 Minun', 'EX', 'pokemon_tcg_api', 'tk2b'),
  ('xy0', 'Kalos Starter Set', 'XY', 'pokemon_tcg_api', 'xy0'),
  ('xy1', 'XY', 'XY', 'pokemon_tcg_api', 'xy1'),
  ('xy10', 'Fates Collide', 'XY', 'pokemon_tcg_api', 'xy10'),
  ('xy12', 'Evolutions', 'XY', 'pokemon_tcg_api', 'xy12'),
  ('xy2', 'Flashfire', 'XY', 'pokemon_tcg_api', 'xy2'),
  ('xy3', 'Furious Fists', 'XY', 'pokemon_tcg_api', 'xy3'),
  ('xy4', 'Phantom Forces', 'XY', 'pokemon_tcg_api', 'xy4'),
  ('xy5', 'Primal Clash', 'XY', 'pokemon_tcg_api', 'xy5'),
  ('xy6', 'Roaring Skies', 'XY', 'pokemon_tcg_api', 'xy6'),
  ('xy7', 'Ancient Origins', 'XY', 'pokemon_tcg_api', 'xy7'),
  ('xy8', 'BREAKthrough', 'XY', 'pokemon_tcg_api', 'xy8'),
  ('xyp', 'XY Black Star Promos', 'XY', 'pokemon_tcg_api', 'xyp');

do $$
declare
  expected_count integer := 117;
  actual_count integer;
begin
  select count(*) into actual_count from phase_7b_expected_sets;
  if actual_count <> expected_count then
    raise exception 'Phase 7B abort: expected %, received % planned rows.', expected_count, actual_count;
  end if;

  if exists (
    select 1
    from phase_7b_expected_sets expected
    join public.sets_catalog existing on existing.set_code = expected.set_code
  ) then
    raise exception 'Phase 7B abort: one or more planned set_code values already exist; no existing data may be changed.';
  end if;

  if exists (
    select 1
    from phase_7b_expected_sets expected
    join public.sets_catalog existing
      on existing.source = expected.source
     and existing.source_id = expected.external_id
  ) then
    raise exception 'Phase 7B abort: one or more planned source/source_id identities already exist; no existing data may be changed.';
  end if;

  if exists (
    select 1
    from phase_7b_expected_sets expected
    join public.set_external_references existing
      on existing.source = expected.source
     and existing.external_id = expected.external_id
  ) then
    raise exception 'Phase 7B abort: one or more planned external references already exist; no existing data may be changed.';
  end if;
end
$$;

with inserted_sets as (
  insert into public.sets_catalog (set_code, name, series, source, source_id)
  select set_code, name, series, source, external_id
  from phase_7b_expected_sets
  order by set_code
  returning id, set_code
)
insert into public.set_external_references (set_catalog_id, source, external_id)
select inserted_sets.id, expected.source, expected.external_id
from inserted_sets
join phase_7b_expected_sets expected using (set_code)
order by expected.set_code;

do $$
declare
  expected_count integer := 117;
  set_count integer;
  reference_count integer;
begin
  select count(*) into set_count
  from public.sets_catalog actual
  join phase_7b_expected_sets expected
    on actual.set_code = expected.set_code
   and actual.name = expected.name
   and actual.series = expected.series
   and actual.source = expected.source
   and actual.source_id = expected.external_id;

  if set_count <> expected_count then
    raise exception 'Phase 7B abort: exact set postcheck expected %, found %.', expected_count, set_count;
  end if;

  select count(*) into reference_count
  from public.set_external_references reference
  join public.sets_catalog actual on actual.id = reference.set_catalog_id
  join phase_7b_expected_sets expected
    on actual.set_code = expected.set_code
   and reference.source = expected.source
   and reference.external_id = expected.external_id;

  if reference_count <> expected_count then
    raise exception 'Phase 7B abort: exact reference postcheck expected %, found %.', expected_count, reference_count;
  end if;
end
$$;

commit;

-- Expected success: 117 new sets + 117 new references. No other table is written.
