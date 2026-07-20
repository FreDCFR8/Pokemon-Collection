import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { deterministicCatalogCardUuid } from './import-set.ts';
import { loadPokemonTcgDataJson } from './local-json.ts';
import { validateLocalDatasetCheckout, PINNED_DATASET_VERSION } from './local-checkout.ts';

const REVIEW_PATH = 'config/catalog/remaining-set-catalog-mapping-review.json';
const BLOCKED_SET_ID = 'svp';
const CHUNK_SIZE = 100;
const SOURCE = 'pokemon_tcg_api';

type Mode = 'dry-run' | 'write-approved' | 'idempotency';
type ScopeSet = { setId: string; name: string; series: string; expectedCards: number };
type Row = { id: string; external_id: string; pokemon: string; set_name: string; set_code: string; number: string; rarity: string | null; image_small: string | null; image_large: string | null; card_details: Record<string, unknown> };
type Report = { schemaVersion: 1; mode: Mode; datasetVersion: string; scopeHash: string; sets: string[]; expectedCards: number; plannedDatabaseWrites: number; databaseWritesTotal: number; status: 'PASS' | 'FAIL'; errors: string[] };

function canonicalHash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function chunks<T>(value: T[]): T[][] { const output: T[][] = []; for (let i = 0; i < value.length; i += CHUNK_SIZE) output.push(value.slice(i, i + CHUNK_SIZE)); return output; }
function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) { const key = argv[i]; if (!['--mode', '--input-root', '--report', '--approved-report', '--confirm-write'].includes(key)) throw new Error(`Onbekend argument: ${key}`); const value = argv[++i]; if (!value || value.startsWith('--')) throw new Error(`Ontbrekende waarde voor ${key}.`); values.set(key, value); }
  const mode = values.get('--mode') as Mode | undefined;
  if (!mode || !['dry-run', 'write-approved', 'idempotency'].includes(mode)) throw new Error('Gebruik --mode dry-run, write-approved of idempotency.');
  const inputRoot = values.get('--input-root'); const report = values.get('--report');
  if (!inputRoot || !report) throw new Error('--input-root en --report zijn vereist.');
  if (mode === 'write-approved' && (values.get('--confirm-write') !== 'phase-7b-safe-116' || !values.get('--approved-report'))) throw new Error('Write vereist --confirm-write phase-7b-safe-116 en --approved-report.');
  return { mode, inputRoot: resolve(inputRoot), report: resolve(report), approvedReport: values.get('--approved-report') };
}
function scope(): ScopeSet[] {
  const review = JSON.parse(readFileSync(REVIEW_PATH, 'utf8')) as { createdFrom?: { datasetVersion?: string }; proposedMappings?: Array<{ setId: string; name: string; series: string; expectedCards: number }> };
  if (review.createdFrom?.datasetVersion !== PINNED_DATASET_VERSION || !Array.isArray(review.proposedMappings) || review.proposedMappings.length !== 117) throw new Error('Phase 7B reviewidentiteit wijkt af.');
  const selected = review.proposedMappings.filter((set) => set.setId !== BLOCKED_SET_ID).map(({ setId, name, series, expectedCards }) => ({ setId, name, series, expectedCards }));
  if (selected.length !== 116 || selected.some((set) => !set.setId || !set.name || !set.series || !Number.isInteger(set.expectedCards))) throw new Error('Phase 7B veilige 116-setscope is ongeldig.');
  return selected;
}
async function readRows(root: string, selected: ScopeSet[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (const set of selected) {
    const loaded = loadPokemonTcgDataJson(join(root, 'cards', 'en', `${set.setId}.json`), set.setId);
    if (loaded.cards.length !== set.expectedCards) throw new Error(`${set.setId}: expectedCards wijkt af van de gepinde lokale dataset.`);
    for (const card of loaded.cards) {
      if (!card.id || !card.name || !card.number) throw new Error(`${set.setId}: kaartmetadata ontbreekt.`);
      rows.push({ id: deterministicCatalogCardUuid(SOURCE, card.id), external_id: card.id, pokemon: card.name, set_name: set.name, set_code: set.setId, number: card.number, rarity: card.rarity ?? null, image_small: card.images?.small ?? null, image_large: card.images?.large ?? null, card_details: card.details });
    }
  }
  if (rows.length !== 10703 || new Set(rows.map((row) => row.id)).size !== rows.length || new Set(rows.map((row) => row.external_id)).size !== rows.length) throw new Error('Phase 7B kaartidentiteit is niet exact 10.703 uniek.');
  return rows;
}
async function assertInitialState(client: ReturnType<typeof createClient>, selected: ScopeSet[], rows: Row[], allowExisting: boolean) {
  const { data: sets, error: setError } = await client.from('sets_catalog').select('id,set_code,name,series,source,source_id').in('set_code', selected.map((set) => set.setId));
  if (setError || !sets || sets.length !== selected.length) throw new Error('Exacte setcatalogusprecheck mislukt.');
  for (const set of selected) if (!sets.some((row) => row.set_code === set.setId && row.name === set.name && row.series === set.series && row.source === SOURCE && row.source_id === set.setId)) throw new Error(`${set.setId}: setcatalogusmetadata wijkt af.`);
  for (const part of chunks(rows)) {
    const ids = part.map((row) => row.external_id);
    const { data: existing, error } = await client.from('card_external_references').select('external_id,card_catalog_id').eq('source', SOURCE).in('external_id', ids);
    if (error) throw new Error('Reference-precheck mislukt.');
    if (!allowExisting && (existing?.length ?? 0) !== 0) throw new Error('Phase 7B write geblokkeerd: bestaande kaartreference gevonden.');
    if (allowExisting && (existing?.length ?? 0) !== part.length) throw new Error('Idempotency mislukt: ontbrekende kaartreference gevonden.');
  }
}
function readApproved(path: string, expected: Omit<Report, 'mode' | 'databaseWritesTotal' | 'status' | 'errors'>) {
  const report = JSON.parse(readFileSync(path, 'utf8')) as Report;
  if (report.mode !== 'dry-run' || report.status !== 'PASS' || report.databaseWritesTotal !== 0 || report.scopeHash !== expected.scopeHash || JSON.stringify(report.sets) !== JSON.stringify(expected.sets) || report.expectedCards !== expected.expectedCards || report.plannedDatabaseWrites !== expected.plannedDatabaseWrites) throw new Error('Goedgekeurd dry-runrapport heeft geen identieke veilige 116-setidentiteit.');
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (existsSync(options.report)) throw new Error(`Rapport bestaat al: ${options.report}`);
  validateLocalDatasetCheckout(options.inputRoot, PINNED_DATASET_VERSION);
  const selected = scope(); const rows = await readRows(options.inputRoot, selected);
  const identity = { datasetVersion: PINNED_DATASET_VERSION, sets: selected.map((set) => set.setId), expectedCards: rows.length, plannedDatabaseWrites: rows.length * 2 };
  const scopeHash = canonicalHash(identity);
  const reportBase = { schemaVersion: 1 as const, mode: options.mode, datasetVersion: PINNED_DATASET_VERSION, scopeHash, sets: identity.sets, expectedCards: rows.length, plannedDatabaseWrites: rows.length * 2 };
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  const client = createClient(url, key); let writes = 0; const errors: string[] = [];
  try {
    if (options.mode === 'write-approved') readApproved(options.approvedReport!, identity);
    await assertInitialState(client, selected, rows, options.mode === 'idempotency');
    if (options.mode === 'write-approved') for (const part of chunks(rows)) {
      const { data, error } = await client.rpc('phase_7b_import_catalog_card_chunk', { p_rows: part });
      if (error || !Array.isArray(data) || data.length !== 1) throw new Error(`Transactionele chunkwrite mislukt: ${error?.message ?? 'ongeldige RPC-response'}`);
      const result = data[0] as { cards_inserted?: number; references_inserted?: number };
      if (result.cards_inserted !== result.references_inserted || !Number.isInteger(result.cards_inserted)) throw new Error('Chunkresponse heeft geen gekoppelde card/reference writecount.');
      writes += result.cards_inserted! + result.references_inserted!;
    }
    if (options.mode === 'idempotency') writes = 0;
  } catch (error) { errors.push(error instanceof Error ? error.message : 'Onbekende fout.'); }
  const report: Report = { ...reportBase, databaseWritesTotal: writes, status: errors.length === 0 ? 'PASS' : 'FAIL', errors };
  writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Phase 7B safe-116 ${options.mode}: ${report.status}; cards=${rows.length}; databaseWritesTotal=${writes}; report=${options.report}`);
  process.exitCode = report.status === 'PASS' ? 0 : 1;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Phase 7B safe-116 runner failed.'); process.exitCode = 1; });
