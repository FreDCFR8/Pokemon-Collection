import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { isValidSetId } from './import-args.ts';
import { POKEMON_TCG_DATA_REPOSITORY, type LocalCatalogManifest } from './local-manifest.ts';
import { PINNED_DATASET_VERSION, validateLocalDatasetCheckout, type GitRunner } from './local-checkout.ts';

export { PINNED_DATASET_VERSION } from './local-checkout.ts';

type DatasetSet = { id: string; total: number };
type DatasetCard = { id: unknown };
type FileWriter = (content: string, outputPath: string) => void;

export type ManifestInventoryError = { setId?: string; file: string; reason: string };
export type ManifestInventoryWarning = { setId: string; file: string; indexTotal: number; fileTotal: number };
export type ManifestInventoryReport = {
  source: 'pokemon_tcg_data';
  datasetRepository: string;
  datasetVersion: string;
  status: 'PASS' | 'FAIL';
  manifestWritten: boolean;
  setsIndexed: number;
  setsValid: number;
  setsFailed: number;
  indexedCardsTotal: number;
  receivedCardsTotal: number;
  manifestOutputPath: string;
  errors?: ManifestInventoryError[];
  warnings?: ManifestInventoryWarning[];
};

export type GenerateManifestOptions = { inputRoot: string; outputPath: string; reportPath?: string };
export type GenerateManifestResult = { exitCode: number; report: ManifestInventoryReport };
export class LocalManifestGenerationError extends Error {}

function asError(reason: string, file: string, setId?: string): ManifestInventoryError { return { ...(setId ? { setId } : {}), file, reason }; }
function readJson(path: string): unknown { return JSON.parse(readFileSync(path, 'utf8')) as unknown; }
function pathIsSafe(path: string, root: string): boolean { return !isAbsolute(path) && !relative(root, resolve(root, path)).startsWith('..'); }
function baseReport(outputPath: string, values: Pick<ManifestInventoryReport, 'setsIndexed' | 'setsValid' | 'setsFailed' | 'indexedCardsTotal' | 'receivedCardsTotal' | 'status'> & { errors?: ManifestInventoryError[]; warnings?: ManifestInventoryWarning[] }): ManifestInventoryReport {
  return { source: 'pokemon_tcg_data', datasetRepository: POKEMON_TCG_DATA_REPOSITORY, datasetVersion: PINNED_DATASET_VERSION, manifestWritten: false, manifestOutputPath: outputPath, ...values };
}

