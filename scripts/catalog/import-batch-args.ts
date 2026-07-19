import { isValidSetId, type CatalogImportSource } from './import-args.ts';

export const DEFAULT_CATALOG_BATCH_CONFIG_PATH = 'config/catalog/import-sets.json';
export const BATCH_1_SET_IDS = ['bw9', 'cel25', 'me1', 'me2', 'me2pt5', 'me3', 'me4', 'pgo', 'rsv10pt5', 'sm1', 'sm12', 'sm2', 'sm35'] as const;

export type CatalogBatchMode = 'dry-run' | 'write-approved';

export type CatalogBatchOptions = {
  mode: CatalogBatchMode;
  source: CatalogImportSource;
  configPath: string;
  manifestPath?: string;
  inputRoot?: string;
  reportPath?: string;
  approvedDryRunReportPath?: string;
  writePlanPath?: string;
  confirmWriteBatch?: 'batch-1';
  checkpointPath?: string;
  resume?: boolean;
  setIds?: string[];
};

export type CatalogBatchConfig = {
  source: 'pokemon_tcg_api';
  sets: string[];
};

export class CatalogBatchArgumentError extends Error {}

function parseSetList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertValidSetList(setIds: readonly string[], label: string): void {
  if (setIds.length === 0) throw new CatalogBatchArgumentError(`${label} bevat geen set-ID's.`);
  const seen = new Set<string>();
  for (const setId of setIds) {
    if (!isValidSetId(setId)) {
      throw new CatalogBatchArgumentError(`Ongeldige set-ID in ${label}: ${setId}. Gebruik alleen lowercase ASCII-letters en cijfers.`);
    }
    if (seen.has(setId)) throw new CatalogBatchArgumentError(`Dubbele set-ID in ${label}: ${setId}.`);
    seen.add(setId);
  }
}

function readValue(argv: readonly string[], index: number, arg: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new CatalogBatchArgumentError(`Ontbrekende waarde voor ${arg}.`);
  return value;
}

