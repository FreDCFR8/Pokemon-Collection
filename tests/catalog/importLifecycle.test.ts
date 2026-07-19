import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveImportLifecycle, IMPORT_LIFECYCLE_STATES } from '../../scripts/catalog/import-lifecycle.ts';
import { BATCH_1_SET_IDS, BATCH_2_SET_IDS, BATCH_3_SET_IDS, exactBatchSetList } from '../../scripts/catalog/import-batch-args.ts';

test('import lifecycle distinguishes pre-write and post-write failures', () => {
  assert.deepEqual(IMPORT_LIFECYCLE_STATES, ['NOT_STARTED', 'WRITE_IN_PROGRESS', 'WRITE_COMPLETE', 'RECONCILIATION_COMPLETE', 'FAILED_BEFORE_WRITE', 'FAILED_AFTER_WRITE']);
  assert.equal(deriveImportLifecycle({ writeStarted: false, writeCompleted: false, reconciliationCompleted: false, actualWrites: 0 }), 'NOT_STARTED');
  assert.equal(deriveImportLifecycle({ writeStarted: true, writeCompleted: false, reconciliationCompleted: false, actualWrites: 0 }), 'FAILED_BEFORE_WRITE');
  assert.equal(deriveImportLifecycle({ writeStarted: true, writeCompleted: true, reconciliationCompleted: false, actualWrites: 3616 }), 'FAILED_AFTER_WRITE');
  assert.equal(deriveImportLifecycle({ writeStarted: true, writeCompleted: true, reconciliationCompleted: true, actualWrites: 0 }), 'RECONCILIATION_COMPLETE');
});

test('the three approved batch lists are exact and ordered', () => {
  assert.equal(BATCH_1_SET_IDS.length + BATCH_2_SET_IDS.length + BATCH_3_SET_IDS.length, 38);
  assert.equal(exactBatchSetList(BATCH_1_SET_IDS, 1), true);
  assert.equal(exactBatchSetList(BATCH_2_SET_IDS, 2), true);
  assert.equal(exactBatchSetList(BATCH_3_SET_IDS, 3), true);
  assert.equal(exactBatchSetList([...BATCH_2_SET_IDS].reverse(), 2), false);
});
