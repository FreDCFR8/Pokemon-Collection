import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { runSetMappings } from '../../scripts/catalog/apply-set-mappings.ts';
import { buildSetMappingPlan, normalizeLineEndings, parseSetMappingPlanText, type SetMappingPlan } from '../../scripts/catalog/set-mapping-plan.ts';
import { reportHash } from '../../scripts/catalog/setmapping-validation.ts';

const datasetVersion = '0af6250a22495e4a3e9f60ff45fc3fedc2e0563d';
const safeSetIds = ['sv10', ...Array.from({ length: 40 }, (_, index) => `set${String(index).padStart(2, '0')}`)];

function manifest(ids = safeSetIds): string { return `${JSON.stringify({ source: 'pokemon_tcg_data', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion, sets: ids.map((setId) => ({ setId, name: setId, series: 'Test', jsonPath: `${setId}.json`, expectedCards: 1, enabled: true })) }, null, 2)}\n`; }
function report(overrides: Record<string, unknown> = {}): string {
  const candidates = safeSetIds.map((setId, index) => ({ setId, validation: { classification: 'safe_for_mapping_review' }, mappingImplementationStatus: 'requires_set_external_references', candidate: { set_code: setId, source: index === 0 ? 'derived_from_existing_card_urls' : 'manual_review', source_id: null } }));
  candidates.push({ setId: 'zsv10pt5', validation: { classification: 'needs_manual_review' }, mappingImplementationStatus: 'requires_set_external_references', candidate: { set_code: 'zsv10pt5', source: 'manual_review', source_id: null } }, { setId: 'sv9', validation: { classification: 'blocked' }, mappingImplementationStatus: 'blocked_by_identity_conflict', candidate: { set_code: 'sv9', source: 'manual_review', source_id: null } }, { setId: 'swsh9', validation: { classification: 'blocked' }, mappingImplementationStatus: 'blocked_by_identity_conflict', candidate: { set_code: 'swsh9', source: 'manual_review', source_id: null } });
  const base = { schemaVersion: 2, phase: 'Phase 7B-2F9D-A', mode: 'read-only', source: 'pokemon_tcg_data', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion, sourceReportHash: 'a'.repeat(64), candidateCount: 44, status: 'PASS', databaseWritesTotal: 0, classifications: { safe_for_mapping_review: 41, needs_manual_review: 1, blocked: 2 }, operationalErrors: [], candidates, ...overrides } as Record<string, unknown>;
  return JSON.stringify({ ...base, reportHash: reportHash(base) });
}

test('legacy PR139 provenance still generates exactly 41 new pokemon_tcg_api mappings', () => {
  const plan = buildSetMappingPlan(report(), manifest());
  assert.equal(plan.mappingCount, 41); const legacy = plan.mappings.find((mapping) => mapping.setCode === 'sv10')!; assert.equal(legacy.source, 'pokemon_tcg_api'); assert.equal(legacy.externalId, 'sv10'); assert.equal(legacy.setCode, 'sv10');
  assert.equal(plan.manifestHash, createHash('sha256').update(normalizeLineEndings(manifest())).digest('hex')); assert.doesNotThrow(() => parseSetMappingPlanText(JSON.stringify(plan)));
});

test('LF en CRLF produceren dezelfde manifestHash en planHash', () => {
  const lf = manifest(); const crlf = lf.replace(/\n/g, '\r\n');
  const lfPlan = buildSetMappingPlan(report(), lf); const crlfPlan = buildSetMappingPlan(report(), crlf);
  assert.equal(lfPlan.manifestHash, crlfPlan.manifestHash); assert.equal(lfPlan.planHash, crlfPlan.planHash);
});

