export type ImportReadyBatch = { name: string; setIds: readonly string[] };

export type BatchConfiguration = {
  officialImportReadySetIds: readonly string[];
  batches: readonly ImportReadyBatch[];
  expectedImportReadySetCount: number;
  excludedSetIds?: readonly string[];
};

export const PHASE_A_BATCH_STRUCTURE_ERROR = 'Phase-A-rapport mist de canonieke batchestructuur; genereer Phase A opnieuw.';
export const PHASE_A_REGENERATION_COMMAND = 'npm.cmd run catalog:rebaseline:read-only -- --dataset <pinned-checkout> --report <phase-a-report.json> --checkpoint <phase-a-checkpoint.json>';

export class PhaseAReportValidationError extends Error {
  readonly field: string;
  readonly requiredBatchInformation: string;
  readonly regenerationCommand: string;
  constructor(message: string, field: string, requiredBatchInformation: string, regenerationCommand = PHASE_A_REGENERATION_COMMAND) {
    super(message);
    this.name = 'PhaseAReportValidationError';
    this.field = field;
    this.requiredBatchInformation = requiredBatchInformation;
    this.regenerationCommand = regenerationCommand;
  }
}

export function validateImportReadyBatchConfiguration(config: BatchConfiguration): void {
  if (!Number.isInteger(config.expectedImportReadySetCount) || config.expectedImportReadySetCount <= 0) throw new Error('expectedImportReadySetCount is ongeldig.');
  if (config.officialImportReadySetIds.length !== config.expectedImportReadySetCount) throw new Error(`Configuratiefout: officiële import-ready bron bevat ${config.officialImportReadySetIds.length} sets; verwacht ${config.expectedImportReadySetCount}.`);
  const official = new Set(config.officialImportReadySetIds);
  if (official.size !== config.officialImportReadySetIds.length) throw new Error('Configuratiefout: officiële import-ready setlijst bevat dubbele set-ID’s.');
  const batchNames = config.batches.map((batch) => batch.name);
  const missingBatches = ['batch-1', 'batch-2', 'batch-3'].filter((name) => !batchNames.includes(name));
  if (missingBatches.length > 0) throw new Error(`Configuratiefout: canonieke batch ontbreekt: ${missingBatches.join(', ')}.`);
  if (new Set(batchNames).size !== batchNames.length) throw new Error('Configuratiefout: batch-ID’s zijn niet uniek.');
  const combined = config.batches.flatMap((batch) => batch.setIds);
  const seen = new Set<string>();
  const duplicates = combined.filter((setId) => seen.has(setId) || !seen.add(setId));
  if (duplicates.length > 0) throw new Error(`Configuratiefout: batchlijsten bevatten dubbele set-ID’s: ${[...new Set(duplicates)].sort().join(', ')}.`);
  const excludedInBatches = [...new Set(combined.filter((setId) => (config.excludedSetIds ?? []).includes(setId)))].sort();
  if (excludedInBatches.length > 0) throw new Error(`Configuratiefout: BLOCKED- of NEEDS_MANUAL_REVIEW-set staat in batch: ${excludedInBatches.join(', ')}.`);
  const missing = [...official].filter((setId) => !seen.has(setId));
  const unexpected = [...seen].filter((setId) => !official.has(setId));
  if (missing.length > 0 || unexpected.length > 0 || combined.length !== official.size) throw new Error(`Configuratiefout: batchpartitionering wijkt af; ontbrekend=${missing.sort().join(',') || 'geen'}; onverwacht=${unexpected.sort().join(',') || 'geen'}; official=${official.size}; batches=${combined.length}.`);
}

export function batchSetConfigurationFromReport(report: { importReadySets?: unknown; expectedImportReadySetCount?: unknown; batches?: unknown; blockedSets?: unknown; needsManualReviewSets?: unknown; results?: unknown }): BatchConfiguration {
  if (!Array.isArray(report.importReadySets) || !report.importReadySets.every((setId) => typeof setId === 'string')) throw new PhaseAReportValidationError('Goedgekeurd rapport mist importReadySets.', 'importReadySets', 'importReadySets met de volledige canonieke set-ID-lijst.');
  if (!Number.isInteger(report.expectedImportReadySetCount)) throw new PhaseAReportValidationError('Goedgekeurd rapport mist expectedImportReadySetCount.', 'expectedImportReadySetCount', 'expectedImportReadySetCount als geheel getal uit het volledige Phase-A-rapport.');
  if (!Object.prototype.hasOwnProperty.call(report, 'batches') || !Array.isArray(report.batches) || !report.batches.every((batch) => batch && typeof batch === 'object' && typeof (batch as { name?: unknown }).name === 'string' && Array.isArray((batch as { setIds?: unknown }).setIds))) throw new PhaseAReportValidationError(PHASE_A_BATCH_STRUCTURE_ERROR, 'batches', 'batches met exact batch-1, batch-2 en batch-3, inclusief setIds per batch.');
  const excluded = [
    ...(Array.isArray(report.blockedSets) ? report.blockedSets.filter((setId): setId is string => typeof setId === 'string') : []),
    ...(Array.isArray(report.needsManualReviewSets) ? report.needsManualReviewSets.filter((setId): setId is string => typeof setId === 'string') : []),
    ...(Array.isArray(report.results) ? report.results.flatMap((result) => {
      if (!result || typeof result !== 'object') return [];
      const item = result as { setId?: unknown; classification?: unknown; status?: unknown };
      return typeof item.setId === 'string' && (item.classification === 'BLOCKED' || item.classification === 'NEEDS_MANUAL_REVIEW' || item.status === 'BLOCKED' || item.status === 'NEEDS_MANUAL_REVIEW') ? [item.setId] : [];
    }) : []),
  ];
  return { officialImportReadySetIds: report.importReadySets, expectedImportReadySetCount: report.expectedImportReadySetCount, batches: report.batches as ImportReadyBatch[], excludedSetIds: excluded };
}

export type CatalogTableCounts = Record<'cards_catalog' | 'card_external_references' | 'collection_cards' | 'sets_catalog' | 'set_external_references', number>;

export function expectedPostWriteCounts(initial: CatalogTableCounts, plannedCatalogInserts: number, plannedReferenceInserts: number): CatalogTableCounts {
  if (!Number.isInteger(plannedCatalogInserts) || plannedCatalogInserts < 0 || !Number.isInteger(plannedReferenceInserts) || plannedReferenceInserts < 0) throw new Error('Writeplan-inserts moeten niet-negatieve gehele getallen zijn.');
  return { ...initial, cards_catalog: initial.cards_catalog + plannedCatalogInserts, card_external_references: initial.card_external_references + plannedReferenceInserts };
}

export function classifyDynamicPrecheck(current: CatalogTableCounts, initial: CatalogTableCounts, expectedPost: CatalogTableCounts): 'initial' | 'alreadyApplied' | 'partial' {
  const tables = Object.keys(initial) as (keyof CatalogTableCounts)[];
  if (tables.every((table) => current[table] === initial[table])) return 'initial';
  if (tables.every((table) => current[table] === expectedPost[table])) return 'alreadyApplied';
  for (const table of tables) if (current[table] < initial[table] || current[table] > expectedPost[table]) throw new Error(`Onverwachte actuele database-count voor ${table}: ${current[table]} buiten [${initial[table]}, ${expectedPost[table]}].`);
  return 'partial';
}
