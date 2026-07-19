import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { reportHash, stableJson, validateSetMappingCandidate } from '../../scripts/catalog/setmapping-validation.ts';
import { runValidation } from '../../scripts/catalog/validate-set-mappings.ts';

function pureInput(overrides: Partial<Parameters<typeof validateSetMappingCandidate>[0]> = {}) {
  return { externalSetId: 'sv10', externalSetName: 'Destined Rivals', externalSeries: 'Scarlet & Violet', proposedSetCode: 'sv10', candidateCount: 1, catalogSet: { set_code: 'sv10', name: 'Destined Rivals', series: 'Scarlet & Violet', source: 'pokemon_tcg_api', source_id: 'sv10' }, catalogSourceIdentityMatchCount: 1, incomingCardCount: 10, uniqueIncomingCardNumbers: 10, overlappingUniqueCardNumbers: 10, existingExternalCardReferences: 10, conflictingExternalCardReferences: 0, ...overrides };
}

test('manifestnaam en manifestserie blijven de externe waarheid', () => {
  const result = validateSetMappingCandidate(pureInput({ externalSetName: 'Manifest Name', externalSeries: 'Manifest Series', catalogSet: { set_code: 'sv10', name: 'Manifest Name', series: 'Manifest Series', source: 'pokemon_tcg_api', source_id: 'sv10' }, candidateSource: 'wrong', candidateSourceId: 'wrong' }));
  assert.equal(result.classification, 'safe_for_mapping_review');
  assert.ok(result.reasonCodes.includes('set_name_match'));
  assert.ok(result.reasonCodes.includes('set_series_match'));
});

test('serieconflict kan niet worden verborgen door kandidaatdata', () => {
  const result = validateSetMappingCandidate(pureInput({ externalSeries: 'Manifest Series', catalogSet: { set_code: 'sv10', name: 'Destined Rivals', series: 'Wrong Series', source: 'pokemon_tcg_api', source_id: 'sv10' }, candidateSource: 'Wrong', candidateSourceId: 'wrong' }));
  assert.equal(result.classification, 'blocked');
  assert.ok(result.reasonCodes.includes('set_series_conflict'));
});

test('bronrapport- en expected/received-mismatches blokkeren', () => {
  const result = validateSetMappingCandidate(pureInput({ preflightReasonCodes: ['source_report_set_name_mismatch', 'source_report_expected_cards_mismatch', 'received_cards_mismatch'] }));
  assert.equal(result.classification, 'blocked');
  assert.ok(result.reasonCodes.includes('received_cards_mismatch'));
});

test('bron-ID-conflicten en meervoudige bronmatches blokkeren', () => {
  const result = validateSetMappingCandidate(pureInput({ catalogSourceIdentityMatchCount: 2, catalogSourceIdentityOtherSetCount: 1, proposedSetHasConflictingSourceIdentity: true, missingExternalProvenance: true }));
  assert.equal(result.classification, 'blocked');
  assert.ok(result.reasonCodes.includes('external_source_identity_other_set'));
  assert.ok(result.reasonCodes.includes('multiple_source_identity_matches'));
  assert.ok(result.reasonCodes.includes('missing_external_provenance'));
});

test('kaartreferentieconflicten hebben afzonderlijke codes en blokkeren', () => {
  for (const reason of ['card_reference_wrong_set', 'card_reference_wrong_number', 'dangling_card_reference', 'multiple_card_references'] as const) {
    const result = validateSetMappingCandidate(pureInput({ preflightReasonCodes: [reason], conflictingExternalCardReferences: 1 }));
    assert.equal(result.classification, 'blocked');
    assert.ok(result.reasonCodes.includes('card_reference_conflict'));
    assert.ok(result.reasonCodes.includes(reason));
  }
});

test('onvoldoende kaartnummeroverlap blokkeert', () => {
  const result = validateSetMappingCandidate(pureInput({ uniqueIncomingCardNumbers: 10, overlappingUniqueCardNumbers: 2 }));
  assert.equal(result.classification, 'blocked');
  assert.ok(result.reasonCodes.includes('card_number_coverage_partial'));
});

