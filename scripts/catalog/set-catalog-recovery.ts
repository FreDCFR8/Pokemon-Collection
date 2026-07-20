import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inventoryLocalDataset } from './generate-local-manifest.ts';
import { localManifestIdentity } from './catalog-manifest-identity.ts';
import { analysisHash, canonicalReportJson, reportHash } from './catalog-report-identity.ts';
import { POKEMON_TCG_DATA_REPOSITORY } from './local-manifest.ts';

export const SET_CATALOG_RECOVERY_PHASE = 'Phase 7B-2F9E-C';
export const SET_CATALOG_RECOVERY_EXPECTED_SETS = 117;
export const SET_CATALOG_RECOVERY_EXPECTED_DATASET_VERSION = '0af6250a22495e4a3e9f60ff45fc3fedc2e0563d';
export const SET_CATALOG_RECOVERY_BASELINE_REPORT_HASH = '30c9044a0f52b7dba0cb164cff99ce8fbd2f8d14ca1ce7c75b1a03b60ab51288';
export const SET_CATALOG_RECOVERY_BASELINE_ANALYSIS_HASH = 'dd8391f56de294adb8e47d5a56d3d770c335a8ca7fffbfd907f08bb072cf2d6e';
const SOURCE = 'pokemon_tcg_api';
const RPC = 'apply_phase_7b_set_catalog_recovery';

type RecordValue = Record<string, unknown>;

export type RecoveryReviewEntry = {
  setId: string;
  name: string;
  series: string;
  expectedCards: number;
  jsonPath: string;
  proposedSetCode: string;
  externalReference: { source: typeof SOURCE; externalId: string };
  status: 'pending_human_review';
};

export type RecoveryEntry = {
  set_code: string;
  name: string;
  series: string;
  generation: null;
  release_date: string;
  printed_total: number;
  total: number;
  symbol_url: string | null;
  logo_url: string | null;
  source: typeof SOURCE;
  source_id: string;
  external_id: string;
};

export type RecoveryWritePlan = {
  schemaVersion: 1;
  phase: typeof SET_CATALOG_RECOVERY_PHASE;
  datasetRepository: typeof POKEMON_TCG_DATA_REPOSITORY;
  datasetVersion: string;
  manifestHash: string;
  baselineReportHash: typeof SET_CATALOG_RECOVERY_BASELINE_REPORT_HASH;
  baselineAnalysisHash: typeof SET_CATALOG_RECOVERY_BASELINE_ANALYSIS_HASH;
  reviewHash: string;
  entries: RecoveryEntry[];
  plannedDatabaseWrites: number;
  writeplanHash: string;
};

export type RecoveryReport = {
  schemaVersion: 1;
  phase: typeof SET_CATALOG_RECOVERY_PHASE;
  mode: 'dry-run' | 'write' | 'idempotency';
  datasetRepository: typeof POKEMON_TCG_DATA_REPOSITORY;
  datasetVersion: string;
  manifestHash: string;
  baselineReportHash: typeof SET_CATALOG_RECOVERY_BASELINE_REPORT_HASH;
  baselineAnalysisHash: typeof SET_CATALOG_RECOVERY_BASELINE_ANALYSIS_HASH;
  reviewHash: string;
  writePlan: RecoveryWritePlan;
  preflight: { absent: string[]; exactExisting: string[]; conflicts: string[] };
  postcheck: { exactExisting: string[]; errors: string[] };
  databaseWritesTotal: number;
  finalStatus: 'PASS' | 'FAIL';
  errors: string[];
  startedAt: string;
  finishedAt: string;
  reportHash?: string;
  analysisHash?: string;
};

type CatalogRow = {
  id: string;
  set_code: string;
  name: string;
  series: string | null;
  generation: string | null;
  release_date: string | null;
  printed_total: number | null;
  total: number | null;
  symbol_url: string | null;
  logo_url: string | null;
  source: string | null;
  source_id: string | null;
};

