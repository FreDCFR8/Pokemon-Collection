import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDynamicPrecheck, expectedPostWriteCounts, validateImportReadyBatchConfiguration } from '../../scripts/catalog/catalog-batch-validation.ts';

const official = ['a', 'b', 'c', 'd'];
test('official import-ready list reports 38 versus 39 as a configuration error', () => {
  assert.throws(() => validateImportReadyBatchConfiguration({ officialImportReadySetIds: Array.from({ length: 38 }, (_, i) => `s${i}`), expectedImportReadySetCount: 39, batches: [] }), /bevat 38 sets; verwacht 39/);
});

test('batch validation rejects duplicate and missing set IDs', () => {
  assert.throws(() => validateImportReadyBatchConfiguration({ officialImportReadySetIds: official, expectedImportReadySetCount: 4, batches: [{ name: 'batch-1', setIds: ['a', 'a'] }, { name: 'batch-2', setIds: ['b'] }] }), /dubbele set-ID/);
  assert.throws(() => validateImportReadyBatchConfiguration({ officialImportReadySetIds: official, expectedImportReadySetCount: 4, batches: [{ name: 'batch-1', setIds: ['a', 'b'] }, { name: 'batch-2', setIds: ['c'] }] }), /ontbrekend=d/);
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
