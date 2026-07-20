import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { deterministicCatalogCardUuid } from './import-set.ts';
import { loadPokemonTcgDataJson } from './local-json.ts';
import { PINNED_DATASET_VERSION, validateLocalDatasetCheckout } from './local-checkout.ts';

const SOURCE = 'pokemon_tcg_api';
const CHUNK_SIZE = 100;
const EXPECTED_CARDS = 494;
const EXPECTED_SET_IDS = ['swsh10tg', 'swsh11tg', 'swsh12pt5gg', 'swsh12tg', 'swsh9tg', 'swshp'] as const;
const MANIFEST_PATH = 'config/catalog/local-pokemon-tcg-data-manifest.json';

type Mode = 'dry-run' | 'write' | 'idempotency';
type ManifestSet = { setId: string; jsonPath: string; expectedCards: number; enabled: boolean; name: string; series: string };
type CardRow = { id: string; external_id: string; pokemon: string; set_name: string; set_code: string; number: string; rarity: string | null; image_small: string | null; image_large: string | null; card_details: Record<string, unknown> };
type Report = { schemaVersion: 1; phase: 'Phase 7B safe six external sets'; mode: Mode; datasetVersion: string; manifestHash: string; writePlanHash: string; reportHash: string; setIds: string[]; expectedCards: number; plannedDatabaseWrites: number; databaseWritesTotal: number; status: 'PASS' | 'FAIL'; errors: string[] };

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}
function hash(value: unknown): string { return createHash('sha256').update(canonical(value), 'utf8').digest('hex'); }
function chunks<T>(items: T[]): T[][] { const result: T[][] = []; for (let start = 0; start < items.length; start += CHUNK_SIZE) result.push(items.slice(start, start + CHUNK_SIZE)); return result; }

export function selectExternalReferenceScope(manifest: { datasetVersion?: string; sets?: ManifestSet[] }): ManifestSet[] {
  if (manifest.datasetVersion !== PINNED_DATASET_VERSION || !Array.isArray(manifest.sets) || manifest.sets.length !== 173) throw new Error('Manifestidentiteit is ongeldig.');
  const expected = new Set<string>(EXPECTED_SET_IDS);
  const scope = manifest.sets.filter((set) => expected.has(set.setId));
  if (scope.length !== EXPECTED_SET_IDS.length || scope.some((set) => !set.enabled || !set.jsonPath || !set.name || !set.series || !Number.isInteger(set.expectedCards)) || scope.some((set) => !expected.delete(set.setId))) throw new Error('De vaste zes-setscope is ongeldig.');
  if (expected.size !== 0 || scope.reduce((total, set) => total + set.expectedCards, 0) !== EXPECTED_CARDS) throw new Error('De vaste zes-setscope heeft geen exact kaartentotaal.');
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
  if (rows.length !== EXPECTED_CARDS || new Set(rows.map((row) => row.id)).size !== rows.length || new Set(rows.map((row) => row.external_id)).size !== rows.length) throw new Error('Writeplan is niet exact 494 unieke kaarten.');
  return rows;
}

function parseArgs(argv: string[]) {
  const result = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) { const key = argv[index]; const value = argv[index + 1]; if (!['--mode', '--input-root', '--report', '--approved-report', '--confirm-write'].includes(key) || !value) throw new Error(`Ongeldig argument: ${key ?? '[ontbrekend]'}.`); result.set(key, value); }
  const mode = result.get('--mode') as Mode | undefined;
  if (!mode || !['dry-run', 'write', 'idempotency'].includes(mode) || !result.get('--input-root') || !result.get('--report')) throw new Error('Gebruik --mode dry-run|write|idempotency --input-root <dataset> --report <nieuw rapport>.');
  if (mode === 'write' && (result.get('--confirm-write') !== 'phase-7b-safe-six-external-sets' || !result.get('--approved-report'))) throw new Error('Write vereist --approved-report en --confirm-write phase-7b-safe-six-external-sets.');
  return { mode, inputRoot: resolve(result.get('--input-root')!), reportPath: resolve(result.get('--report')!), approvedReport: result.get('--approved-report') };
}

