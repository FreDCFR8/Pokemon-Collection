-- Phase 7B set-catalog recovery: one self-contained transactional statement
-- Dataset: PokemonTCG/pokemon-tcg-data@0af6250a22495e4a3e9f60ff45fc3fedc2e0563d
-- Review file: config/catalog/remaining-set-catalog-mapping-review.json
-- Review blob SHA: b726e5a0635d28e164b7c1548e6ea0a66f8701bd
-- Approved scope: 117 NEW rows only; 17 excluded sets; no cards; no updates.
--
-- Run this complete file once in the Supabase SQL Editor as the project owner.
-- The entire action is one PostgreSQL DO statement. It does not depend on a
-- temporary table or on SQL-editor session persistence. Any raised exception
-- rolls back all work performed by this statement.

do $$
declare
  recovery_plan jsonb := $phase_7b_plan$[{"set_code":"base1","name":"Base","series":"Base","source":"pokemon_tcg_api","external_id":"base1"},{"set_code":"base2","name":"Jungle","series":"Base","source":"pokemon_tcg_api","external_id":"base2"},{"set_code":"base3","name":"Fossil","series":"Base","source":"pokemon_tcg_api","external_id":"base3"},{"set_code":"base4","name":"Base Set 2","series":"Base","source":"pokemon_tcg_api","external_id":"base4"},{"set_code":"base5","name":"Team Rocket","series":"Base","source":"pokemon_tcg_api","external_id":"base5"},{"set_code":"base6","name":"Legendary Collection","series":"Other","source":"pokemon_tcg_api","external_id":"base6"},{"set_code":"basep","name":"Wizards Black Star Promos","series":"Base","source":"pokemon_tcg_api","external_id":"basep"},{"set_code":"bp","name":"Best of Game","series":"Other","source":"pokemon_tcg_api","external_id":"bp"},{"set_code":"bw1","name":"Black & White","series":"Black & White","source":"pokemon_tcg_api","external_id":"bw1"},{"set_code":"bw10","name":"Plasma Blast","series":"Black & White","source":"pokemon_tcg_api","external_id":"bw10"},{"set_code":"bw11","name":"Legendary Treasures","series":"Black & White","source":"pokemon_tcg_api","external_id":"bw11"},{"set_code":"bw2","name":"Emerging Powers","series":"Black & White","source":"pokemon_tcg_api","external_id":"bw2"},{"set_code":"bw3","name":"Noble Victories","series":"Black & White","source":"pokemon_tcg_api","external_id":"bw3"},{"set_code":"bw4","name":"Next Destinies","series":"Black & White","source":"pokemon_tcg_api","external_id":"bw4"},{"set_code":"bw5","name":"Dark Explorers","series":"Black & White","source":"pokemon_tcg_api","external_id":"bw5"},{"set_code":"bw6","name":"Dragons Exalted","series":"Black & White","source":"pokemon_tcg_api","external_id":"bw6"},{"set_code":"bw7","name":"Boundaries Crossed","series":"Black & White","source":"pokemon_tcg_api","external_id":"bw7"},{"set_code":"bw8","name":"Plasma Storm","series":"Black & White","source":"pokemon_tcg_api","external_id":"bw8"},{"set_code":"bwp","name":"BW Black Star Promos","series":"Black & White","source":"pokemon_tcg_api","external_id":"bwp"},{"set_code":"col1","name":"Call of Legends","series":"HeartGold & SoulSilver","source":"pokemon_tcg_api","external_id":"col1"},{"set_code":"dc1","name":"Double Crisis","series":"XY","source":"pokemon_tcg_api","external_id":"dc1"},{"set_code":"det1","name":"Detective Pikachu","series":"Sun & Moon","source":"pokemon_tcg_api","external_id":"det1"},{"set_code":"dp1","name":"Diamond & Pearl","series":"Diamond & Pearl","source":"pokemon_tcg_api","external_id":"dp1"},{"set_code":"dp2","name":"Mysterious Treasures","series":"Diamond & Pearl","source":"pokemon_tcg_api","external_id":"dp2"},{"set_code":"dp3","name":"Secret Wonders","series":"Diamond & Pearl","source":"pokemon_tcg_api","external_id":"dp3"},{"set_code":"dp4","name":"Great Encounters","series":"Diamond & Pearl","source":"pokemon_tcg_api","external_id":"dp4"},{"set_code":"dp5","name":"Majestic Dawn","series":"Diamond & Pearl","source":"pokemon_tcg_api","external_id":"dp5"},{"set_code":"dp6","name":"Legends Awakened","series":"Diamond & Pearl","source":"pokemon_tcg_api","external_id":"dp6"},{"set_code":"dp7","name":"Stormfront","series":"Diamond & Pearl","source":"pokemon_tcg_api","external_id":"dp7"},{"set_code":"dpp","name":"DP Black Star Promos","series":"Diamond & Pearl","source":"pokemon_tcg_api","external_id":"dpp"},{"set_code":"dv1","name":"Dragon Vault","series":"Black & White","source":"pokemon_tcg_api","external_id":"dv1"},{"set_code":"ecard1","name":"Expedition Base Set","series":"E-Card","source":"pokemon_tcg_api","external_id":"ecard1"},{"set_code":"ecard2","name":"Aquapolis","series":"E-Card","source":"pokemon_tcg_api","external_id":"ecard2"},{"set_code":"ecard3","name":"Skyridge","series":"E-Card","source":"pokemon_tcg_api","external_id":"ecard3"},{"set_code":"ex1","name":"Ruby & Sapphire","series":"EX","source":"pokemon_tcg_api","external_id":"ex1"},{"set_code":"ex10","name":"Unseen Forces","series":"EX","source":"pokemon_tcg_api","external_id":"ex10"},{"set_code":"ex11","name":"Delta Species","series":"EX","source":"pokemon_tcg_api","external_id":"ex11"},{"set_code":"ex12","name":"Legend Maker","series":"EX","source":"pokemon_tcg_api","external_id":"ex12"},{"set_code":"ex13","name":"Holon Phantoms","series":"EX","source":"pokemon_tcg_api","external_id":"ex13"},{"set_code":"ex14","name":"Crystal Guardians","series":"EX","source":"pokemon_tcg_api","external_id":"ex14"},{"set_code":"ex15","name":"Dragon Frontiers","series":"EX","source":"pokemon_tcg_api","external_id":"ex15"},{"set_code":"ex16","name":"Power Keepers","series":"EX","source":"pokemon_tcg_api","external_id":"ex16"},{"set_code":"ex2","name":"Sandstorm","series":"EX","source":"pokemon_tcg_api","external_id":"ex2"},{"set_code":"ex3","name":"Dragon","series":"EX","source":"pokemon_tcg_api","external_id":"ex3"},{"set_code":"ex4","name":"Team Magma vs Team Aqua","series":"EX","source":"pokemon_tcg_api","external_id":"ex4"},{"set_code":"ex5","name":"Hidden Legends","series":"EX","source":"pokemon_tcg_api","external_id":"ex5"},{"set_code":"ex6","name":"FireRed & LeafGreen","series":"EX","source":"pokemon_tcg_api","external_id":"ex6"},{"set_code":"ex7","name":"Team Rocket Returns","series":"EX","source":"pokemon_tcg_api","external_id":"ex7"},{"set_code":"ex8","name":"Deoxys","series":"EX","source":"pokemon_tcg_api","external_id":"ex8"},{"set_code":"ex9","name":"Emerald","series":"EX","source":"pokemon_tcg_api","external_id":"ex9"},{"set_code":"fut20","name":"Pokémon Futsal Collection","series":"Other","source":"pokemon_tcg_api","external_id":"fut20"},{"set_code":"g1","name":"Generations","series":"XY","source":"pokemon_tcg_api","external_id":"g1"},{"set_code":"gym1","name":"Gym Heroes","series":"Gym","source":"pokemon_tcg_api","external_id":"gym1"},{"set_code":"gym2","name":"Gym Challenge","series":"Gym","source":"pokemon_tcg_api","external_id":"gym2"},{"set_code":"hgss1","name":"HeartGold & SoulSilver","series":"HeartGold & SoulSilver","source":"pokemon_tcg_api","external_id":"hgss1"},{"set_code":"hgss2","name":"HS—Unleashed","series":"HeartGold & SoulSilver","source":"pokemon_tcg_api","external_id":"hgss2"},{"set_code":"hgss3","name":"HS—Undaunted","series":"HeartGold & SoulSilver","source":"pokemon_tcg_api","external_id":"hgss3"},{"set_code":"hgss4","name":"HS—Triumphant","series":"HeartGold & SoulSilver","source":"pokemon_tcg_api","external_id":"hgss4"},{"set_code":"hsp","name":"HGSS Black Star Promos","series":"HeartGold & SoulSilver","source":"pokemon_tcg_api","external_id":"hsp"},{"set_code":"mcd11","name":"McDonald's Collection 2011","series":"Other","source":"pokemon_tcg_api","external_id":"mcd11"},{"set_code":"mcd12","name":"McDonald's Collection 2012","series":"Other","source":"pokemon_tcg_api","external_id":"mcd12"},{"set_code":"mcd14","name":"McDonald's Collection 2014","series":"Other","source":"pokemon_tcg_api","external_id":"mcd14"},{"set_code":"mcd15","name":"McDonald's Collection 2015","series":"Other","source":"pokemon_tcg_api","external_id":"mcd15"},{"set_code":"mcd16","name":"McDonald's Collection 2016","series":"Other","source":"pokemon_tcg_api","external_id":"mcd16"},{"set_code":"mcd17","name":"McDonald's Collection 2017","series":"Other","source":"pokemon_tcg_api","external_id":"mcd17"},{"set_code":"mcd18","name":"McDonald's Collection 2018","series":"Other","source":"pokemon_tcg_api","external_id":"mcd18"},{"set_code":"mcd19","name":"McDonald's Collection 2019","series":"Other","source":"pokemon_tcg_api","external_id":"mcd19"},{"set_code":"mcd21","name":"McDonald's Collection 2021","series":"Other","source":"pokemon_tcg_api","external_id":"mcd21"},{"set_code":"neo1","name":"Neo Genesis","series":"Neo","source":"pokemon_tcg_api","external_id":"neo1"},{"set_code":"neo2","name":"Neo Discovery","series":"Neo","source":"pokemon_tcg_api","external_id":"neo2"},{"set_code":"neo3","name":"Neo Revelation","series":"Neo","source":"pokemon_tcg_api","external_id":"neo3"},{"set_code":"neo4","name":"Neo Destiny","series":"Neo","source":"pokemon_tcg_api","external_id":"neo4"},{"set_code":"np","name":"Nintendo Black Star Promos","series":"NP","source":"pokemon_tcg_api","external_id":"np"},{"set_code":"pl1","name":"Platinum","series":"Platinum","source":"pokemon_tcg_api","external_id":"pl1"},{"set_code":"pl2","name":"Rising Rivals","series":"Platinum","source":"pokemon_tcg_api","external_id":"pl2"},{"set_code":"pl3","name":"Supreme Victors","series":"Platinum","source":"pokemon_tcg_api","external_id":"pl3"},{"set_code":"pl4","name":"Arceus","series":"Platinum","source":"pokemon_tcg_api","external_id":"pl4"},{"set_code":"pop1","name":"POP Series 1","series":"POP","source":"pokemon_tcg_api","external_id":"pop1"},{"set_code":"pop2","name":"POP Series 2","series":"POP","source":"pokemon_tcg_api","external_id":"pop2"},{"set_code":"pop3","name":"POP Series 3","series":"POP","source":"pokemon_tcg_api","external_id":"pop3"},{"set_code":"pop4","name":"POP Series 4","series":"POP","source":"pokemon_tcg_api","external_id":"pop4"},{"set_code":"pop5","name":"POP Series 5","series":"POP","source":"pokemon_tcg_api","external_id":"pop5"},{"set_code":"pop6","name":"POP Series 6","series":"POP","source":"pokemon_tcg_api","external_id":"pop6"},{"set_code":"pop7","name":"POP Series 7","series":"POP","source":"pokemon_tcg_api","external_id":"pop7"},{"set_code":"pop8","name":"POP Series 8","series":"POP","source":"pokemon_tcg_api","external_id":"pop8"},{"set_code":"pop9","name":"POP Series 9","series":"POP","source":"pokemon_tcg_api","external_id":"pop9"},{"set_code":"ru1","name":"Pokémon Rumble","series":"Other","source":"pokemon_tcg_api","external_id":"ru1"},{"set_code":"si1","name":"Southern Islands","series":"Other","source":"pokemon_tcg_api","external_id":"si1"},{"set_code":"sm10","name":"Unbroken Bonds","series":"Sun & Moon","source":"pokemon_tcg_api","external_id":"sm10"},{"set_code":"sm11","name":"Unified Minds","series":"Sun & Moon","source":"pokemon_tcg_api","external_id":"sm11"},{"set_code":"sm115","name":"Hidden Fates","series":"Sun & Moon","source":"pokemon_tcg_api","external_id":"sm115"},{"set_code":"sm3","name":"Burning Shadows","series":"Sun & Moon","source":"pokemon_tcg_api","external_id":"sm3"},{"set_code":"sm5","name":"Ultra Prism","series":"Sun & Moon","source":"pokemon_tcg_api","external_id":"sm5"},{"set_code":"sm6","name":"Forbidden Light","series":"Sun & Moon","source":"pokemon_tcg_api","external_id":"sm6"},{"set_code":"sm75","name":"Dragon Majesty","series":"Sun & Moon","source":"pokemon_tcg_api","external_id":"sm75"},{"set_code":"sm9","name":"Team Up","series":"Sun & Moon","source":"pokemon_tcg_api","external_id":"sm9"},{"set_code":"sma","name":"Hidden Fates Shiny Vault","series":"Sun & Moon","source":"pokemon_tcg_api","external_id":"sma"},{"set_code":"smp","name":"SM Black Star Promos","series":"Sun & Moon","source":"pokemon_tcg_api","external_id":"smp"},{"set_code":"sve","name":"Scarlet & Violet Energies","series":"Scarlet & Violet","source":"pokemon_tcg_api","external_id":"sve"},{"set_code":"svp","name":"Scarlet & Violet Black Star Promos","series":"Scarlet & Violet","source":"pokemon_tcg_api","external_id":"svp"},{"set_code":"swsh45sv","name":"Shining Fates Shiny Vault","series":"Sword & Shield","source":"pokemon_tcg_api","external_id":"swsh45sv"},{"set_code":"tk1a","name":"EX Trainer Kit Latias","series":"EX","source":"pokemon_tcg_api","external_id":"tk1a"},{"set_code":"tk1b","name":"EX Trainer Kit Latios","series":"EX","source":"pokemon_tcg_api","external_id":"tk1b"},{"set_code":"tk2a","name":"EX Trainer Kit 2 Plusle","series":"EX","source":"pokemon_tcg_api","external_id":"tk2a"},{"set_code":"tk2b","name":"EX Trainer Kit 2 Minun","series":"EX","source":"pokemon_tcg_api","external_id":"tk2b"},{"set_code":"xy0","name":"Kalos Starter Set","series":"XY","source":"pokemon_tcg_api","external_id":"xy0"},{"set_code":"xy1","name":"XY","series":"XY","source":"pokemon_tcg_api","external_id":"xy1"},{"set_code":"xy10","name":"Fates Collide","series":"XY","source":"pokemon_tcg_api","external_id":"xy10"},{"set_code":"xy12","name":"Evolutions","series":"XY","source":"pokemon_tcg_api","external_id":"xy12"},{"set_code":"xy2","name":"Flashfire","series":"XY","source":"pokemon_tcg_api","external_id":"xy2"},{"set_code":"xy3","name":"Furious Fists","series":"XY","source":"pokemon_tcg_api","external_id":"xy3"},{"set_code":"xy4","name":"Phantom Forces","series":"XY","source":"pokemon_tcg_api","external_id":"xy4"},{"set_code":"xy5","name":"Primal Clash","series":"XY","source":"pokemon_tcg_api","external_id":"xy5"},{"set_code":"xy6","name":"Roaring Skies","series":"XY","source":"pokemon_tcg_api","external_id":"xy6"},{"set_code":"xy7","name":"Ancient Origins","series":"XY","source":"pokemon_tcg_api","external_id":"xy7"},{"set_code":"xy8","name":"BREAKthrough","series":"XY","source":"pokemon_tcg_api","external_id":"xy8"},{"set_code":"xyp","name":"XY Black Star Promos","series":"XY","source":"pokemon_tcg_api","external_id":"xyp"}]$phase_7b_plan$::jsonb;
  expected_count constant integer := 117;
  actual_count integer;
  set_count integer;
  reference_count integer;