test('generator fails closed for missing manifest set, wrong reporthash, dataset version, counts, and excluded candidate', () => {
  assert.throws(() => buildSetMappingPlan(report(), manifest(safeSetIds.slice(0, -1))), /manifest/);
  const badHash = JSON.parse(report()); badHash.reportHash = 'b'.repeat(64); assert.throws(() => buildSetMappingPlan(JSON.stringify(badHash), manifest()), /rapporthash/);
  const badVersion = JSON.parse(report()); badVersion.datasetVersion = '1'.repeat(40); badVersion.reportHash = reportHash(Object.fromEntries(Object.entries(badVersion).filter(([key]) => key !== 'reportHash'))); assert.throws(() => buildSetMappingPlan(JSON.stringify(badVersion), manifest()), /datasetidentiteit/);
  const badCounts = JSON.parse(report()); badCounts.classifications.safe_for_mapping_review = 40; badCounts.reportHash = reportHash(Object.fromEntries(Object.entries(badCounts).filter(([key]) => key !== 'reportHash'))); assert.throws(() => buildSetMappingPlan(JSON.stringify(badCounts), manifest()), /classificatietellingen/);
  const excluded = JSON.parse(report()); excluded.candidates[0].setId = 'sv9'; excluded.candidates[0].candidate.set_code = 'sv9'; excluded.reportHash = reportHash(Object.fromEntries(Object.entries(excluded).filter(([key]) => key !== 'reportHash'))); assert.throws(() => buildSetMappingPlan(JSON.stringify(excluded), manifest([...safeSetIds, 'sv9'])), /Uitgesloten/);
});

function plan(): SetMappingPlan { return buildSetMappingPlan(report(), manifest()); }

class Query {
  private readonly table: string; private readonly database: Record<string, unknown[]>; private readonly operations: string[];
  private readonly filters = new Map<string, unknown>(); private readonly lists = new Map<string, unknown[]>;
  constructor(table: string, database: Record<string, unknown[]>, operations: string[]) { this.table = table; this.database = database; this.operations = operations; }
  select(): this { this.operations.push(`select:${this.table}`); return this; }
  eq(column: string, value: unknown): this { this.filters.set(column, value); return this; }
  in(column: string, values: unknown[]): this { this.lists.set(column, values); return this; }
  insert(rows: unknown[]): Promise<{ data: null; error: null }> { this.operations.push(`insert:${this.table}:${rows.length}`); this.database[this.table].push(...rows.map((row, index) => ({ id: `inserted-${this.database[this.table].length + index}`, ...(row as Record<string, unknown>) }))); return Promise.resolve({ data: null, error: null }); }
  then(resolve: (value: { data: unknown[]; count: number; error: null }) => unknown): Promise<unknown> { const data = (this.database[this.table] ?? []).filter((row) => [...this.filters.entries()].every(([key, value]) => (row as Record<string, unknown>)[key] === value) && [...this.lists.entries()].every(([key, values]) => values.includes((row as Record<string, unknown>)[key]))); return Promise.resolve(resolve({ data, count: data.length, error: null })); }
}

function database(current: SetMappingPlan, references: unknown[] = []): { database: Record<string, unknown[]>; operations: string[]; supabase: never } {
  const database: Record<string, unknown[]> = {
    sets_catalog: current.mappings.map((mapping, index) => ({ id: `id-${index}`, set_code: mapping.setCode, source: 'manual_review', source_id: null })),
    set_external_references: references,
    cards_catalog: [{ id: 'card-1' }], card_external_references: [{ id: 'card-ref-1' }], collection_cards: [{ id: 'collection-1' }],
  }; const operations: string[] = [];
  const supabase = { from(table: string) { return new Query(table, database, operations); } } as never;
  return { database, operations, supabase };
}

test('dry-run is idempotent, performs zero writes, and partially existing mappings plan only missing inserts', async () => {
  const current = plan(); const existing = current.mappings.slice(0, 1).map((mapping, index) => ({ id: `ref-${index}`, set_catalog_id: `id-${index}`, source: mapping.source, external_id: mapping.externalId }));
  const item = database(current, existing); const result = await runSetMappings({ plan: current, supabase: item.supabase });
  assert.equal(result.status, 'PASS'); assert.equal(result.existingIdentical, 1); assert.equal(result.plannedInserts, 40); assert.equal(result.databaseWrites, 0); assert.equal(item.operations.some((operation) => operation.startsWith('insert:')), false);
});

