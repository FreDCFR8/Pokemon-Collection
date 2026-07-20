import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { loadPokemonTcgDataJson } from './local-json.ts';
import { PINNED_DATASET_VERSION, validateLocalDatasetCheckout } from './local-checkout.ts';
import { reportHash } from './catalog-report-identity.ts';

const SOURCE = 'pokemon_tcg_api';
const EXCEPTION_SET_ID = 'svp';
const EXPECTED_EXCEPTION_SETS = 18;
const CHUNK_SIZE = 100;
const MANIFEST_PATH = 'config/catalog/local-pokemon-tcg-data-manifest.json';
const REVIEW_PATH = 'config/catalog/remaining-set-catalog-mapping-review.json';

type ManifestSet = { setId: string; jsonPath: string; expectedCards: number; enabled: boolean; name: string; series: string };
type Review = { createdFrom?: { datasetVersion?: string }; excludedSets?: Array<{ setId: string; reason: string }> };
type IncomingCard = { external_id: string; pokemon: string; set_name: string; set_code: string; number: string; rarity: string | null; image_small: string | null; image_large: string | null };
type CatalogCard = IncomingCard & { id: string; external_source: string | null; external_id: string | null };
type Reference = { external_id: string; card_catalog_id: string; cards_catalog: CatalogCard | CatalogCard[] | null };
type Classification = 'safe_extension_candidate' | 'partial_legacy' | 'metadata_conflict' | 'identity_conflict' | 'manual_review' | 'missing_mapping';

export type ExceptionScope = ManifestSet & { reviewReason: string | null };

function chunks<T>(items: T[]): T[][] { const result: T[][] = []; for (let index = 0; index < items.length; index += CHUNK_SIZE) result.push(items.slice(index, index + CHUNK_SIZE)); return result; }
function example(values: string[]): string[] { return [...new Set(values)].sort().slice(0, 10); }

export function createExceptionScope(manifest: { datasetVersion?: string; sets?: ManifestSet[] }, review: Review): ExceptionScope[] {
  if (manifest.datasetVersion !== PINNED_DATASET_VERSION || !Array.isArray(manifest.sets) || manifest.sets.length !== 173) throw new Error('Manifestidentiteit is ongeldig.');
  if (review.createdFrom?.datasetVersion !== PINNED_DATASET_VERSION || !Array.isArray(review.excludedSets) || review.excludedSets.length !== 17) throw new Error('Reviewidentiteit is ongeldig.');
  const reviewReasons = new Map(review.excludedSets.map((entry) => [entry.setId, entry.reason]));
  if (reviewReasons.size !== 17 || reviewReasons.has(EXCEPTION_SET_ID)) throw new Error('Uitgesloten setscope is ongeldig.');
  const ids = [...reviewReasons.keys(), EXCEPTION_SET_ID].sort();
  if (ids.length !== EXPECTED_EXCEPTION_SETS) throw new Error('Exception-scope bevat niet exact 18 sets.');
  return ids.map((setId) => {
    const set = manifest.sets!.find((candidate) => candidate.setId === setId);
    if (!set || !set.enabled || !set.jsonPath || !set.name || !set.series || !Number.isInteger(set.expectedCards)) throw new Error(`${setId}: ontbreekt of is ongeldig in het gepinde manifest.`);
    return { ...set, reviewReason: reviewReasons.get(setId) ?? 'existing_card_identity_conflict' };
  });
}

function parseArgs(argv: string[]) {
  if (argv.length !== 4 || argv[0] !== '--input-root' || argv[2] !== '--report' || !argv[1] || !argv[3]) throw new Error('Gebruik uitsluitend --input-root <dataset> --report <nieuw rapport>.');
  return { inputRoot: resolve(argv[1]), reportPath: resolve(argv[3]) };
}

function inputCards(inputRoot: string, set: ExceptionScope): IncomingCard[] {
  const loaded = loadPokemonTcgDataJson(join(inputRoot, set.jsonPath), set.setId);
  if (loaded.cards.length !== set.expectedCards) throw new Error(`${set.setId}: lokaal kaartenaantal wijkt af van het manifest.`);
  const cards = loaded.cards.map((card) => {
    if (!card.id || !card.name || !card.number) throw new Error(`${set.setId}: kaartmetadata ontbreekt.`);
    return { external_id: card.id, pokemon: card.name, set_name: set.name, set_code: set.setId, number: card.number, rarity: card.rarity ?? null, image_small: card.images?.small ?? null, image_large: card.images?.large ?? null };
  });
  if (new Set(cards.map((card) => card.external_id)).size !== cards.length) throw new Error(`${set.setId}: dubbele externe kaartidentiteit in lokale dataset.`);
  return cards;
}

function coreMetadataMatches(expected: IncomingCard, actual: CatalogCard): boolean {
  return actual.external_source === SOURCE && actual.external_id === expected.external_id
    && actual.pokemon === expected.pokemon && actual.set_name === expected.set_name
    && actual.set_code === expected.set_code && actual.number === expected.number
    && actual.rarity === expected.rarity && actual.image_small === expected.image_small
    && actual.image_large === expected.image_large;
}

