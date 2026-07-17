import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadPokemonTcgDataJson } from './local-json.ts';
import { parseCardDetails, type CardDetails } from './card-details.ts';

const API_BASE_URL = 'https://api.pokemontcg.io/v2';
const SOURCE = 'pokemon_tcg_api';
const WRITE_ALLOWED_SET_IDS = new Set(['sv3pt5', 'sv3']);
const PAGE_SIZE = 250;

type Options = { setId: string; source: 'pokemon_tcg_api' | 'pokemon_tcg_data'; inputPath?: string; write: boolean };
type IncomingCard = { id: string; details: CardDetails };
type CatalogTarget = { id: string; external_id: string; set_code: string | null; card_details: CardDetails | null };

function parseArgs(argv: readonly string[]): Options {
  let setId: string | undefined;
  let source: Options['source'] = 'pokemon_tcg_api';
  let inputPath: string | undefined;
  let write = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (arg === '--set' && value) { setId = value; i += 1; continue; }
    if (arg === '--source' && value && (value === 'pokemon_tcg_api' || value === 'pokemon_tcg_data')) { source = value; i += 1; continue; }
    if (arg === '--input' && value) { inputPath = value; i += 1; continue; }
    if (arg === '--write') { write = true; continue; }
    throw new Error(`Onbekend of ongeldig argument: ${arg}`);
  }

  if (!setId || !/^[a-z0-9]{1,32}$/.test(setId)) throw new Error('Gebruik een geldige --set.');
  if (source === 'pokemon_tcg_data' && !inputPath) throw new Error('Lokale bron vereist --input.');
  if (source === 'pokemon_tcg_api' && inputPath) throw new Error('--input is alleen toegestaan met pokemon_tcg_data.');
  if (write && (!WRITE_ALLOWED_SET_IDS.has(setId) || source !== 'pokemon_tcg_api')) {
    throw new Error('Write geblokkeerd: alleen pokemon_tcg_api voor sv3pt5 of sv3 is geautoriseerd.');
  }
  return { setId, source, inputPath, write };
}

function config(): { supabase: SupabaseClient; apiKey?: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.');
  return {
    supabase: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    apiKey: process.env.POKEMON_TCG_API_KEY,
  };
}

async function fetchApiCards(setId: string, apiKey: string): Promise<IncomingCard[]> {
  const cards: IncomingCard[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const url = new URL(`${API_BASE_URL}/cards`);
    url.searchParams.set('q', `set.id:${setId}`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    const response = await fetch(url, { headers: { 'X-Api-Key': apiKey, Accept: 'application/json' } });
    if (!response.ok) throw new Error(`API-request mislukt met HTTP ${response.status}.`);
    const body = (await response.json()) as { data?: unknown[] };
    const pageCards = Array.isArray(body.data) ? body.data : [];
    if (pageCards.length === 0) break;
    for (const raw of pageCards) {
      if (!raw || typeof raw !== 'object') throw new Error('API bevat een ongeldig kaartitem.');
      const card = raw as Record<string, unknown>;
      if (typeof card.id !== 'string') throw new Error('API-kaart mist external ID.');
      cards.push({ id: card.id, details: parseCardDetails(card) });
    }
    if (pageCards.length < PAGE_SIZE) break;
  }
  return cards;
}

async function readIncoming(options: Options, apiKey?: string): Promise<IncomingCard[]> {
  if (options.source === 'pokemon_tcg_data') {
    return loadPokemonTcgDataJson(options.inputPath!, options.setId).cards.map((card) => ({ id: card.id, details: card.details }));
  }
  if (!apiKey) throw new Error('POKEMON_TCG_API_KEY ontbreekt.');
  return fetchApiCards(options.setId, apiKey);
}

async function readTargets(supabase: SupabaseClient, ids: string[]): Promise<CatalogTarget[]> {
  const { data, error } = await supabase
    .from('card_external_references')
    .select('external_id, card_catalog_id, cards_catalog!inner(id, external_id, set_code, card_details)')
    .eq('source', SOURCE)
    .in('external_id', ids);
  if (error) throw new Error(`Supabase matching mislukt: ${error.message}`);
  return (data ?? []).flatMap((row) => {
    const nested = (row as { cards_catalog?: CatalogTarget }).cards_catalog;
    return nested ? [{ ...nested, external_id: (row as { external_id: string }).external_id }] : [];
  });
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

async function countCollectionCards(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from('collection_cards').select('id', { count: 'exact', head: true });
  if (error || count === null) throw new Error('collection_cards veiligheidscount mislukt.');
  return count;
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const { supabase, apiKey } = config();
  const incoming = await readIncoming(options, apiKey);
  const ids = incoming.map((card) => card.id);
  const duplicateIds = [...countBy(ids, (id) => id)].filter(([, count]) => count > 1);
  if (incoming.length === 0 || duplicateIds.length > 0) throw new Error('Input bevat geen kaarten of dubbele external IDs.');

  const targets = await readTargets(supabase, ids);
  const targetsByExternalId = new Map(targets.map((target) => [target.external_id, target]));
  const missingTargets = ids.filter((id) => !targetsByExternalId.has(id));
  const wrongSet = targets.filter((target) => target.set_code !== options.setId);
  const updates = incoming.filter((card) => {
    const target = targetsByExternalId.get(card.id);
    return target && target.set_code === options.setId && (!target.card_details || Object.keys(target.card_details).length === 0) && Object.keys(card.details).length > 0;
  });

  console.log('Catalog details backfill');
  console.log(`Source: ${options.source}`);
  console.log(`Set: ${options.setId}`);
  console.log(`Mode: ${options.write ? 'WRITE' : 'DRY RUN'}`);
  console.log(`Incoming cards: ${incoming.length}`);
  console.log(`Matched targets: ${targets.length}`);
  console.log(`Missing targets: ${missingTargets.length}`);
  console.log(`Wrong set targets: ${wrongSet.length}`);
  console.log(`Empty details before: ${targets.filter((target) => !target.card_details || Object.keys(target.card_details).length === 0).length}`);
  console.log(`Planned detail updates: ${updates.length}`);

  if (missingTargets.length > 0 || wrongSet.length > 0 || updates.length > incoming.length) throw new Error('Backfill geblokkeerd door onvolledige of onveilige matching.');
  if (!options.write) { console.log('Result: PASS'); console.log('Database writes: 0'); return 0; }

  const before = await countCollectionCards(supabase);
  let updated = 0;
  for (const card of updates) {
    const target = targetsByExternalId.get(card.id)!;
    const { error } = await supabase.from('cards_catalog').update({ card_details: card.details }).eq('id', target.id).eq('card_details', '{}');
    if (error) throw new Error(`Backfill update mislukt: ${error.message}`);
    updated += 1;
  }
  const after = await countCollectionCards(supabase);
  if (before !== after) throw new Error(`collection_cards veranderde van ${before} naar ${after}.`);
  console.log(`Updated detail rows: ${updated}`);
  console.log('Result: PASS');
  console.log(`Database writes: ${updated}`);
  return 0;
}

main().catch((error) => {
  console.error(`Fout: ${error instanceof Error ? error.message : 'Onbekende backfillfout.'}`);
  console.error('Result: FAIL');
  console.error('Database writes: 0');
  process.exitCode = 1;
});