async function readExactState(client: ReturnType<typeof createClient>, scope: ManifestSet[], plan: CardRow[], requirePresent: boolean): Promise<void> {
  const [setsResult, setReferencesResult] = await Promise.all([
    client.from('sets_catalog').select('id,set_code,name,series').in('set_code', scope.map((set) => set.setId)),
    client.from('set_external_references').select('set_catalog_id,source,external_id').eq('source', SOURCE).in('external_id', scope.map((set) => set.setId)),
  ]);
  if (setsResult.error || !setsResult.data || setsResult.data.length !== scope.length || setReferencesResult.error || !setReferencesResult.data || setReferencesResult.data.length !== scope.length) throw new Error('Setcatalogusprecheck is niet exact.');
  for (const expected of scope) {
    const set = setsResult.data.find((actual) => actual.set_code === expected.setId);
    const reference = setReferencesResult.data.find((actual) => actual.external_id === expected.setId);
    if (!set || !reference || set.name !== expected.name || set.series !== expected.series || reference.set_catalog_id !== set.id || reference.source !== SOURCE) throw new Error(`${expected.setId}: exact extern setmappingbewijs ontbreekt of wijkt af.`);
  }
  for (const part of chunks(plan)) {
    const ids = part.map((row) => row.external_id);
    const [byExternal, byId, referenceResult] = await Promise.all([
      client.from('cards_catalog').select('id,external_source,external_id').eq('external_source', SOURCE).in('external_id', ids),
      client.from('cards_catalog').select('id,external_source,external_id').in('id', part.map((row) => row.id)),
      client.from('card_external_references').select('external_id,card_catalog_id,cards_catalog!inner(id,external_source,external_id,pokemon,set_name,set_code,number,rarity,image_small,image_large,card_details)').eq('source', SOURCE).in('external_id', ids),
    ]);
    if (byExternal.error || byId.error || referenceResult.error) throw new Error('Cardcatalogus- of referencecontrole mislukt.');
    const references = referenceResult.data;
    if (!requirePresent && ((byExternal.data?.length ?? 0) !== 0 || (byId.data?.length ?? 0) !== 0 || (references?.length ?? 0) !== 0)) throw new Error('Write geblokkeerd: minstens één geplande kaartidentiteit bestaat al.');
    if (requirePresent && ((byExternal.data?.length ?? 0) !== part.length || (byId.data?.length ?? 0) !== part.length || (references?.length ?? 0) !== part.length)) throw new Error('Postcheck: geplande kaart of reference ontbreekt.');
    if (requirePresent) for (const row of part) {
      const match = references?.find((reference) => reference.external_id === row.external_id) as { card_catalog_id: string; cards_catalog: CardRow } | undefined;
      const card = match?.cards_catalog;
      if (!match || !card || match.card_catalog_id !== row.id || canonical({ ...card, external_id: row.external_id }) !== canonical({ ...row, external_source: SOURCE })) throw new Error(`${row.external_id}: postcheck vond afwijkende kaartmetadata of reference.`);
    }
  }
}

function writeReport(path: string, report: Omit<Report, 'reportHash'>): Report {
  const complete = { ...report, reportHash: hash(report) };
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(complete, null, 2)}\n`, 'utf8');
  return complete;
}
function assertApprovedReport(path: string, expected: Pick<Report, 'datasetVersion' | 'manifestHash' | 'writePlanHash' | 'setIds' | 'expectedCards' | 'plannedDatabaseWrites'>): void {
  const report = JSON.parse(readFileSync(path, 'utf8')) as Report;
  const withoutHash = { schemaVersion: report.schemaVersion, phase: report.phase, mode: report.mode, datasetVersion: report.datasetVersion, manifestHash: report.manifestHash, writePlanHash: report.writePlanHash, setIds: report.setIds, expectedCards: report.expectedCards, plannedDatabaseWrites: report.plannedDatabaseWrites, databaseWritesTotal: report.databaseWritesTotal, status: report.status, errors: report.errors };
  if (report.mode !== 'dry-run' || report.status !== 'PASS' || report.databaseWritesTotal !== 0 || report.reportHash !== hash(withoutHash) || canonical(expected) !== canonical({ datasetVersion: report.datasetVersion, manifestHash: report.manifestHash, writePlanHash: report.writePlanHash, setIds: report.setIds, expectedCards: report.expectedCards, plannedDatabaseWrites: report.plannedDatabaseWrites })) throw new Error('Goedgekeurd dry-runrapport hoort niet bij dit exacte writeplan.');
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (existsSync(options.reportPath)) throw new Error(`Rapport bestaat al: ${options.reportPath}`);
  validateLocalDatasetCheckout(options.inputRoot, PINNED_DATASET_VERSION);
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { datasetVersion?: string; sets?: ManifestSet[] };
  const scope = selectExternalReferenceScope(manifest); const plan = createWritePlan(options.inputRoot, scope);
  const identity = { datasetVersion: PINNED_DATASET_VERSION, manifestHash: hash(manifest), writePlanHash: hash(plan), setIds: scope.map((set) => set.setId), expectedCards: plan.length, plannedDatabaseWrites: plan.length * 2 };
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; const errors: string[] = []; let writes = 0;
  try {
    if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken.');
    const client = createClient(url, key);
    if (options.mode === 'write') assertApprovedReport(resolve(options.approvedReport!), identity);
    await readExactState(client, scope, plan, options.mode === 'idempotency');
    if (options.mode === 'write') for (const part of chunks(plan)) {
      const { data, error } = await client.rpc('phase_7b_insert_catalog_card_chunk_external_set_reference', { p_rows: part });
      const result = Array.isArray(data) ? data[0] as { cards_inserted?: number; references_inserted?: number } : undefined;
      if (error || !result || result.cards_inserted !== part.length || result.references_inserted !== part.length) throw new Error(`Transactionele chunkwrite mislukt: ${error?.message ?? 'ongeldige response'}`);
      writes += result.cards_inserted + result.references_inserted;
    }
    if (options.mode !== 'dry-run') await readExactState(client, scope, plan, true);
    if (options.mode === 'idempotency') writes = 0;
  } catch (error) { errors.push(error instanceof Error ? error.message : 'Onbekende fout.'); }
  const report = writeReport(options.reportPath, { schemaVersion: 1, phase: 'Phase 7B safe six external sets', mode: options.mode, ...identity, databaseWritesTotal: writes, status: errors.length === 0 ? 'PASS' : 'FAIL', errors });
  console.log(`Phase 7B safe six external sets ${report.mode}: ${report.status}; cards=${report.expectedCards}; databaseWritesTotal=${report.databaseWritesTotal}; reportHash=${report.reportHash}`);
  if (report.status === 'FAIL') process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : 'Phase 7B runner failed.'); process.exitCode = 1; });
