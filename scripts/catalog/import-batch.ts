import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { parseCatalogBatchArgs, parseCatalogBatchConfigFromText, type CatalogBatchMode } from './import-batch-args.ts';
import { parseLocalCatalogManifestFromText, type LocalCatalogManifestSet } from './local-manifest.ts';

type StepName = 'dry-run' | 'write' | 'idempotency';
type StepResult = { step: StepName; exitCode: number; output: string; passed: boolean; error?: string; expectedCards?: number; receivedCards?: number; plannedWrites?: number; databaseWrites?: number };
type SetResult = { setId: string; expectedCards?: number; dryRun?: StepResult; write?: StepResult; idempotency?: StepResult; error?: string };

function readNumberLine(output: string, label: string): number | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = output.match(new RegExp(`^${escaped}: (\\d+)$`, 'm'));
  return match ? Number(match[1]) : undefined;
}

function runImportSet(setId: string, write: boolean, inputPath?: string): StepResult {
  const step: StepName = write ? 'write' : 'dry-run';
  const args = ['--experimental-strip-types', process.env.CATALOG_IMPORT_SET_SCRIPT ?? 'scripts/catalog/import-set.ts', '--set', setId, ...(inputPath ? ['--source', 'pokemon_tcg_data', '--input', inputPath] : []), ...(write ? ['--write'] : [])];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return validateStepOutput({ step, exitCode: result.status ?? 1, output });
}

function runIdempotency(setId: string): StepResult { return validateStepOutput({ ...runImportSet(setId, false), step: 'idempotency' }); }
function hasLine(output: string, pattern: RegExp): boolean { return output.split(/\r?\n/).some((line) => pattern.test(line.trim())); }

function validateStepOutput(params: { step: StepName; exitCode: number; output: string }): StepResult {
  const errors: string[] = [];
  const expectedCards = readNumberLine(params.output, 'Expected cards');
  const receivedCards = readNumberLine(params.output, 'Received cards');
  const plannedWrites = readNumberLine(params.output, 'Theoretisch geplande writes');
  const databaseWrites = readNumberLine(params.output, 'Database writes');
  if (params.exitCode !== 0) errors.push(`exitcode ${params.exitCode}`);
  if (!hasLine(params.output, /^Result: PASS$/)) errors.push('Result: PASS ontbreekt.');
  if (params.step === 'dry-run') {
    if (!hasLine(params.output, /^Mode: DRY RUN$/)) errors.push('Dry-run mode ontbreekt.');
    if (!hasLine(params.output, /^Database writes: 0$/)) errors.push('Dry-run bevat databasewrites of mist Database writes: 0.');
  }
  if (params.step === 'write') {
    if (!hasLine(params.output, /^Mode: WRITE$/)) errors.push('Write mode ontbreekt.');
    if (!hasLine(params.output, /^Mislukte writes: 0$/)) errors.push('Write rapporteert mislukte writes of mist die controle.');
  }
  if (params.step === 'idempotency') {
    if (!hasLine(params.output, /^Mode: DRY RUN$/)) errors.push('Idempotency gebruikt geen dry-run mode.');
    if (!hasLine(params.output, /^New: 0$/)) errors.push('Idempotency vond nog nieuwe kaarten.');
    if (!hasLine(params.output, /^Theoretisch geplande writes: 0$/)) errors.push('Idempotency plant nog writes.');
    if (!hasLine(params.output, /^Database writes: 0$/)) errors.push('Idempotency bevat databasewrites of mist Database writes: 0.');
  }
  return { step: params.step, exitCode: params.exitCode, output: params.output, passed: errors.length === 0, ...(errors.length ? { error: errors.join(' ') } : {}), ...(expectedCards !== undefined ? { expectedCards } : {}), ...(receivedCards !== undefined ? { receivedCards } : {}), ...(plannedWrites !== undefined ? { plannedWrites } : {}), ...(databaseWrites !== undefined ? { databaseWrites } : {}) };
}

function printStep(setId: string, result: StepResult): void {
  console.log(`\n=== ${setId} / ${result.step} ===`); process.stdout.write(result.output); if (!result.output.endsWith('\n')) console.log('');
  console.log(`Batch step: ${result.passed ? 'PASS' : 'FAIL'}`); if (result.error) console.log(`Batch validation: ${result.error}`);
}

function printSummary(mode: CatalogBatchMode, results: SetResult[], datasetVersion?: string): void {
  const failed = results.filter((r) => r.error || [r.dryRun, r.write, r.idempotency].some((s) => s && !s.passed));
  console.log('\nCatalog batch summary'); if (datasetVersion) console.log(`Dataset version: ${datasetVersion}`);
  console.log(`Mode: ${mode}`); console.log(`Sets planned: ${results.length}`); console.log(`Sets executed: ${results.filter((r) => r.dryRun).length}`); console.log(`Sets passed: ${results.length - failed.length}`); console.log(`Sets failed: ${failed.length}`);
  for (const r of results) {
    const s = r.dryRun ?? r.write ?? r.idempotency;
    console.log(`- ${r.setId}: ${r.error ? 'FAIL' : s?.passed ? 'PASS' : 'FAIL'}; expected=${r.expectedCards ?? s?.expectedCards ?? 'n/a'}; received=${s?.receivedCards ?? 'n/a'}; planned_writes=${s?.plannedWrites ?? 'n/a'}; database_writes=${s?.databaseWrites ?? 'n/a'}${r.error || s?.error ? `; error=${r.error ?? s?.error}` : ''}`);
  }
}