begin
  select count(*) into actual_count
  from jsonb_to_recordset(recovery_plan)
    as expected(set_code text, name text, series text, source text, external_id text);

  if actual_count <> expected_count then
    raise exception 'Phase 7B abort: expected %, received % planned rows.', expected_count, actual_count;
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(recovery_plan)
      as expected(set_code text, name text, series text, source text, external_id text)
    join public.sets_catalog existing on existing.set_code = expected.set_code
  ) then
    raise exception 'Phase 7B abort: one or more planned set_code values already exist; no existing data may be changed.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(recovery_plan)
      as expected(set_code text, name text, series text, source text, external_id text)
    join public.sets_catalog existing
      on existing.source = expected.source
     and existing.source_id = expected.external_id
  ) then
    raise exception 'Phase 7B abort: one or more planned source/source_id identities already exist; no existing data may be changed.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(recovery_plan)
      as expected(set_code text, name text, series text, source text, external_id text)
    join public.set_external_references existing
      on existing.source = expected.source
     and existing.external_id = expected.external_id
  ) then
    raise exception 'Phase 7B abort: one or more planned external references already exist; no existing data may be changed.';
  end if;

  insert into public.sets_catalog (set_code, name, series, source, source_id)
  select set_code, name, series, source, external_id
  from jsonb_to_recordset(recovery_plan)
    as expected(set_code text, name text, series text, source text, external_id text)
  order by set_code;

  insert into public.set_external_references (set_catalog_id, source, external_id)
  select actual.id, expected.source, expected.external_id
  from jsonb_to_recordset(recovery_plan)
    as expected(set_code text, name text, series text, source text, external_id text)
  join public.sets_catalog actual
    on actual.set_code = expected.set_code
   and actual.name = expected.name
   and actual.series = expected.series
   and actual.source = expected.source
   and actual.source_id = expected.external_id
  order by expected.set_code;

  select count(*) into set_count
  from jsonb_to_recordset(recovery_plan)
    as expected(set_code text, name text, series text, source text, external_id text)
  join public.sets_catalog actual
    on actual.set_code = expected.set_code
   and actual.name = expected.name
   and actual.series = expected.series
   and actual.source = expected.source
   and actual.source_id = expected.external_id;

  if set_count <> expected_count then
    raise exception 'Phase 7B abort: exact set postcheck expected %, found %.', expected_count, set_count;
  end if;

  select count(*) into reference_count
  from jsonb_to_recordset(recovery_plan)
    as expected(set_code text, name text, series text, source text, external_id text)
  join public.sets_catalog actual on actual.set_code = expected.set_code
  join public.set_external_references reference
    on reference.set_catalog_id = actual.id
   and reference.source = expected.source
   and reference.external_id = expected.external_id;

  if reference_count <> expected_count then
    raise exception 'Phase 7B abort: exact reference postcheck expected %, found %.', expected_count, reference_count;
  end if;
end
$$;

-- Expected success: 117 new sets + 117 new references. No other table is written.