type ReferenceRow = { set_catalog_id: string; source: string; external_id: string };
type DatasetSetMetadata = Omit<RecoveryEntry, 'set_code' | 'source' | 'source_id' | 'external_id' | 'generation'>;
type Cli = { dataset: string; review: string; report: string; write: boolean; idempotency: boolean; approvedReport?: string; confirmReportHash?: string };

export class SetCatalogRecoveryError extends Error {}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new SetCatalogRecoveryError(label);
  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function requiredInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new SetCatalogRecoveryError(label);
  return value as number;
}

function safeError(error: unknown): string {
  let value = error instanceof Error ? error.message : 'Onbekende fout.';
  for (const secret of [process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY]) {
    if (secret) value = value.replaceAll(secret, '[REDACTED]');
  }
  return value.replace(/(?:[A-Za-z]:)?[\\/][^\s]+/g, '[REDACTED_PATH]');
}

export function parseRecoveryReview(text: string): RecoveryReviewEntry[] {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new SetCatalogRecoveryError('Recovery review is geen geldige JSON.'); }
  if (!isRecord(parsed) || !isRecord(parsed.createdFrom) || !isRecord(parsed.scope) || !Array.isArray(parsed.proposedMappings) || !Array.isArray(parsed.excludedSets)) {
    throw new SetCatalogRecoveryError('Recovery review heeft geen geldig createdFrom/proposedMappings/excludedSets-formaat.');
  }
  if (parsed.createdFrom.datasetRepository !== POKEMON_TCG_DATA_REPOSITORY || parsed.createdFrom.datasetVersion !== SET_CATALOG_RECOVERY_EXPECTED_DATASET_VERSION) {
    throw new SetCatalogRecoveryError('Recovery review gebruikt niet de gepinde datasetidentiteit.');
  }
  if (parsed.scope.proposedNewMappings !== SET_CATALOG_RECOVERY_EXPECTED_SETS || parsed.scope.existingRowsTouched !== 0 || parsed.scope.automaticWritesAllowed !== false) {
    throw new SetCatalogRecoveryError('Recovery review heeft een ongeldige herstelscope.');
  }
  const entries = parsed.proposedMappings.map((value, index) => {
    if (!isRecord(value) || !isRecord(value.externalReference)) throw new SetCatalogRecoveryError(`Recovery review entry ${index + 1} is ongeldig.`);
    const setId = requiredString(value.setId, `Recovery review entry ${index + 1} mist setId.`);
    const externalId = requiredString(value.externalReference.externalId, `Recovery review entry ${setId} mist externalId.`);
    const source = requiredString(value.externalReference.source, `Recovery review entry ${setId} mist source.`);
    const entry: RecoveryReviewEntry = {
      setId,
      name: requiredString(value.name, `Recovery review entry ${setId} mist name.`),
      series: requiredString(value.series, `Recovery review entry ${setId} mist series.`),
      expectedCards: requiredInteger(value.expectedCards, `Recovery review entry ${setId} heeft ongeldig expectedCards.`),
      jsonPath: requiredString(value.jsonPath, `Recovery review entry ${setId} mist jsonPath.`),
      proposedSetCode: requiredString(value.proposedSetCode, `Recovery review entry ${setId} mist proposedSetCode.`),
      externalReference: { source: source as typeof SOURCE, externalId },
      status: value.status as 'pending_human_review',
    };
    if (entry.status !== 'pending_human_review' || entry.proposedSetCode !== setId || entry.externalReference.source !== SOURCE || entry.externalReference.externalId !== setId) {
      throw new SetCatalogRecoveryError(`Recovery review entry ${setId} wijkt af van de exacte herstelidentiteit.`);
    }
    return entry;
  }).sort((a, b) => a.setId.localeCompare(b.setId, 'en'));
  if (entries.length !== SET_CATALOG_RECOVERY_EXPECTED_SETS || new Set(entries.map((entry) => entry.setId)).size !== SET_CATALOG_RECOVERY_EXPECTED_SETS) {
    throw new SetCatalogRecoveryError(`Recovery review moet exact ${SET_CATALOG_RECOVERY_EXPECTED_SETS} unieke entries bevatten.`);
  }
  const excluded = new Set(parsed.excludedSets.map((value) => isRecord(value) ? value.setId : undefined));
  for (const required of ['cel25c', 'zsv10pt5', 'sv9', 'swsh9']) if (!excluded.has(required)) throw new SetCatalogRecoveryError(`Recovery review mist uitgesloten set ${required}.`);
  if (entries.some((entry) => excluded.has(entry.setId))) throw new SetCatalogRecoveryError('Recovery review bevat een uitgesloten set in de write-scope.');
  return entries;
}