test('runner detects external-ID and internal-set conflict directions and multiple matches', async () => {
  const current = plan(); const refs = [
    { id: 'external-conflict', set_catalog_id: 'other-id', source: 'pokemon_tcg_api', external_id: 'sv10' },
    { id: 'internal-conflict', set_catalog_id: 'id-1', source: 'pokemon_tcg_api', external_id: 'other-id' },
    { id: 'multiple-a', set_catalog_id: 'id-2', source: 'pokemon_tcg_api', external_id: 'set01' },
    { id: 'multiple-b', set_catalog_id: 'id-2', source: 'pokemon_tcg_api', external_id: 'set01' },
  ]; const item = database(current, refs); item.database.sets_catalog.push({ id: 'other-id', set_code: 'other' });
  const result = await runSetMappings({ plan: current, supabase: item.supabase });
  assert.equal(result.status, 'FAIL'); assert.ok(result.conflicts.some((value) => value.startsWith('external_id_other_set:sv10'))); assert.ok(result.conflicts.some((value) => value.startsWith('internal_set_other_external_id:set01'))); assert.ok(result.conflicts.some((value) => value.startsWith('multiple_')));
});

test('write uses one bulk insert, exact hash, no update/upsert/delete, and postchecks protected tables', async () => {
  const current = plan(); const item = database(current); const rejected = await runSetMappings({ plan: current, supabase: item.supabase, write: true, confirmPlanHash: 'wrong' });
  assert.equal(rejected.status, 'FAIL'); assert.deepEqual(rejected.blockedItems, ['plan_hash_confirmation_required']);
  const accepted = await runSetMappings({ plan: current, supabase: item.supabase, write: true, confirmPlanHash: current.planHash });
  assert.equal(accepted.status, 'PASS'); assert.equal(accepted.databaseWrites, 41); assert.equal(item.operations.filter((operation) => operation.startsWith('insert:set_external_references:')).length, 1); assert.equal(item.operations.some((operation) => /update|upsert|delete/.test(operation)), false);
  const idempotent = await runSetMappings({ plan: current, supabase: item.supabase }); assert.equal(idempotent.status, 'PASS'); assert.equal(idempotent.plannedInserts, 0);
});

test('plan parser validates excluded entries, source identity, HTTPS URL, repository, SHA and planhash', () => {
  const current = plan();
  for (const mutate of [
    (value: SetMappingPlan) => { value.mappings[0].setCode = 'sv9'; },
    (value: SetMappingPlan) => { value.mappings[0].source = 'wrong' as never; },
    (value: SetMappingPlan) => { value.mappings[0].externalId = 'other'; },
    (value: SetMappingPlan) => { value.mappings[0].sourceUrl = 'http://bad.example'; },
    (value: SetMappingPlan) => { value.datasetVersion = 'bad'; },
  ]) { const value = JSON.parse(JSON.stringify(current)) as SetMappingPlan; mutate(value); assert.throws(() => parseSetMappingPlanText(JSON.stringify(value))); }
});

test('migration is fail-closed and has the required FK, constraints, index and RLS', () => {
  const migration = readFileSync(resolve('supabase/migrations/20260719130000_phase_7b_2f9d_b_set_external_references.sql'), 'utf8');
  assert.match(migration, /create table public\.set_external_references/); assert.doesNotMatch(migration, /create table if not exists/);
  assert.match(migration, /references public\.sets_catalog\(id\) on delete cascade/); assert.match(migration, /unique \(source, external_id\)/); assert.match(migration, /unique \(set_catalog_id, source\)/);
  assert.match(migration, /btrim\(source\) <> ''/); assert.match(migration, /btrim\(external_id\) <> ''/); assert.match(migration, /set_external_references_set_catalog_id_idx/); assert.match(migration, /enable row level security/); assert.match(migration, /for select\s+to authenticated/); assert.doesNotMatch(migration, /for (insert|update|delete)/i); assert.match(migration, /revoke all on table public\.set_external_references from public, anon, authenticated/);
});