class ReadOnlyQuery {
  private readonly filters = new Map<string, unknown>();
  private readonly lists = new Map<string, unknown[]>();
  private readonly table: string;
  private readonly resolver: (table: string, filters: Map<string, unknown>, lists: Map<string, unknown[]>) => unknown[];
  constructor(table: string, resolver: (table: string, filters: Map<string, unknown>, lists: Map<string, unknown[]>) => unknown[]) { this.table = table; this.resolver = resolver; }
  select(): this { return this; }
  eq(column: string, value: unknown): this { this.filters.set(column, value); return this; }
  in(column: string, values: unknown[]): this { this.lists.set(column, values); return this; }
  then(resolve: (value: { data: unknown[]; error: null }) => unknown, reject?: (reason: unknown) => unknown): Promise<unknown> { try { return Promise.resolve(resolve({ data: this.resolver(this.table, this.filters, this.lists), error: null })); } catch (error) { return reject ? Promise.resolve(reject(error)) : Promise.reject(error); } }
}

function fixture(overrides: { name?: string; expected?: number; received?: number; foreignOnly?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'setmapping-')); mkdirSync(join(root, 'cards', 'en'), { recursive: true });
  const card = { id: 'sv10-1', name: 'Test Card', number: '1', images: {} };
  writeFileSync(join(root, 'cards', 'en', 'custom.json'), JSON.stringify([card]));
  const manifestPath = join(root, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify({ source: 'pokemon_tcg_data', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion: '0af6250a22495e4a3e9f60ff45fc3fedc2e0563d', sets: [{ setId: 'sv10', name: 'Manifest Name', series: 'Manifest Series', jsonPath: 'cards/en/custom.json', expectedCards: 1, enabled: true }] }));
  const sourceReportPath = join(root, 'source-report.json');
  writeFileSync(sourceReportPath, JSON.stringify({ source: 'pokemon_tcg_data', results: [{ setId: 'sv10', expectedCards: overrides.expected ?? 1, diagnostic: { setName: overrides.name ?? 'Manifest Name', receivedCards: overrides.received ?? 1, setMappingStatus: 'exact_candidate', setMapping: { status: 'exact_candidate', candidates: [{ set_code: 'sv10', name: 'Wrong Candidate Name', series: 'Wrong Candidate Series', source: 'wrong', source_id: 'wrong' }], evidence: [] } } }] }));
  const operations: string[] = [];
  const rows = (table: string, filters: Map<string, unknown>, lists: Map<string, unknown[]>): unknown[] => {
    if (table === 'sets_catalog') {
      if (filters.get('source_id') === 'sv10') return [{ set_code: 'sv10', name: 'Manifest Name', series: 'Manifest Series', source: 'pokemon_tcg_api', source_id: 'sv10' }];
      return [{ set_code: 'sv10', name: 'Manifest Name', series: 'Manifest Series', source: 'pokemon_tcg_api', source_id: 'sv10' }];
    }
    if (table === 'cards_catalog') return lists.has('id') ? [{ id: 'card-1', set_code: 'sv10', number: '1' }] : [{ id: 'card-1', set_code: 'sv10', number: '1' }];
    if (table === 'card_external_references') return overrides.foreignOnly ? [] : [{ id: 'ref-1', source: 'pokemon_tcg_api', external_id: 'sv10-1', card_catalog_id: 'card-1' }];
    return [];
  };
  const supabase = { from(table: string) { operations.push(`select:${table}`); return new ReadOnlyQuery(table, rows); }, insert() { operations.push('insert'); throw new Error('insert must never be called'); }, update() { operations.push('update'); throw new Error('update must never be called'); }, upsert() { operations.push('upsert'); throw new Error('upsert must never be called'); }, delete() { operations.push('delete'); throw new Error('delete must never be called'); }, rpc() { operations.push('rpc'); throw new Error('mutating rpc must never be called'); } } as unknown as import('@supabase/supabase-js').SupabaseClient;
  return { root, manifestPath, sourceReportPath, supabase, operations };
}