function nestedCard(value: Reference['cards_catalog']): CatalogCard | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function auditSet(client: ReturnType<typeof createClient>, inputRoot: string, set: ExceptionScope) {
  const incoming = inputCards(inputRoot, set);
  const ids = incoming.map((card) => card.external_id);
  const [{ data: setRows, error: setError }, cardsResult, referencesResult] = await Promise.all([
    client.from('sets_catalog').select('set_code,name,series,source,source_id').eq('set_code', set.setId),
    Promise.all(chunks(ids).map((part) => client.from('cards_catalog').select('id,external_source,external_id,pokemon,set_name,set_code,number,rarity,image_small,image_large').eq('external_source', SOURCE).in('external_id', part))),
    Promise.all(chunks(ids).map((part) => client.from('card_external_references').select('external_id,card_catalog_id,cards_catalog!inner(id,external_source,external_id,pokemon,set_name,set_code,number,rarity,image_small,image_large)').eq('source', SOURCE).in('external_id', part))),
  ]);
  if (setError || !setRows) throw new Error(`${set.setId}: sets_catalog-read mislukt.`);
  const cards: CatalogCard[] = []; for (const result of cardsResult) { if (result.error) throw new Error(`${set.setId}: cards_catalog-read mislukt.`); cards.push(...(result.data ?? []) as CatalogCard[]); }
  const references: Reference[] = []; for (const result of referencesResult) { if (result.error) throw new Error(`${set.setId}: card_external_references-read mislukt.`); references.push(...(result.data ?? []) as Reference[]); }
  const exactSet = setRows.some((row) => row.set_code === set.setId && row.name === set.name && row.series === set.series && row.source === SOURCE && row.source_id === set.setId);
  const cardsByExternal = new Map(cards.map((card) => [card.external_id!, card]));
  const refsByExternal = new Map(references.map((reference) => [reference.external_id, reference]));
  const catalogIds = new Set<string>(); const missing: string[] = []; const metadataConflicts: string[] = []; const identityConflicts: string[] = []; let exact = 0;
  for (const card of incoming) {
    const direct = cardsByExternal.get(card.external_id); const reference = refsByExternal.get(card.external_id); const referenced = reference ? nestedCard(reference.cards_catalog) : null;
    if (direct) catalogIds.add(direct.id); if (referenced) catalogIds.add(referenced.id);
    if (direct && referenced && direct.id !== referenced.id) { identityConflicts.push(card.external_id); continue; }
    const actual = direct ?? referenced;
    if (!actual) { missing.push(card.external_id); continue; }
    if (!reference || reference.card_catalog_id !== actual.id) { identityConflicts.push(card.external_id); continue; }
    if (coreMetadataMatches(card, actual)) exact += 1; else metadataConflicts.push(card.external_id);
  }
  const collectionLinks = new Set<string>();
  if (catalogIds.size > 0) {
    for (const part of chunks([...catalogIds])) {
      const { data, error } = await client.from('collection_cards').select('card_catalog_id').in('card_catalog_id', part);
      if (error) throw new Error(`${set.setId}: collection_cards-read mislukt.`);
      for (const row of data ?? []) collectionLinks.add(row.card_catalog_id as string);
    }
  }
  const manual = set.reviewReason?.startsWith('manual_review') === true;
  const classification: Classification = manual ? 'manual_review'
    : identityConflicts.length > 0 ? 'identity_conflict'
      : metadataConflicts.length > 0 ? 'metadata_conflict'
        : !exactSet ? 'missing_mapping'
          : exact > 0 && missing.length > 0 ? 'partial_legacy'
            : 'safe_extension_candidate';
  return {
    setId: set.setId, name: set.name, series: set.series, reviewReason: set.reviewReason,
    expectedCards: incoming.length, exactSetMapping: exactSet, existingExactCards: exact,
    missingCards: missing.length, metadataConflictCards: metadataConflicts.length,
    identityConflictCards: identityConflicts.length, collectionLinkedCards: collectionLinks.size,
    classification, examples: { missing: example(missing), metadataConflict: example(metadataConflicts), identityConflict: example(identityConflicts) },
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (existsSync(options.reportPath)) throw new Error(`Rapport bestaat al: ${options.reportPath}`);
  validateLocalDatasetCheckout(options.inputRoot, PINNED_DATASET_VERSION);
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { datasetVersion?: string; sets?: ManifestSet[] };
  const review = JSON.parse(readFileSync(REVIEW_PATH, 'utf8')) as Review;
  const scope = createExceptionScope(manifest, review);
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  const client = createClient(url, key);
  const results = []; const errors: string[] = [];
  for (const set of scope) try { results.push(await auditSet(client, options.inputRoot, set)); } catch (error) { errors.push(error instanceof Error ? error.message : `${set.setId}: onbekende auditfout.`); }
  const report = { schemaVersion: 1, phase: 'Phase 7B exception audit', mode: 'read-only', datasetVersion: PINNED_DATASET_VERSION, setIds: scope.map((set) => set.setId), databaseWritesTotal: 0, status: errors.length === 0 ? 'PASS' : 'FAIL', errors, results, reportHash: '' };
  report.reportHash = reportHash(report);
  mkdirSync(dirname(options.reportPath), { recursive: true });
  writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Phase 7B exception audit: ${report.status}; sets=${results.length}/${EXPECTED_EXCEPTION_SETS}; databaseWritesTotal=0; reportHash=${report.reportHash}`);
  if (report.status === 'FAIL') process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Phase 7B exception audit failed.'); process.exitCode = 1; });
}