export function inventoryLocalDataset(inputRoot: string, outputPath: string, runGit: GitRunner = git): { manifest?: LocalCatalogManifest; report: ManifestInventoryReport } {
  try { validateLocalDatasetCheckout(inputRoot, runGit); } catch (error) {
    return { report: baseReport(outputPath, { status: 'FAIL', setsIndexed: 0, setsValid: 0, setsFailed: 0, indexedCardsTotal: 0, receivedCardsTotal: 0, errors: [asError(`checkout-validatie mislukt: ${error instanceof Error ? error.message : 'onbekende fout'}`, 'Git checkout')] }) };
  }

  const errors: ManifestInventoryError[] = [];
  const indexPath = join(inputRoot, 'sets', 'en.json');
  let entries: unknown[];
  try {
    const parsed = readJson(indexPath);
    if (!Array.isArray(parsed)) throw new Error('sets/en.json moet een JSON-array zijn');
    entries = parsed;
  } catch (error) {
    return { report: baseReport(outputPath, { status: 'FAIL', setsIndexed: 0, setsValid: 0, setsFailed: 0, indexedCardsTotal: 0, receivedCardsTotal: 0, errors: [asError(`sets/en.json kan niet worden gelezen: ${error instanceof Error ? error.message : 'ongeldige JSON'}`, 'sets/en.json')] }) };
  }

  const setsIndexed = entries.length;
  const candidates: DatasetSet[] = [];
  const seen = new Set<string>();
  let failedIndexEntries = 0;
  let indexedCardsTotal = 0;
  for (const [index, item] of entries.entries()) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) { failedIndexEntries += 1; errors.push(asError(`set op positie ${index + 1} heeft een ongeldig formaat`, 'sets/en.json')); continue; }
    const value = item as Record<string, unknown>;
    const setId = value.id;
    const total = value.total;
    if (typeof setId !== 'string' || !isValidSetId(setId)) { failedIndexEntries += 1; errors.push(asError(`ongeldige lowercase set-ID: ${String(setId)}`, 'sets/en.json')); continue; }
    if (seen.has(setId)) { failedIndexEntries += 1; errors.push(asError(`dubbele set-ID: ${setId}`, 'sets/en.json', setId)); continue; }
    seen.add(setId);
    if (!Number.isInteger(total) || (total as number) <= 0) { failedIndexEntries += 1; errors.push(asError(`total moet een positief geheel getal zijn: ${String(total)}`, 'sets/en.json', setId)); continue; }
    indexedCardsTotal += total as number;
    candidates.push({ id: setId, total: total as number });
  }

  const manifestSets: LocalCatalogManifest['sets'] = [];
  let receivedCardsTotal = 0;
  let setsValid = 0;
  const warnings: ManifestInventoryWarning[] = [];
  for (const set of candidates) {
    const file = `cards/en/${set.id}.json`;
    const path = join(inputRoot, file);
    let valid = true;
    let fileTotal = 0;
    try {
      if (!pathIsSafe(file, inputRoot)) throw new Error('onveilig pad');
      if (!existsSync(path)) throw new Error('bestand ontbreekt');
      const parsed = readJson(path);
      if (!Array.isArray(parsed)) throw new Error('bestand moet een JSON-array zijn');
      fileTotal = parsed.length;
      receivedCardsTotal += fileTotal;
      if (fileTotal !== set.total) warnings.push({ setId: set.id, file, indexTotal: set.total, fileTotal });
      const ids = new Set<string>();
      for (const card of parsed as DatasetCard[]) {
        const id = card && typeof card === 'object' ? card.id : undefined;
        if (typeof id !== 'string' || id.trim() === '') { valid = false; errors.push(asError('kaart-ID ontbreekt of is leeg', file, set.id)); continue; }
        if (ids.has(id)) { valid = false; errors.push(asError(`dubbele kaart-ID: ${id}`, file, set.id)); continue; }
        ids.add(id);
      }
    } catch (error) { valid = false; errors.push(asError(error instanceof Error ? error.message : 'kaartbestand is ongeldig', file, set.id)); }
    if (valid) { setsValid += 1; manifestSets.push({ setId: set.id, jsonPath: file, expectedCards: fileTotal, enabled: true }); }
  }
  manifestSets.sort((a, b) => a.setId.localeCompare(b.setId));
  const setsFailed = failedIndexEntries + candidates.length - setsValid;
  warnings.sort((a, b) => a.setId.localeCompare(b.setId) || a.file.localeCompare(b.file));
  const report = baseReport(outputPath, { status: errors.length === 0 ? 'PASS' : 'FAIL', setsIndexed, setsValid, setsFailed, indexedCardsTotal, receivedCardsTotal, ...(errors.length ? { errors } : {}), ...(warnings.length ? { warnings } : {}) });
  return { ...(errors.length === 0 ? { manifest: { source: 'pokemon_tcg_data', datasetRepository: POKEMON_TCG_DATA_REPOSITORY, datasetVersion: PINNED_DATASET_VERSION, sets: manifestSets } } : {}), report };
}

export function writeAtomicFile(content: string, outputPath: string): void {
  const tempPath = `${outputPath}.tmp-${process.pid}`;
  try { writeFileSync(tempPath, content, 'utf8'); renameSync(tempPath, outputPath); } finally { try { unlinkSync(tempPath); } catch {} }
}
export function writeGeneratedManifest(manifest: LocalCatalogManifest, outputPath: string): void { writeAtomicFile(`${JSON.stringify(manifest, null, 2)}\n`, outputPath); }
function writeReport(report: ManifestInventoryReport, reportPath: string): void { writeAtomicFile(`${JSON.stringify(report, null, 2)}\n`, reportPath); }