type DatasetSetIndex = {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  printedTotal: number;
  total: number;
  images: { symbol: string | null; logo: string | null };
};

function readDatasetSetIndex(datasetRoot: string): Map<string, DatasetSetIndex> {
  let values: unknown;
  try { values = JSON.parse(readFileSync(resolve(datasetRoot, 'sets/en.json'), 'utf8')); } catch { throw new SetCatalogRecoveryError('Datasetsetindex sets/en.json kon niet worden gelezen.'); }
  if (!Array.isArray(values)) throw new SetCatalogRecoveryError('Datasetsetindex sets/en.json moet een array zijn.');
  const byId = new Map<string, DatasetSetIndex>();
  for (const value of values) {
    if (!isRecord(value)) throw new SetCatalogRecoveryError('Datasetsetindex bevat een ongeldig item.');
    const id = requiredString(value.id, 'Datasetsetindex mist id.');
    if (byId.has(id)) throw new SetCatalogRecoveryError(`Datasetsetindex bevat dubbele set ${id}.`);
    const images = isRecord(value.images) ? value.images : {};
    byId.set(id, {
      id,
      name: requiredString(value.name, `Datasetset ${id} mist name.`),
      series: requiredString(value.series, `Datasetset ${id} mist series.`),
      releaseDate: requiredString(value.releaseDate, `Datasetset ${id} mist releaseDate.`),
      printedTotal: requiredInteger(value.printedTotal, `Datasetset ${id} mist printedTotal.`),
      total: requiredInteger(value.total, `Datasetset ${id} mist total.`),
      images: { symbol: optionalString(images.symbol), logo: optionalString(images.logo) },
    });
  }
  if (byId.size !== 173) throw new SetCatalogRecoveryError(`Datasetsetindex moet exact 173 sets bevatten, ontvangen ${byId.size}.`);
  return byId;
}

function readDatasetSetMetadata(datasetRoot: string, entry: RecoveryReviewEntry, expectedFileCards: number, sourceSet: DatasetSetIndex): DatasetSetMetadata {
  const fullPath = resolve(datasetRoot, entry.jsonPath);
  let cards: unknown;
  try { cards = JSON.parse(readFileSync(fullPath, 'utf8')); } catch { throw new SetCatalogRecoveryError(`Datasetkaartbestand voor ${entry.setId} kon niet worden gelezen.`); }
  if (!Array.isArray(cards) || cards.length !== expectedFileCards) {
    throw new SetCatalogRecoveryError(`Datasetkaartbestand voor ${entry.setId} voldoet niet aan de manifeste kaarttelling.`);
  }
  const cardIds = new Set<string>();
  for (const card of cards) {
    if (!isRecord(card) || typeof card.id !== 'string' || card.id.trim() === '' || cardIds.has(card.id)) {
      throw new SetCatalogRecoveryError(`Datasetkaartbestand voor ${entry.setId} bevat ontbrekende of dubbele kaart-ID's.`);
    }
    cardIds.add(card.id);
  }
  if (sourceSet.id !== entry.setId || sourceSet.name !== entry.name || sourceSet.series !== entry.series || sourceSet.total !== entry.expectedCards || !/^\\d{4}-\\d{2}-\\d{2}$/.test(sourceSet.releaseDate)) {
    throw new SetCatalogRecoveryError(`Datasetset ${entry.setId} wijkt af van de goedgekeurde reviewmetadata.`);
  }
  return {
    name: sourceSet.name,
    series: sourceSet.series,
    release_date: sourceSet.releaseDate,
    printed_total: sourceSet.printedTotal,
    total: sourceSet.total,
    symbol_url: sourceSet.images.symbol,
    logo_url: sourceSet.images.logo,
  };
}