export function parseCatalogBatchArgs(argv: readonly string[]): CatalogBatchOptions {
  let mode: CatalogBatchMode = 'dry-run';
  let source: CatalogImportSource = 'pokemon_tcg_api';
  let sourceSpecified = false;
  let configPath = DEFAULT_CATALOG_BATCH_CONFIG_PATH;
  let manifestPath: string | undefined;
  let inputRoot: string | undefined;
  let reportPath: string | undefined;
  let approvedDryRunReportPath: string | undefined;
  let writePlanPath: string | undefined;
  let confirmWriteBatch: 'batch-1' | undefined;
  let checkpointPath: string | undefined;
  let resume = false;
  let setIds: string[] | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode') { const value = readValue(argv, index, '--mode'); if (value !== 'dry-run' && value !== 'write-approved') throw new CatalogBatchArgumentError('Ongeldige waarde voor --mode. Gebruik dry-run of write-approved.'); mode = value; index += 1; continue; }
    if (arg.startsWith('--mode=')) { const value = arg.slice(7); if (value !== 'dry-run' && value !== 'write-approved') throw new CatalogBatchArgumentError('Ongeldige waarde voor --mode. Gebruik dry-run of write-approved.'); mode = value; continue; }
    if (arg === '--source') { if (sourceSpecified) throw new CatalogBatchArgumentError('--source mag slechts eenmaal worden opgegeven.'); const value = readValue(argv, index, '--source'); if (value !== 'pokemon_tcg_api' && value !== 'pokemon_tcg_data') throw new CatalogBatchArgumentError('Ongeldige bron. Gebruik pokemon_tcg_api of pokemon_tcg_data.'); source = value; sourceSpecified = true; index += 1; continue; }
    if (arg.startsWith('--source=')) { if (sourceSpecified) throw new CatalogBatchArgumentError('--source mag slechts eenmaal worden opgegeven.'); const value = arg.slice(9); if (value !== 'pokemon_tcg_api' && value !== 'pokemon_tcg_data') throw new CatalogBatchArgumentError('Ongeldige bron. Gebruik pokemon_tcg_api of pokemon_tcg_data.'); source = value; sourceSpecified = true; continue; }
    if (arg === '--config') { configPath = readValue(argv, index, '--config'); index += 1; continue; }
    if (arg.startsWith('--config=')) { configPath = arg.slice(9); if (!configPath) throw new CatalogBatchArgumentError('Ontbrekende waarde voor --config.'); continue; }
    if (arg === '--manifest') { if (manifestPath) throw new CatalogBatchArgumentError('--manifest mag slechts eenmaal worden opgegeven.'); manifestPath = readValue(argv, index, '--manifest'); index += 1; continue; }
    if (arg.startsWith('--manifest=')) { if (manifestPath) throw new CatalogBatchArgumentError('--manifest mag slechts eenmaal worden opgegeven.'); manifestPath = arg.slice(11); if (!manifestPath) throw new CatalogBatchArgumentError('Ontbrekende waarde voor --manifest.'); continue; }
    if (arg === '--input-root') { if (inputRoot) throw new CatalogBatchArgumentError('--input-root mag slechts eenmaal worden opgegeven.'); inputRoot = readValue(argv, index, '--input-root'); index += 1; continue; }
    if (arg.startsWith('--input-root=')) { if (inputRoot) throw new CatalogBatchArgumentError('--input-root mag slechts eenmaal worden opgegeven.'); inputRoot = arg.slice(13); if (!inputRoot) throw new CatalogBatchArgumentError('Ontbrekende waarde voor --input-root.'); continue; }
    if (arg === '--report') { if (reportPath) throw new CatalogBatchArgumentError('--report mag slechts eenmaal worden opgegeven.'); reportPath = readValue(argv, index, '--report'); index += 1; continue; }
    if (arg.startsWith('--report=')) { if (reportPath) throw new CatalogBatchArgumentError('--report mag slechts eenmaal worden opgegeven.'); reportPath = arg.slice(9); if (!reportPath) throw new CatalogBatchArgumentError('Ontbrekende waarde voor --report.'); continue; }
    if (arg === '--approved-dry-run-report') { if (approvedDryRunReportPath) throw new CatalogBatchArgumentError('--approved-dry-run-report mag slechts eenmaal worden opgegeven.'); approvedDryRunReportPath = readValue(argv, index, '--approved-dry-run-report'); index += 1; continue; }
    if (arg.startsWith('--approved-dry-run-report=')) { if (approvedDryRunReportPath) throw new CatalogBatchArgumentError('--approved-dry-run-report mag slechts eenmaal worden opgegeven.'); approvedDryRunReportPath = arg.slice('--approved-dry-run-report='.length); if (!approvedDryRunReportPath) throw new CatalogBatchArgumentError('Ontbrekende waarde voor --approved-dry-run-report.'); continue; }
    if (arg === '--write-plan') { if (writePlanPath) throw new CatalogBatchArgumentError('--write-plan mag slechts eenmaal worden opgegeven.'); writePlanPath = readValue(argv, index, '--write-plan'); index += 1; continue; }
    if (arg.startsWith('--write-plan=')) { if (writePlanPath) throw new CatalogBatchArgumentError('--write-plan mag slechts eenmaal worden opgegeven.'); writePlanPath = arg.slice('--write-plan='.length); if (!writePlanPath) throw new CatalogBatchArgumentError('--write-plan vereist een pad.'); continue; }
    if (arg === '--confirm-write') { if (confirmWriteBatch) throw new CatalogBatchArgumentError('--confirm-write mag slechts eenmaal worden opgegeven.'); const value = readValue(argv, index, '--confirm-write'); if (value !== 'batch-1') throw new CatalogBatchArgumentError('--confirm-write vereist exact batch-1.'); confirmWriteBatch = 'batch-1'; index += 1; continue; }
    if (arg.startsWith('--confirm-write=')) throw new CatalogBatchArgumentError('--confirm-write vereist exact: --confirm-write batch-1.');
    if (arg === '--checkpoint') { if (checkpointPath) throw new CatalogBatchArgumentError('--checkpoint mag slechts eenmaal worden opgegeven.'); checkpointPath = readValue(argv, index, '--checkpoint'); index += 1; continue; }
    if (arg.startsWith('--checkpoint=')) { if (checkpointPath) throw new CatalogBatchArgumentError('--checkpoint mag slechts eenmaal worden opgegeven.'); checkpointPath = arg.slice(13); if (!checkpointPath) throw new CatalogBatchArgumentError('Ontbrekende waarde voor --checkpoint.'); continue; }
    if (arg === '--resume') { if (resume) throw new CatalogBatchArgumentError('--resume mag slechts eenmaal worden opgegeven.'); resume = true; continue; }
    if (arg === '--sets') { if (setIds !== undefined) throw new CatalogBatchArgumentError('--sets mag slechts eenmaal worden opgegeven.'); setIds = parseSetList(readValue(argv, index, '--sets')); index += 1; continue; }
    if (arg.startsWith('--sets=')) { if (setIds !== undefined) throw new CatalogBatchArgumentError('--sets mag slechts eenmaal worden opgegeven.'); setIds = parseSetList(arg.slice(7)); continue; }
    throw new CatalogBatchArgumentError(`Onbekend argument: ${arg}`);
  }

  if (setIds !== undefined) assertValidSetList(setIds, '--sets');
  if (resume && !checkpointPath) throw new CatalogBatchArgumentError('--resume vereist --checkpoint.');
  if (source !== 'pokemon_tcg_data' && (checkpointPath || resume)) throw new CatalogBatchArgumentError('--checkpoint en --resume zijn alleen toegestaan met source pokemon_tcg_data.');
  if (mode === 'write-approved' && (checkpointPath || resume)) throw new CatalogBatchArgumentError('Checkpoint/resume is alleen toegestaan voor de lokale dry-run.');
  if (source === 'pokemon_tcg_data') {
    if (!manifestPath) throw new CatalogBatchArgumentError('Bron pokemon_tcg_data vereist --manifest.');
    if (!inputRoot) throw new CatalogBatchArgumentError('Bron pokemon_tcg_data vereist --input-root.');
    if (mode === 'write-approved') {
      if (!approvedDryRunReportPath && !writePlanPath) throw new CatalogBatchArgumentError('Lokale write-approved vereist een goedgekeurd writeplan.');
      if (confirmWriteBatch !== 'batch-1') throw new CatalogBatchArgumentError('Lokale write-approved vereist --confirm-write batch-1.');
      if (!setIds || setIds.length !== BATCH_1_SET_IDS.length || setIds.some((setId, index) => setId !== BATCH_1_SET_IDS[index])) throw new CatalogBatchArgumentError('Lokale write-approved vereist exact de Batch 1-setlijst; Batch 2/3 of een andere volgorde is geblokkeerd.');
    }
  } else if (manifestPath || inputRoot || approvedDryRunReportPath || writePlanPath || confirmWriteBatch) {
    throw new CatalogBatchArgumentError('--manifest en --input-root zijn alleen toegestaan met bron pokemon_tcg_data.');
  }
  return { mode, source, configPath, ...(manifestPath ? { manifestPath } : {}), ...(inputRoot ? { inputRoot } : {}), ...(reportPath ? { reportPath } : {}), ...(approvedDryRunReportPath ? { approvedDryRunReportPath } : {}), ...(writePlanPath ? { writePlanPath } : {}), ...(confirmWriteBatch ? { confirmWriteBatch } : {}), ...(checkpointPath ? { checkpointPath } : {}), ...(resume ? { resume } : {}), ...(setIds ? { setIds } : {}) };
}

export function parseCatalogBatchConfigFromText(text: string): CatalogBatchConfig {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new CatalogBatchArgumentError('Batchconfig is geen geldige JSON.'); }
  if (!parsed || typeof parsed !== 'object') throw new CatalogBatchArgumentError('Batchconfig heeft een ongeldig formaat.');
  const config = parsed as { source?: unknown; sets?: unknown };
  if (config.source !== 'pokemon_tcg_api') throw new CatalogBatchArgumentError('Batchconfig moet source pokemon_tcg_api gebruiken.');
  if (!Array.isArray(config.sets) || !config.sets.every((setId) => typeof setId === 'string')) throw new CatalogBatchArgumentError('Batchconfig moet een sets-array met set-ID strings bevatten.');
  assertValidSetList(config.sets, 'batchconfig');
  return { source: 'pokemon_tcg_api', sets: config.sets };
}
