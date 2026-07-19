export const IMPORT_LIFECYCLE_STATES = [
  'NOT_STARTED',
  'WRITE_IN_PROGRESS',
  'WRITE_COMPLETE',
  'RECONCILIATION_COMPLETE',
  'FAILED_BEFORE_WRITE',
  'FAILED_AFTER_WRITE',
] as const;

export type ImportLifecycleState = typeof IMPORT_LIFECYCLE_STATES[number];

export type ImportLifecycleInput = {
  writeStarted: boolean;
  writeCompleted: boolean;
  reconciliationCompleted: boolean;
  actualWrites: number;
};

/** Derives a durable outcome. A post-write failure is never reported as a pre-write FAIL. */
export function deriveImportLifecycle(input: ImportLifecycleInput): ImportLifecycleState {
  if (!Number.isInteger(input.actualWrites) || input.actualWrites < 0) throw new Error('actualWrites moet een niet-negatief geheel getal zijn.');
  if (!input.writeStarted) return input.reconciliationCompleted ? 'RECONCILIATION_COMPLETE' : 'NOT_STARTED';
  if (!input.writeCompleted) return input.actualWrites > 0 ? 'FAILED_AFTER_WRITE' : 'FAILED_BEFORE_WRITE';
  if (!input.reconciliationCompleted) return 'FAILED_AFTER_WRITE';
  return 'RECONCILIATION_COMPLETE';
}

export function isPostWriteFailure(state: ImportLifecycleState): boolean {
  return state === 'FAILED_AFTER_WRITE';
}