export function buildRecoveryWritePlan(params: { reviewText: string; datasetRoot: string; manifest: { datasetRepository: string; datasetVersion: string; sets: Array<{ setId: string; name: string; series: string; expectedCards: number; jsonPath: string; enabled: boolean }> } }): RecoveryWritePlan {
  const reviewEntries = parseRecoveryReview(params.reviewText);
  if (params.manifest.datasetRepository !== POKEMON_TCG_DATA_REPOSITORY || params.manifest.datasetVersion !== SET_CATALOG_RECOVERY_EXPECTED_DATASET_VERSION || params.manifest.sets.length !== 173) {
    throw new SetCatalogRecoveryError('Lokaal manifest wijkt af van de verplichte gepinde datasetidentiteit of setcount.');
  }
  const manifestById = new Map(params.manifest.sets.map((set) => [set.setId, set]));
  const datasetSetsById = readDatasetSetIndex(params.datasetRoot);
  const entries = reviewEntries.map((review) => {
    const manifest = manifestById.get(review.setId);
    if (!manifest || !manifest.enabled || manifest.name !== review.name || manifest.series !== review.series || manifest.jsonPath !== review.jsonPath) {
      throw new SetCatalogRecoveryError(`Manifest wijkt af voor ${review.setId}.`);
    }
    const sourceSet = datasetSetsById.get(review.setId);
    if (!sourceSet) throw new SetCatalogRecoveryError(`Datasetsetindex mist ${review.setId}.`);
    const metadata = readDatasetSetMetadata(params.datasetRoot, review, manifest.expectedCards, sourceSet);
    return { set_code: review.setId, ...metadata, generation: null, source: SOURCE, source_id: review.setId, external_id: review.setId } satisfies RecoveryEntry;
  }).sort((a, b) => a.set_code.localeCompare(b.set_code, 'en'));
  const manifestHash = localManifestIdentity(params.manifest).manifestHash;
  const base: Omit<RecoveryWritePlan, 'writeplanHash'> = {
    schemaVersion: 1,
    phase: SET_CATALOG_RECOVERY_PHASE,
    datasetRepository: POKEMON_TCG_DATA_REPOSITORY,
    datasetVersion: SET_CATALOG_RECOVERY_EXPECTED_DATASET_VERSION,
    manifestHash,
    baselineReportHash: SET_CATALOG_RECOVERY_BASELINE_REPORT_HASH,
    baselineAnalysisHash: SET_CATALOG_RECOVERY_BASELINE_ANALYSIS_HASH,
    reviewHash: reportHash(JSON.parse(params.reviewText)),
    entries,
    plannedDatabaseWrites: entries.length * 2,
  };
  return { ...base, writeplanHash: reportHash(base) };
}

async function readRows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new SetCatalogRecoveryError(`Supabase SELECT mislukt (${label}): ${safeError(error)}`);
  return data ?? [];
}

function entryEquals(row: CatalogRow, reference: ReferenceRow | undefined, entry: RecoveryEntry): boolean {
  return row.set_code === entry.set_code
    && row.name === entry.name
    && row.series === entry.series
    && row.generation === null
    && row.release_date === entry.release_date
    && row.printed_total === entry.printed_total
    && row.total === entry.total
    && row.symbol_url === entry.symbol_url
    && row.logo_url === entry.logo_url
    && row.source === entry.source
    && row.source_id === entry.source_id
    && reference?.source === SOURCE
    && reference.external_id === entry.external_id
    && reference.set_catalog_id === row.id;
}