test('runValidation gebruikt exact manifest.jsonPath en alleen read-methoden', async () => {
  const item = fixture();
  const report = await runValidation({ manifestPath: item.manifestPath, inputRoot: item.root, sourceReportPath: item.sourceReportPath, reportPath: 'reports/out.json', supabase: item.supabase, expectedCandidateCount: 1 });
  assert.equal(report.candidates[0].manifestJsonPath, 'cards/en/custom.json');
  assert.equal(report.candidates[0].manifestSetName, 'Manifest Name');
  assert.equal(report.candidates[0].manifestSeries, 'Manifest Series');
  assert.equal(report.databaseWritesTotal, 0);
  assert.equal(item.operations.some((operation) => ['insert', 'update', 'upsert', 'delete', 'rpc'].includes(operation)), false);
});

test('source report mismatch wordt inhoudelijk geblokkeerd', async () => {
  const item = fixture({ name: 'Wrong Report Name', expected: 2, received: 2 });
  const report = await runValidation({ manifestPath: item.manifestPath, inputRoot: item.root, sourceReportPath: item.sourceReportPath, reportPath: 'reports/out.json', supabase: item.supabase, expectedCandidateCount: 1 });
  const reasons = report.candidates[0].validation.reasonCodes;
  assert.ok(reasons.includes('source_report_set_name_mismatch'));
  assert.ok(reasons.includes('source_report_expected_cards_mismatch'));
  assert.ok(reasons.includes('received_cards_mismatch'));
  assert.equal(report.candidates[0].validation.classification, 'blocked');
});

test('bronrapport-set-ID buiten het manifest wordt specifiek geblokkeerd', async () => {
  const item = fixture();
  writeFileSync(item.sourceReportPath, readFileSync(item.sourceReportPath, 'utf8').replaceAll('sv10', 'sv99'));
  const report = await runValidation({ manifestPath: item.manifestPath, inputRoot: item.root, sourceReportPath: item.sourceReportPath, reportPath: 'reports/out.json', supabase: item.supabase, expectedCandidateCount: 1 });
  assert.ok(report.candidates[0].validation.reasonCodes.includes('source_report_set_id_mismatch'));
  assert.equal(report.candidates[0].validation.classification, 'blocked');
});

test('referentie van andere bron wordt niet als conflict geteld', async () => {
  const item = fixture({ foreignOnly: true });
  const report = await runValidation({ manifestPath: item.manifestPath, inputRoot: item.root, sourceReportPath: item.sourceReportPath, reportPath: 'reports/out.json', supabase: item.supabase, expectedCandidateCount: 1 });
  assert.equal(report.candidates[0].existingExternalCardReferences, 0);
  assert.equal(report.candidates[0].conflictingExternalCardReferences, 0);
  assert.equal(report.candidates[0].validation.reasonCodes.includes('card_reference_conflict'), false);
});

test('gelijke inhoud vanuit verschillende tijdelijke directories heeft dezelfde rapporthash', async () => {
  const first = fixture(); const second = fixture();
  const a = await runValidation({ manifestPath: first.manifestPath, inputRoot: first.root, sourceReportPath: first.sourceReportPath, reportPath: 'reports/out.json', supabase: first.supabase, expectedCandidateCount: 1 });
  const b = await runValidation({ manifestPath: second.manifestPath, inputRoot: second.root, sourceReportPath: second.sourceReportPath, reportPath: 'reports/out.json', supabase: second.supabase, expectedCandidateCount: 1 });
  assert.equal(a.reportHash, b.reportHash);
});

test('serialisatie is deterministisch', () => {
  const value = { b: 2, a: [{ z: true, y: null }] };
  assert.equal(stableJson(value), '{"a":[{"y":null,"z":true}],"b":2}');
  assert.equal(reportHash(value), reportHash({ a: [{ y: null, z: true }], b: 2 }));
});