function readApiSetIds(options: ReturnType<typeof parseCatalogBatchArgs>): string[] {
  if (options.setIds) return options.setIds;
  return parseCatalogBatchConfigFromText(readFileSync(options.configPath, 'utf8')).sets;
}

function selectedLocalSets(options: ReturnType<typeof parseCatalogBatchArgs>): { datasetVersion: string; sets: (LocalCatalogManifestSet & { inputPath: string })[] } {
  const manifest = parseLocalCatalogManifestFromText(readFileSync(options.manifestPath!, 'utf8'));
  const wanted = options.setIds ? new Set(options.setIds) : undefined;
  const sets = manifest.sets.filter((set) => set.enabled && (!wanted || wanted.has(set.setId))).map((set) => ({ ...set, inputPath: resolve(options.inputRoot!, set.jsonPath) }));
  if (sets.length === 0) throw new Error('Geen actieve manifestsets geselecteerd voor uitvoering.');
  if (wanted) for (const setId of wanted) if (!manifest.sets.some((set) => set.setId === setId && set.enabled)) throw new Error(`Geselecteerde set ${setId} staat niet actief in het lokale manifest.`);
  for (const set of sets) if (!existsSync(set.inputPath)) throw new Error(`Lokale JSON-input ontbreekt voor ${set.setId}: ${set.inputPath}`);
  return { datasetVersion: manifest.datasetVersion, sets };
}

function writeReport(path: string, report: unknown): void { writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); }

async function main(): Promise<number> {
  const results: SetResult[] = []; let mode: CatalogBatchMode = 'dry-run'; let datasetVersion: string | undefined;
  try {
    const options = parseCatalogBatchArgs(process.argv.slice(2)); mode = options.mode;
    console.log('Catalog batch import'); console.log(`Source: ${options.source}`); console.log(`Mode: ${mode}`);
    if (options.source === 'pokemon_tcg_data') {
      const local = selectedLocalSets(options); datasetVersion = local.datasetVersion; console.log(`Dataset version: ${datasetVersion}`); console.log(`Sets: ${local.sets.map((s) => s.setId).join(', ')}`);
      for (const set of local.sets) {
        const result: SetResult = { setId: set.setId, expectedCards: set.expectedCards }; results.push(result);
        result.dryRun = runImportSet(set.setId, false, set.inputPath);
        if (result.dryRun.receivedCards !== set.expectedCards) { result.dryRun.passed = false; result.dryRun.error = `${result.dryRun.error ? `${result.dryRun.error} ` : ''}Expected/received mismatch: manifest=${set.expectedCards}, importer=${result.dryRun.receivedCards ?? 'unknown'}.`; }
        if (result.dryRun.databaseWrites !== 0) { result.dryRun.passed = false; result.dryRun.error = `${result.dryRun.error ? `${result.dryRun.error} ` : ''}Lokale dry-run rapporteert databasewrites != 0.`; }
        printStep(set.setId, result.dryRun);
      }
    } else {
      const setIds = readApiSetIds(options); console.log(`Sets: ${setIds.join(', ')}`);
      for (const setId of setIds) { const r: SetResult = { setId }; results.push(r); r.dryRun = runImportSet(setId, false); printStep(setId, r.dryRun); if (!r.dryRun.passed) break; if (mode === 'write-approved') { r.write = runImportSet(setId, true); printStep(setId, r.write); if (!r.write.passed) break; r.idempotency = runIdempotency(setId); printStep(setId, r.idempotency); if (!r.idempotency.passed) break; } }
    }
    printSummary(mode, results, datasetVersion);
    if (options.reportPath) writeReport(options.reportPath, { source: options.source, mode, datasetVersion, results: results.map((r) => ({ setId: r.setId, expectedCards: r.expectedCards, receivedCards: r.dryRun?.receivedCards, plannedWrites: r.dryRun?.plannedWrites, databaseWrites: r.dryRun?.databaseWrites, passed: Boolean(r.dryRun?.passed), error: r.error ?? r.dryRun?.error })) });
    return results.some((r) => r.error || [r.dryRun, r.write, r.idempotency].some((s) => s && !s.passed)) ? 1 : 0;
  } catch (error) { console.error('Catalog batch import'); console.error(`Mode: ${mode}`); console.error(`Fout: ${error instanceof Error ? error.message : 'Onbekende batchfout.'}`); return 1; }
}
main().then((exitCode) => { process.exitCode = exitCode; }).catch(() => { console.error('Onverwachte fout tijdens catalog batch import.'); process.exitCode = 1; });
