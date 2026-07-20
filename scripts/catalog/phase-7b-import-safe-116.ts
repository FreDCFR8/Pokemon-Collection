import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { deterministicCatalogCardUuid } from './import-set.ts';
import { loadPokemonTcgDataJson } from './local-json.ts';
import { PINNED_DATASET_VERSION, validateLocalDatasetCheckout } from './local-checkout.ts';

const SOURCE = 'pokemon_tcg_api';
const BLOCKED_SET_ID = 'svp';
const EXPECTED_SAFE_SETS = 116;
const EXPECTED_SAFE_CARDS = 10_703;
const CHUNK_SIZE = 100;
const MANIFEST_PATH = 'config/catalog/local-pokemon-tcg-data-manifest.json';
const REVIEW_PATH = 'config/catalog/remaining-set-catalog-mapping-review.json';

type Mode = 'dry-run' | 'write' | 'idempotency';
type ManifestSet = { setId: string; jsonPath: string; expectedCards: number; enabled: boolean; name: string; series: string };
type CardRow = { id: string; external_id: string; pokemon: string; set_name: string; set_code: string; number: string; rarity: string | null; image_small: string | null; image_large: string | null; card_details: Record<string, unknown> };
type Report = { schemaVersion: 1; mode: Mode; datasetVersion: string; manifestHash: string; writePlanHash: string; reportHash: string; setIds: string[]; expectedCards: number; plannedDatabaseWrites: number; databaseWritesTotal: number; status: 'PASS' | 'FAIL'; errors: string[] };

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}
function hash(value: unknown): string { return createHash('sha256').update(canonical(value), 'utf8').digest('hex'); }
function batches<T>(items: T[]): T[][] { const result: T[][] = []; for (let start = 0; start < items.length; start += CHUNK_SIZE) result.push(items.slice(start, start + CHUNK_SIZE)); return result; }

export function selectSafeScope(review: { createdFrom?: { datasetVersion?: string }; proposedMappings?: ManifestSet[] }): ManifestSet[] {
  if (review.createdFrom?.datasetVersion !== PINNED_DATASET_VERSION || !Array.isArray(review.proposedMappings) || review.proposedMappings.length !== 117) throw new Error('Reviewidentiteit is ongeldig.');
  const scope = review.proposedMappings.filter((set) => set.setId !== BLOCKED_SET_ID);
  if (scope.length !== EXPECTED_SAFE_SETS || scope.some((set) => !set.setId || !set.jsonPath || !set.name || !set.series || !Number.isInteger(set.expectedCards))) throw new Error('De vaste veilige 116-setscope is ongeldig.');
  return scope.sort((left, right) => left.setId.localeCompare(right.setId));
}

export function createWritePlan(inputRoot: string, scope: ManifestSet[]): CardRow[] {
  const rows: CardRow[] = [];
  for (const set of scope) {
    const loaded = loadPokemonTcgDataJson(join(inputRoot, set.jsonPath), set.setId);
    // Upstream per-set card files may omit repeated set-name metadata. The
    // pinned manifest is canonical for the set name; local-json validates a
    // present card.set.id against this setId.
    if (loaded.cards.length !== set.expectedCards) throw new Error(`${set.setId}: lokaal kaartenaantal wijkt af van het manifest.`);
    for (const card of loaded.cards) {
      if (!card.id || !card.name || !card.number) throw new Error(`${set.setId}: kaartmetadata ontbreekt.`);
      rows.push({ id: deterministicCatalogCardUuid(SOURCE, card.id), external_id: card.id, pokemon: card.name, set_name: set.name, set_code: set.setId, number: card.number, rarity: card.rarity ?? null, image_small: card.images?.small ?? null, image_large: card.images?.large ?? null, card_details: card.details });
    }
  }
  rows.sort((left, right) => left.external_id.localeCompare(right.external_id));
  if (rows.length !== EXPECTED_SAFE_CARDS || new Set(rows.map((row) => row.id)).size !== rows.length || new Set(rows.map((row) => row.external_id)).size !== rows.length) throw new Error('Writeplan is niet exact 10.703 unieke kaarten.');
  return rows;
}

