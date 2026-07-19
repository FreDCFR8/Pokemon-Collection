import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveImportLifecycle, ImportLifecycleTracker, IMPORT_LIFECYCLE_STATES } from '../../scripts/catalog/import-lifecycle.ts';

test('import lifecycle distinguishes pre-write and post-write failures', () => {
  assert.deepEqual(IMPORT_LIFECYCLE_STATES, ['NOT_STARTED', 'WRITE_IN_PROGRESS', 'WRITE_COMPLETE', 'RECONCILIATION_COMPLETE', 'FAILED_BEFORE_WRITE', 'FAILED_AFTER_WRITE']);
  assert.equal(deriveImportLifecycle({ writeStarted: false, writeCompleted: false, reconciliationCompleted: false, actualWrites: 0 }), 'NOT_STARTED');
  assert.equal(deriveImportLifecycle({ writeStarted: true, writeCompleted: false, reconciliationCompleted: false, actualWrites: 0 }), 'FAILED_BEFORE_WRITE');
  assert.equal(deriveImportLifecycle({ writeStarted: true, writeCompleted: true, reconciliationCompleted: false, actualWrites: 3616 }), 'FAILED_AFTER_WRITE');
  assert.equal(deriveImportLifecycle({ writeStarted: true, writeCompleted: true, reconciliationCompleted: true, actualWrites: 0 }), 'RECONCILIATION_COMPLETE');
});

test('lifecycle tracker reaches WRITE_IN_PROGRESS and WRITE_COMPLETE around a write subprocess', () => {
  const tracker = new ImportLifecycleTracker();
  assert.equal(tracker.state, 'NOT_STARTED');
  assert.equal(tracker.startWrite(), 'WRITE_IN_PROGRESS');
  assert.equal(tracker.completeWrite(), 'WRITE_COMPLETE');
});

test('lifecycle tracker distinguishes pre-write and post-write failures', () => {
  const before = new ImportLifecycleTracker();
  before.startWrite();
  assert.equal(before.fail(0), 'FAILED_BEFORE_WRITE');
  const after = new ImportLifecycleTracker();
  after.startWrite();
  assert.equal(after.fail(1), 'FAILED_AFTER_WRITE');
});

test('reconciliation completes only after live read-only verification', () => {
  const tracker = new ImportLifecycleTracker();
  assert.throws(() => tracker.completeReconciliation(false), /echte live read-only Supabase-verificatie/);
  assert.equal(tracker.completeReconciliation(true), 'RECONCILIATION_COMPLETE');
});
