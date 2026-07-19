import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveImportLifecycle, IMPORT_LIFECYCLE_STATES } from '../../scripts/catalog/import-lifecycle.ts';

test('import lifecycle distinguishes pre-write and post-write failures', () => {
  assert.deepEqual(IMPORT_LIFECYCLE_STATES, ['NOT_STARTED', 'WRITE_IN_PROGRESS', 'WRITE_COMPLETE', 'RECONCILIATION_COMPLETE', 'FAILED_BEFORE_WRITE', 'FAILED_AFTER_WRITE']);
  assert.equal(deriveImportLifecycle({ writeStarted: false, writeCompleted: false, reconciliationCompleted: false, actualWrites: 0 }), 'NOT_STARTED');
  assert.equal(deriveImportLifecycle({ writeStarted: true, writeCompleted: false, reconciliationCompleted: false, actualWrites: 0 }), 'FAILED_BEFORE_WRITE');
  assert.equal(deriveImportLifecycle({ writeStarted: true, writeCompleted: true, reconciliationCompleted: false, actualWrites: 3616 }), 'FAILED_AFTER_WRITE');
  assert.equal(deriveImportLifecycle({ writeStarted: true, writeCompleted: true, reconciliationCompleted: true, actualWrites: 0 }), 'RECONCILIATION_COMPLETE');
});
