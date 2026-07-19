import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { PHASE, assertDatasetProfile, checkpointIdentity, createCanonicalBatches, parseArgs, preflightDataset, selectBatch, validateBatchLists, validateCheckpoint } from '../../scripts/catalog/rebaseline-read-only.ts';
import { reportHash } from '../../scripts/catalog/setmapping-validation.ts';

const dataset = 'C:\\Users\\Freru\\AppData\\Local\\Temp\\pokemon-tcg-data';
const manifest = { datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion: '0af6250a22495e4a3e9f60ff45fc3fedc2e0563d', sets: Array.from({ length: 173 }, (_, index) => ({ setId: `set${String(index + 1).padStart(3, '0')}`, expectedCards: 1 })) };

test('read-only runner rejects every write-shaped option', () => {
  for (const option of ['--write', '--insert', '--update', '--upsert', '--delete', '--rpc', '--migration']) assert.throws(() => parseArgs(['--dataset', dataset, '--report', 'report.json', option]), /strikt read-only/i);
});

test('initial Phase-A analysis runs without an approved report or batch', () => {
  assert.throws(() => parseArgs([]), /--dataset en --report zijn verplicht/);
  assert.equal(parseArgs(['--help']).help, true);
  const initial = parseArgs(['--dataset', dataset, '--report', 'phase-a.json', '--checkpoint', 'phase-a.checkpoint.json']);
  assert.equal(initial.mode, 'initial-phase-a');
  assert.equal('approvedReport' in initial, false);
});

test('approved batch analysis requires approved report, batch and writeplan', () => {
  assert.throws(() => parseArgs(['--dataset', dataset, '--report', 'batch.json', '--batch', 'batch-1', '--write-plan', 'plan.json']), /--batch vereist --approved-report/);
  assert.throws(() => parseArgs(['--dataset', dataset, '--report', 'batch.json', '--approved-report', 'approved.json', '--write-plan', 'plan.json']), /--approved-report vereist --batch/);
  assert.throws(() => parseArgs(['--dataset', dataset, '--approved-report', 'approved.json', '--batch', 'batch-1', '--report', 'report.json']), /--write-plan is verplicht/);
  assert.throws(() => parseArgs(['--dataset', dataset, '--approved-report', 'approved.json', '--batch', 'batch-1', '--report', 'report.json', '--write-plan', 'plan.json', '--resume']), /--resume vereist/);
  assert.throws(() => parseArgs(['--dataset', dataset, '--approved-report', 'approved.json', '--batch', 'other', '--report', 'report.json', '--write-plan', 'plan.json']), /batch-1/);
});

test('initial Phase-A generation creates a complete canonical batchestructure for 38 or 39 report-owned sets', () => {
  for (const count of [38, 39]) {
    const importReadySets = Array.from({ length: count }, (_, index) => `set${index + 1}`);
    const batches = createCanonicalBatches(importReadySets);
    const config = { officialImportReadySetIds: importReadySets, expectedImportReadySetCount: importReadySets.length, batches: Object.fromEntries(batches.map((batch) => [batch.name, batch.setIds])) as Record<'batch-1' | 'batch-2' | 'batch-3', string[]> };
    assert.doesNotThrow(() => validateBatchLists(config));
    assert.deepEqual(batches.flatMap((batch) => batch.setIds), importReadySets);
  }
});

test('dataset profile enforces the pinned complete dataset', () => {
  assert.doesNotThrow(() => assertDatasetProfile({ setsIndexed: 173, setsValid: 173, receivedCardsTotal: 20324 }));
  assert.throws(() => assertDatasetProfile({ setsIndexed: 172, setsValid: 173, receivedCardsTotal: 20324 }), /Datasetprofiel wijkt af/);
});

test('batch lists are validated from the approved report and fail closed on count mismatch', () => {
  const config = { officialImportReadySetIds: ['a', 'b', 'c', 'd'], expectedImportReadySetCount: 4, batches: { 'batch-1': ['a'], 'batch-2': ['b'], 'batch-3': ['c', 'd'] } } as const;
  assert.doesNotThrow(() => validateBatchLists(config));
  assert.throws(() => validateBatchLists({ ...config, expectedImportReadySetCount: 5 }), /bevat 4 sets; verwacht 5/);
});

test('pinned local dataset preflight validates the restored checkout when available', { skip: !existsSync(dataset) }, () => {
  const result = preflightDataset(dataset);
  assert.equal(result.manifest.datasetVersion, '0af6250a22495e4a3e9f60ff45fc3fedc2e0563d');
  assert.equal(result.manifest.sets.length, 173);
  assert.equal(result.manifest.sets.reduce((sum, set) => sum + set.expectedCards, 0), 20324);
});

test('checkpoint creation and validation cover the selected batch', () => {
  const batchManifest = { ...manifest, sets: ['a'].map((setId) => ({ setId, expectedCards: 1 })) };
  const checkpoint = checkpointIdentity(batchManifest, 'a'.repeat(64), '2026-07-19T00:00:00.000Z');
  assert.equal(checkpoint.sets.length, 1);
  assert.doesNotThrow(() => validateCheckpoint(checkpoint, batchManifest, 'a'.repeat(64)));
  const corrupt = structuredClone(checkpoint) as typeof checkpoint;
  corrupt.sets[0] = { setId: corrupt.sets[0].setId, status: 'completed' };
  assert.throws(() => validateCheckpoint(corrupt, batchManifest, 'a'.repeat(64)), /volledig resultaat/);
});

test('checkpoint rejects a dataset or manifest identity mismatch', () => {
  const checkpoint = checkpointIdentity(manifest, 'a'.repeat(64), '2026-07-19T00:00:00.000Z');
  assert.throws(() => validateCheckpoint(checkpoint, { ...manifest, datasetVersion: '1'.repeat(40) }, 'a'.repeat(64)), /identiteit/);
  assert.throws(() => validateCheckpoint({ ...checkpoint, manifestHash: 'b'.repeat(64) }, manifest, 'a'.repeat(64)), /identiteit/);
});

test('report hash is stable through JSON roundtrip', () => {
  const report = { databaseWritesTotal: 0, expectedCardsTotal: 20324, sets: [{ setId: 'sv9', reasonCodes: ['card_identity_conflict'] }] };
  assert.equal(reportHash(report), reportHash(JSON.parse(JSON.stringify(report))));
  assert.equal(reportHash(report), reportHash({ ...report, reportHash: 'not-part-of-input' }));
  assert.equal(PHASE, 'Phase 7B-2F9E-B');
});