export function classifyRecoveryPreflight(entries: RecoveryEntry[], sets: CatalogRow[], references: ReferenceRow[]): { absent: string[]; exactExisting: string[]; conflicts: string[] } {
  const setsByCode = new Map(sets.map((row) => [row.set_code, row]));
  const referencesByExternal = new Map(references.map((row) => [row.external_id, row]));
  const result = { absent: [] as string[], exactExisting: [] as string[], conflicts: [] as string[] };
  for (const entry of entries) {
    const set = setsByCode.get(entry.set_code);
    const reference = referencesByExternal.get(entry.external_id);
    if (!set && !reference) result.absent.push(entry.set_code);
    else if (set && reference && entryEquals(set, reference, entry)) result.exactExisting.push(entry.set_code);
    else result.conflicts.push(entry.set_code);
  }
  return {
    absent: result.absent.sort(),
    exactExisting: result.exactExisting.sort(),
    conflicts: result.conflicts.sort(),
  };
}

async function preflight(supabase: SupabaseClient, entries: RecoveryEntry[]): Promise<{ absent: string[]; exactExisting: string[]; conflicts: string[] }> {
  const codes = entries.map((entry) => entry.set_code);
  const [sets, references] = await Promise.all([
    readRows<CatalogRow>(supabase.from('sets_catalog').select('id,set_code,name,series,generation,release_date,printed_total,total,symbol_url,logo_url,source,source_id').in('set_code', codes), 'sets_catalog'),
    readRows<ReferenceRow>(supabase.from('set_external_references').select('set_catalog_id,source,external_id').eq('source', SOURCE).in('external_id', codes), 'set_external_references'),
  ]);
  return classifyRecoveryPreflight(entries, sets, references);
}

export function validateApprovedRecoveryReport(text: string, expectedPlan: RecoveryWritePlan): RecoveryReport {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new SetCatalogRecoveryError('Goedgekeurd recovery-rapport is geen geldige JSON.'); }
  if (!isRecord(parsed)) throw new SetCatalogRecoveryError('Goedgekeurd recovery-rapport is geen object.');
  const report = parsed as RecoveryReport;
  if (report.reportHash !== reportHash(report) || report.analysisHash !== analysisHash(report)) throw new SetCatalogRecoveryError('Goedgekeurd recovery-rapport heeft ongeldige hashes.');
  if (report.finalStatus !== 'PASS' || report.mode !== 'dry-run' || report.databaseWritesTotal !== 0) throw new SetCatalogRecoveryError('Alleen een PASS dry-runrapport met nul writes kan worden goedgekeurd.');
  if (!report.writePlan || report.writePlan.writeplanHash !== expectedPlan.writeplanHash || canonicalReportJson(report.writePlan) !== canonicalReportJson(expectedPlan)) {
    throw new SetCatalogRecoveryError('Goedgekeurd recovery-rapport past niet bij het actuele writeplan.');
  }
  if (report.preflight.absent.length !== SET_CATALOG_RECOVERY_EXPECTED_SETS || report.preflight.exactExisting.length !== 0 || report.preflight.conflicts.length !== 0) {
    throw new SetCatalogRecoveryError('Goedgekeurd recovery-rapport bevat geen exact volledig absent preflight-resultaat.');
  }
  return report;
}

function sealReport(report: RecoveryReport): RecoveryReport {
  const withAnalysis = { ...report, analysisHash: analysisHash(report) };
  return { ...withAnalysis, reportHash: reportHash(withAnalysis) };
}