function parseArgs(argv: string[]) {
  const result = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) { const key = argv[index]; const value = argv[index + 1]; if (!['--mode', '--input-root', '--report', '--approved-report', '--confirm-write'].includes(key) || !value) throw new Error(`Ongeldig argument: ${key ?? '[ontbrekend]'}.`); result.set(key, value); }
  const mode = result.get('--mode') as Mode | undefined;
  if (!mode || !['dry-run', 'write', 'idempotency'].includes(mode) || !result.get('--input-root') || !result.get('--report')) throw new Error('Gebruik --mode dry-run|write|idempotency --input-root <dataset> --report <nieuw rapport>.');
  if (mode === 'write' && (result.get('--confirm-write') !== 'phase-7b-safe-116' || !result.get('--approved-report'))) throw new Error('Write vereist --approved-report en --confirm-write phase-7b-safe-116.');
  return { mode, inputRoot: resolve(result.get('--input-root')!), reportPath: resolve(result.get('--report')!), approvedReport: result.get('--approved-report') };
}

async function readExactState(client: ReturnType<typeof createClient>, scope: ManifestSet[], plan: CardRow[], requirePresent: boolean): Promise<void> {
  const { data: sets, error: setError } = await client.from('sets_catalog').select('set_code,name,series,source,source_id').in('set_code', scope.map((set) => set.setId));
  if (setError || !sets || sets.length !== scope.length) throw new Error('Setcatalogusprecheck is niet exact.');
  for (const expected of scope) if (!sets.some((actual) => actual.set_code === expected.setId && actual.name === expected.name && actual.series === expected.series && actual.source === SOURCE && actual.source_id === expected.setId)) throw new Error(`${expected.setId}: setcatalogusmetadata wijkt af.`);
  for (const part of batches(plan)) {
    const ids = part.map((row) => row.external_id);
    const { data: references, error } = await client.from('card_external_references').select('external_id,card_catalog_id,cards_catalog!inner(id,external_source,external_id,pokemon,set_name,set_code,number,rarity,image_small,image_large,card_details)').eq('source', SOURCE).in('external_id', ids);
    if (error) throw new Error('Card-referencecontrole mislukt.');
    if (!requirePresent && (references?.length ?? 0) !== 0) throw new Error('Write geblokkeerd: minstens één geplande kaart bestaat al.');
    if (requirePresent && (references?.length ?? 0) !== part.length) throw new Error('Postcheck: geplande kaartreference ontbreekt.');
    if (requirePresent) for (const row of part) {
      const match = references?.find((reference) => reference.external_id === row.external_id) as { card_catalog_id: string; cards_catalog: CardRow } | undefined;
      const card = match?.cards_catalog;
      if (!match || !card || match.card_catalog_id !== row.id || canonical({ ...card, external_id: row.external_id }) !== canonical({ ...row, external_source: SOURCE })) throw new Error(`${row.external_id}: postcheck vond afwijkende kaartmetadata of reference.`);
    }
  }
}

