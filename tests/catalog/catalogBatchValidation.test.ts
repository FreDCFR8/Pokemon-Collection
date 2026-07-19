import test from 'node:test';
import assert from 'node:assert/strict';
import { batchSetConfigurationFromReport, classifyDynamicPrecheck, expectedPostWriteCounts, PHASE_A_BATCH_STRUCTURE_ERROR, validateImportReadyBatchConfiguration } from '../../scripts/catalog/catalog-batch-validation.ts';

const official = ['a', 'b', 'c', 'd'];
test('official import-ready list reports 38 versus 39 as a configuration error', () => {
  assert.throws(() => validateImportReadyBatchConfiguration({ officialImportReadySetIds: Array.from({ length: 38 }, (_, i) => `s${i}`), expectedImportReadySetCount: 39, batches: [] }), /bevat 38 sets; verwacht 39/);
});

test('batch validation rejects duplicate and missing set IDs', () => {
  assert.throws(() => validateImportReadyBatchConfiguration({ officialImportReadySetIds: official, expectedImportReadySetCount: 4, batches: [{ name: 'batch-1', setIds: ['a', 'a'] }, { name: 'batch-2', setIds: ['b'] }, { name: 'batch-3', setIds: [] }] }), /dubbele set-ID/);
  assert.throws(() => validateImportReadyBatchConfiguration({ officialImportReadySetIds: official, expectedImportReadySetCount: 4, batches: [{ name: 'batch-1', setIds: ['a', 'b'] }, { name: 'batch-2', setIds: ['c'] }, { name: 'batch-3', setIds: [] }] }), /ontbrekend=d/);
});

test('canonical report accepts either 38 or 39 sets without hardcoding the count', () => {
  for (const count of [38, 39]) {
    const ids = Array.from({ length: count }, (_, i) => `s${i}`);
    const report = { importReadySets: ids, expectedImportReadySetCount: count, batches: [{ name: 'batch-1', setIds: ids.slice(0, 13) }, { name: 'batch-2', setIds: ids.slice(13, 26) }, { name: 'batch-3', setIds: ids.slice(26) }] };
    const config = batchSetConfigurationFromReport(report);
    validateImportReadyBatchConfiguration(config);
  }
});

test('old report without batches fails closed with an actionable Phase-A message', () => {
  assert.throws(() => batchSetConfigurationFromReport({ importReadySets: ['a'], expectedImportReadySetCount: 1 }), { message: PHASE_A_BATCH_STRUCTURE_ERROR });
});

test('canonical validation rejects unexpected, blocked and manual-review sets', () => {
  const base = { importReadySets: ['a', 'b', 'c'], expectedImportReadySetCount: 3 };
  assert.throws(() => validateImportReadyBatchConfiguration(batchSetConfigurationFromReport({ ...base, batches: [{ name: 'batch-1', setIds: ['a', 'x'] }, { name: 'batch-2', setIds: ['b'] }, { name: 'batch-3', setIds: ['c'] }] })), /onverwacht=x/);
  assert.throws(() => validateImportReadyBatchConfiguration({ officialImportReadySetIds: ['a', 'b', 'c'], expectedImportReadySetCount: 3, excludedSetIds: ['b'], batches: [{ name: 'batch-1', setIds: ['a'] }, { name: 'batch-2', setIds: ['b'] }, { name: 'batch-3', setIds: ['c'] }] }), /BLOCKED/);
  assert.throws(() => validateImportReadyBatchConfiguration(batchSetConfigurationFromReport({ ...base, needsManualReviewSets: ['c'], batches: [{ name: 'batch-1', setIds: ['a'] }, { name: 'batch-2', setIds: ['b'] }, { name: 'batch-3', setIds: ['c'] }] })), /NEEDS_MANUAL_REVIEW/);
});

test('dynamic postcounts work for Batch 1 and a fictitious Batch 2', () => {
  const initial = { cards_catalog: 10, card_external_references: 9, collection_cards: 2, sets_catalog: 3, set_external_references: 1 };
  const batch1 = expectedPostWriteCounts(initial, 5, 4);
  const batch2 = expectedPostWriteCounts(initial, 2, 7);
  assert.deepEqual(batch1, { ...initial, cards_catalog: 15, card_external_references: 13 });
  assert.deepEqual(batch2, { ...initial, cards_catalog: 12, card_external_references: 16 });
  assert.equal(classifyDynamicPrecheck(batch1, initial, batch1), 'alreadyApplied');
  assert.equal(classifyDynamicPrecheck({ ...initial, cards_catalog: 12 }, initial, batch1), 'partial');
  assert.throws(() => classifyDynamicPrecheck({ ...batch1, collection_cards: 3 }, initial, batch1), /buiten/);
});