export function generateManifest(options: GenerateManifestOptions, dependencies: { inventory?: typeof inventoryLocalDataset; writeManifest?: FileWriter; writeReport?: FileWriter } = {}): GenerateManifestResult {
  const inventory = (dependencies.inventory ?? inventoryLocalDataset)(options.inputRoot, options.outputPath);
  if (!inventory.manifest) {
    const report = { ...inventory.report, status: 'FAIL' as const, manifestWritten: false };
    if (options.reportPath) { try { (dependencies.writeReport ?? ((content, path) => writeReport(JSON.parse(content) as ManifestInventoryReport, path)))(JSON.stringify(report), options.reportPath); } catch {} }
    return { exitCode: 1, report };
  }
  try {
    (dependencies.writeManifest ?? ((content, path) => writeGeneratedManifest(JSON.parse(content) as LocalCatalogManifest, path)))(JSON.stringify(inventory.manifest), options.outputPath);
  } catch (error) {
    const report = { ...inventory.report, status: 'FAIL' as const, manifestWritten: false, errors: [...(inventory.report.errors ?? []), asError(`manifestoutput mislukt: ${error instanceof Error ? error.message : 'onbekende schrijffout'}`, options.outputPath)] };
    if (options.reportPath) { try { (dependencies.writeReport ?? ((content, path) => writeReport(JSON.parse(content) as ManifestInventoryReport, path)))(JSON.stringify(report), options.reportPath); } catch {} }
    return { exitCode: 1, report };
  }
  const report = { ...inventory.report, status: 'PASS' as const, manifestWritten: true };
  if (options.reportPath) { try { (dependencies.writeReport ?? ((content, path) => writeReport(JSON.parse(content) as ManifestInventoryReport, path)))(JSON.stringify(report), options.reportPath); } catch (error) { return { exitCode: 1, report: { ...report, status: 'FAIL', errors: [asError(`rapportoutput mislukt: ${error instanceof Error ? error.message : 'onbekende schrijffout'}`, options.reportPath)] } }; } }
  return { exitCode: 0, report };
}

export function parseGenerateArgs(argv: readonly string[]): GenerateManifestOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]; const match = arg.match(/^--(input-root|output|report)(?:=(.*))?$/);
    if (!match) throw new LocalManifestGenerationError(`Onbekend argument: ${arg}`);
    const value = match[2] ?? argv[++index]; if (!value || value.startsWith('--')) throw new LocalManifestGenerationError(`Ontbrekende waarde voor ${match[1]}`);
    if (values.has(match[1])) throw new LocalManifestGenerationError(`${match[1]} mag slechts eenmaal worden opgegeven.`); values.set(match[1], value);
  }
  if (!values.has('input-root') || !values.has('output')) throw new LocalManifestGenerationError('Gebruik --input-root <datasetmap> --output <manifestpad> [--report <rapportpad>]');
  return { inputRoot: resolve(values.get('input-root')!), outputPath: resolve(values.get('output')!), ...(values.has('report') ? { reportPath: resolve(values.get('report')!) } : {}) };
}

async function main(): Promise<number> {
  try {
    const result = generateManifest(parseGenerateArgs(process.argv.slice(2)));
    if (result.exitCode === 0) {
      console.log(`Manifest generation PASS: ${result.report.setsIndexed} sets, ${result.report.receivedCardsTotal} cards`);
      for (const warning of result.report.warnings ?? []) console.warn(`Warning: ${warning.setId}: ${warning.file}; index total=${warning.indexTotal}; file total=${warning.fileTotal}`);
    }
    else console.error(`Manifest generation FAIL: ${result.report.errors?.map((error) => `${error.setId ? `${error.setId}: ` : ''}${error.file}: ${error.reason}`).join('; ')}`);
    return result.exitCode;
  } catch (error) { console.error(error instanceof Error ? error.message : 'Manifest generation FAIL'); return 1; }
}
if (process.argv[1]?.endsWith('generate-local-manifest.ts')) main().then((code) => { process.exitCode = code; });