function writeReport(path: string, report: Omit<Report, 'reportHash'>): Report {
  const complete = { ...report, reportHash: hash(report) };
  writeFileSync(path, `${JSON.stringify(complete, null, 2)}\n`, 'utf8');
  return complete;
}
function assertApprovedReport(path: string, expected: Pick<Report, 'datasetVersion' | 'manifestHash' | 'writePlanHash' | 'setIds' | 'expectedCards' | 'plannedDatabaseWrites'>): void {
  const report = JSON.parse(readFileSync(path, 'utf8')) as Report;
  if (report.mode !== 'dry-run' || report.status !== 'PASS' || report.databaseWritesTotal !== 0 || report.reportHash !== hash({ schemaVersion: report.schemaVersion, mode: report.mode, datasetVersion: report.datasetVersion, manifestHash: report.manifestHash, writePlanHash: report.writePlanHash, setIds: report.setIds, expectedCards: report.expectedCards, plannedDatabaseWrites: report.plannedDatabaseWrites, databaseWritesTotal: report.databaseWritesTotal, status: report.status, errors: report.errors }) || canonical(expected) !== canonical({ datasetVersion: report.datasetVersion, manifestHash: report.manifestHash, writePlanHash: report.writePlanHash, setIds: report.setIds, expectedCards: report.expectedCards, plannedDatabaseWrites: report.plannedDatabaseWrites })) throw new Error('Goedgekeurd dry-runrapport hoort niet bij dit exacte writeplan.');
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (existsSync(options.reportPath)) throw new Error(`Rapport bestaat al: ${options.reportPath}`);
  validateLocalDatasetCheckout(options.inputRoot, PINNED_DATASET_VERSION);
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { datasetVersion?: string; sets?: ManifestSet[] };
  const review = JSON.parse(readFileSync(REVIEW_PATH, 'utf8')) as { createdFrom?: { datasetVersion?: string }; proposedMappings?: ManifestSet[] };
  if (manifest.datasetVersion !== PINNED_DATASET_VERSION || !Array.isArray(manifest.sets) || manifest.sets.length !== 173) throw new Error('Manifestidentiteit is ongeldig.');
  const scope = selectSafeScope(review);
  for (const selected of scope) {
    const manifestSet = manifest.sets.find((set) => set.setId === selected.setId);
    if (!manifestSet || !manifestSet.enabled || canonical({ setId: manifestSet.setId, jsonPath: manifestSet.jsonPath, expectedCards: manifestSet.expectedCards, name: manifestSet.name, series: manifestSet.series }) !== canonical({ setId: selected.setId, jsonPath: selected.jsonPath, expectedCards: selected.expectedCards, name: selected.name, series: selected.series })) throw new Error(`${selected.setId}: review wijkt af van het gepinde manifest.`);
  }
  const plan = createWritePlan(options.inputRoot, scope);
  const identity = { datasetVersion: PINNED_DATASET_VERSION, manifestHash: hash(manifest), writePlanHash: hash(plan), setIds: scope.map((set) => set.setId), expectedCards: plan.length, plannedDatabaseWrites: plan.length * 2 };
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const errors: string[] = []; let writes = 0;
  try {
    if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken.');
    const client = createClient(url, key);
    if (options.mode === 'write') assertApprovedReport(resolve(options.approvedReport!), identity);
    await readExactState(client, scope, plan, options.mode === 'idempotency');
    if (options.mode === 'write') for (const part of batches(plan)) {
      const { data, error } = await client.rpc('phase_7b_insert_catalog_card_chunk', { p_rows: part });
      const result = Array.isArray(data) ? data[0] as { cards_inserted?: number; references_inserted?: number } : undefined;
      if (error || !result || result.cards_inserted !== part.length || result.references_inserted !== part.length) throw new Error(`Transactionele chunkwrite mislukt: ${error?.message ?? 'ongeldige response'}`);
      writes += result.cards_inserted + result.references_inserted;
    }
    if (options.mode !== 'dry-run') await readExactState(client, scope, plan, true);
    if (options.mode === 'idempotency') writes = 0;
  } catch (error) { errors.push(error instanceof Error ? error.message : 'Onbekende fout.'); }
  const report = writeReport(options.reportPath, { schemaVersion: 1, mode: options.mode, ...identity, databaseWritesTotal: writes, status: errors.length === 0 ? 'PASS' : 'FAIL', errors });
  console.log(`Phase 7B safe-116 ${report.mode}: ${report.status}; cards=${report.expectedCards}; databaseWritesTotal=${report.databaseWritesTotal}; reportHash=${report.reportHash}`);
  if (report.status === 'FAIL') process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Phase 7B runner failed.'); process.exitCode = 1; });
}