function writeJson(path: string, value: unknown): void {
  if (existsSync(path)) throw new SetCatalogRecoveryError('Rapportpad bestaat al; kies een nieuw, versiegebonden bestandsnaam.');
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function datasetVersion(dataset: string): string {
  try { return execFileSync('git', ['-c', `safe.directory=${dataset}`, '-C', dataset, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { throw new SetCatalogRecoveryError('Datasetmap of .git ontbreekt of Git HEAD kan niet worden gelezen.'); }
}

function parseArgs(argv: string[]): Cli {
  const values = new Map<string, string>();
  let write = false; let idempotency = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write') { if (write) throw new SetCatalogRecoveryError('--write mag slechts eenmaal worden gebruikt.'); write = true; continue; }
    if (argument === '--idempotency') { if (idempotency) throw new SetCatalogRecoveryError('--idempotency mag slechts eenmaal worden gebruikt.'); idempotency = true; continue; }
    if (!['--dataset', '--review', '--report', '--approved-report', '--confirm-report-hash'].includes(argument)) throw new SetCatalogRecoveryError(`Onbekend argument: ${argument}`);
    const value = argv[++index];
    if (!value || value.startsWith('--') || values.has(argument)) throw new SetCatalogRecoveryError(`Ongeldige waarde voor ${argument}.`);
    values.set(argument, value);
  }
  const dataset = values.get('--dataset'); const review = values.get('--review'); const report = values.get('--report');
  if (!dataset || !review || !report) throw new SetCatalogRecoveryError('--dataset, --review en --report zijn verplicht.');
  if (write && idempotency) throw new SetCatalogRecoveryError('--write en --idempotency kunnen niet samen.');
  if (write && (!values.get('--approved-report') || !values.get('--confirm-report-hash'))) throw new SetCatalogRecoveryError('--write vereist --approved-report en --confirm-report-hash.');
  if (!write && (values.has('--approved-report') || values.has('--confirm-report-hash'))) throw new SetCatalogRecoveryError('Approved-report opties zijn alleen geldig met --write.');
  return { dataset, review, report, write, idempotency, approvedReport: values.get('--approved-report'), confirmReportHash: values.get('--confirm-report-hash') };
}

export async function runSetCatalogRecovery(options: Cli, supabase: SupabaseClient): Promise<RecoveryReport> {
  const startedAt = new Date().toISOString();
  const base = (): RecoveryReport => ({
    schemaVersion: 1, phase: SET_CATALOG_RECOVERY_PHASE, mode: options.write ? 'write' : options.idempotency ? 'idempotency' : 'dry-run',
    datasetRepository: POKEMON_TCG_DATA_REPOSITORY, datasetVersion: SET_CATALOG_RECOVERY_EXPECTED_DATASET_VERSION, manifestHash: '',
    baselineReportHash: SET_CATALOG_RECOVERY_BASELINE_REPORT_HASH, baselineAnalysisHash: SET_CATALOG_RECOVERY_BASELINE_ANALYSIS_HASH, reviewHash: '',
    writePlan: {} as RecoveryWritePlan, preflight: { absent: [], exactExisting: [], conflicts: [] }, postcheck: { exactExisting: [], errors: [] },
    databaseWritesTotal: 0, finalStatus: 'FAIL', errors: [], startedAt, finishedAt: startedAt,
  });
  const report = base();
  try {
    if (datasetVersion(options.dataset) !== SET_CATALOG_RECOVERY_EXPECTED_DATASET_VERSION) throw new SetCatalogRecoveryError('Dataset commit wijkt af van de verplichte pinned commit.');
    const reviewText = readFileSync(options.review, 'utf8');
    const inventory = inventoryLocalDataset(options.dataset);
    const manifest = inventory.manifest;
    if (!manifest) throw new SetCatalogRecoveryError('Lokaal datasetmanifest kon niet worden opgebouwd.');
    const plan = buildRecoveryWritePlan({ reviewText, datasetRoot: options.dataset, manifest });
    report.manifestHash = plan.manifestHash; report.reviewHash = plan.reviewHash; report.writePlan = plan;
    report.preflight = await preflight(supabase, plan.entries);
    if (report.preflight.conflicts.length > 0) throw new SetCatalogRecoveryError(`Preflight bevat conflicten: ${report.preflight.conflicts.join(', ')}.`);

    if (options.idempotency) {
      if (report.preflight.exactExisting.length !== SET_CATALOG_RECOVERY_EXPECTED_SETS || report.preflight.absent.length !== 0) throw new SetCatalogRecoveryError('Idempotencyrun vereist exact 117 bestaande identieke set- en referenceparen.');
      report.postcheck.exactExisting = report.preflight.exactExisting;
      report.finalStatus = 'PASS';
    } else if (!options.write) {
      if (report.preflight.absent.length !== SET_CATALOG_RECOVERY_EXPECTED_SETS || report.preflight.exactExisting.length !== 0) throw new SetCatalogRecoveryError('Dry-run vereist exact 117 afwezige setidentiteiten.');
      report.finalStatus = 'PASS';
    } else {
      const approved = validateApprovedRecoveryReport(readFileSync(options.approvedReport!, 'utf8'), plan);
      if (options.confirmReportHash !== approved.reportHash) throw new SetCatalogRecoveryError('confirm-report-hash komt niet overeen met het goedgekeurde rapport.');
      if (report.preflight.absent.length !== SET_CATALOG_RECOVERY_EXPECTED_SETS || report.preflight.exactExisting.length !== 0) throw new SetCatalogRecoveryError('Write-preflight vereist exact 117 afwezige setidentiteiten.');
      const { data, error } = await supabase.rpc(RPC, { p_entries: plan.entries });
      if (error) throw new SetCatalogRecoveryError(`Transactionele recovery-RPC is mislukt: ${safeError(error)}`);
      if (!Array.isArray(data) || data.length !== SET_CATALOG_RECOVERY_EXPECTED_SETS) throw new SetCatalogRecoveryError('Recovery-RPC retourneerde niet exact 117 setresultaten.');
      const returnedCodes = data.map((row) => isRecord(row) ? row.set_code : undefined);
      if (new Set(returnedCodes).size !== SET_CATALOG_RECOVERY_EXPECTED_SETS || returnedCodes.some((code) => typeof code !== 'string' || !plan.entries.some((entry) => entry.set_code === code))) {
        throw new SetCatalogRecoveryError('Recovery-RPC retourneerde geen exacte setlijst.');
      }
      report.databaseWritesTotal = plan.plannedDatabaseWrites;
      const after = await preflight(supabase, plan.entries);
      report.postcheck.exactExisting = after.exactExisting;
      report.postcheck.errors = [...after.absent, ...after.conflicts].map((setCode) => `postcheck:${setCode}`);
      if (after.exactExisting.length !== SET_CATALOG_RECOVERY_EXPECTED_SETS || report.postcheck.errors.length !== 0) throw new SetCatalogRecoveryError('Postcheck bevestigt niet exact 117 identieke set- en referenceparen.');
      report.finalStatus = 'PASS';
    }
  } catch (error) {
    report.errors.push(safeError(error));
    report.finalStatus = 'FAIL';
  }
  report.finishedAt = new Date().toISOString();
  return sealReport(report);
}

if (process.argv[1]?.endsWith('set-catalog-recovery.ts') && !process.env.NODE_TEST_CONTEXT) {
  (async () => {
    let options: Cli | undefined;
    try {
      options = parseArgs(process.argv.slice(2));
      const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new SetCatalogRecoveryError('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.');
      const report = await runSetCatalogRecovery(options, createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
      writeJson(options.report, report);
      console.log(`${report.phase}: ${report.finalStatus}; databaseWritesTotal=${report.databaseWritesTotal}; reportHash=${report.reportHash}`);
      process.exitCode = report.finalStatus === 'PASS' ? 0 : 1;
    } catch (error) {
      const message = safeError(error);
      if (options) writeJson(options.report, sealReport({
        schemaVersion: 1, phase: SET_CATALOG_RECOVERY_PHASE, mode: options.write ? 'write' : options.idempotency ? 'idempotency' : 'dry-run',
        datasetRepository: POKEMON_TCG_DATA_REPOSITORY, datasetVersion: SET_CATALOG_RECOVERY_EXPECTED_DATASET_VERSION, manifestHash: '',
        baselineReportHash: SET_CATALOG_RECOVERY_BASELINE_REPORT_HASH, baselineAnalysisHash: SET_CATALOG_RECOVERY_BASELINE_ANALYSIS_HASH, reviewHash: '',
        writePlan: {} as RecoveryWritePlan, preflight: { absent: [], exactExisting: [], conflicts: [] }, postcheck: { exactExisting: [], errors: [] },
        databaseWritesTotal: 0, finalStatus: 'FAIL', errors: [message], startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
      }));
      console.error(`Setcatalog recovery geblokkeerd: ${message}`);
      process.exitCode = 1;
    }
  })();
}
