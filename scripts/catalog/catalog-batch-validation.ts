export type ImportReadyBatch = { name: string; setIds: readonly string[] };

export type BatchConfiguration = {
  officialImportReadySetIds: readonly string[];
  batches: readonly ImportReadyBatch[];
  expectedImportReadySetCount: number;
};

export function validateImportReadyBatchConfiguration(config: BatchConfiguration): void {
  if (!Number.isInteger(config.expectedImportReadySetCount) || config.expectedImportReadySetCount <= 0) throw new Error('expectedImportReadySetCount is ongeldig.');
  if (config.officialImportReadySetIds.length !== config.expectedImportReadySetCount) throw new Error(`Configuratiefout: officiële import-ready bron bevat ${config.officialImportReadySetIds.length} sets; verwacht ${config.expectedImportReadySetCount}.`);
  const official = new Set(config.officialImportReadySetIds);
  if (official.size !== config.officialImportReadySetIds.length) throw new Error('Configuratiefout: officiële import-ready setlijst bevat dubbele set-ID’s.');
  const combined = config.batches.flatMap((batch) => batch.setIds);
  const seen = new Set<string>();
  const duplicates = combined.filter((setId) => seen.has(setId) || !seen.add(setId));
  if (duplicates.length > 0) throw new Error(`Configuratiefout: batchlijsten bevatten dubbele set-ID’s: ${[...new Set(duplicates)].sort().join(', ')}.`);
  const missing = [...official].filter((setId) => !seen.has(setId));
  const unexpected = [...seen].filter((setId) => !official.has(setId));
  if (missing.length > 0 || unexpected.length > 0 || combined.length !== official.size) throw new Error(`Configuratiefout: batchpartitionering wijkt af; ontbrekend=${missing.sort().join(',') || 'geen'}; onverwacht=${unexpected.sort().join(',') || 'geen'}; official=${official.size}; batches=${combined.length}.`);
}

export function batchSetConfigurationFromReport(report: { importReadySets?: unknown; expectedImportReadySetCount?: unknown; batches?: unknown }): BatchConfiguration {
  if (!Array.isArray(report.importReadySets) || !report.importReadySets.every((setId) => typeof setId === 'string')) throw new Error('Goedgekeurd rapport mist de officiële import-ready setlijst.');
  if (!Number.isInteger(report.expectedImportReadySetCount)) throw new Error('Goedgekeurd rapport mist expectedImportReadySetCount.');
  if (!Array.isArray(report.batches) || !report.batches.every((batch) => batch && typeof batch === 'object' && typeof (batch as { name?: unknown }).name === 'string' && Array.isArray((batch as { setIds?: unknown }).setIds))) throw new Error('Goedgekeurd rapport mist de officiële batchpartitionering.');
  return { officialImportReadySetIds: report.importReadySets, expectedImportReadySetCount: report.expectedImportReadySetCount, batches: report.batches as ImportReadyBatch[] };
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
