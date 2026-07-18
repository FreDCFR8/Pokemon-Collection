import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseCatalogBatchArgs, parseCatalogBatchConfigFromText, type CatalogBatchMode } from './import-batch-args.ts';
import { parseLocalCatalogManifestFromText, type LocalCatalogManifestSet } from './local-manifest.ts';
import { validateLocalDatasetCheckout } from './local-checkout.ts';
import { assertCheckpointIdentity, CHECKPOINT_SCHEMA_VERSION, checkpointExists, readCheckpoint, sha256File, supabaseProjectIdentity, writeAtomicJson, type CatalogBatchCheckpoint, type CheckpointIdentity, type CheckpointSet } from './checkpoint.ts';

type StepName = 'dry-run' | 'write' | 'idempotency';

type StepResult = {
  step: StepName;
  exitCode: number;
  output: string;
  passed: boolean;
  error?: string;
  expectedCards?: number;
  receivedCards?: number;
  plannedWrites?: number;
  databaseWrites?: number;
};

type SetResult = {
  setId: string;
  expectedCards?: number;
  dryRun?: StepResult;
  write?: StepResult;
  idempotency?: StepResult;
  error?: string;
};

type LocalBatchSelection = {
  datasetRepository: string;
  datasetVersion: string;
  sets: (LocalCatalogManifestSet & { inputPath: string })[];
};

type ReportStep = {
  name: StepName;
  passed: boolean;
  exitCode: number;
  expectedCards?: number;
  receivedCards?: number;
  plannedWrites?: number;
  databaseWrites?: number;
  error?: string;
};

type ReportSet = {
  setId: string;
  passed: boolean;
  expectedCards?: number;
  receivedCards?: number;
  plannedWrites?: number;
  databaseWrites?: number;
  error?: string;
  steps: ReportStep[];
};

function readNumberLine(output: string, label: string): number | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = output.match(new RegExp(`^${escaped}: (\\d+)$`, 'm'));
  return match ? Number(match[1]) : undefined;
}

function runImportSet(setId: string, write: boolean, inputPath?: string): StepResult {
  const step: StepName = write ? 'write' : 'dry-run';
  const args = [
    '--experimental-strip-types',
    process.env.CATALOG_IMPORT_SET_SCRIPT ?? 'scripts/catalog/import-set.ts',
    '--set',
    setId,
    ...(inputPath ? ['--source', 'pokemon_tcg_data', '--input', inputPath] : []),
    ...(write ? ['--write'] : []),
  ];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return validateStepOutput({ step, exitCode: result.status ?? 1, output });
}

function runIdempotency(setId: string): StepResult {
  const result = runImportSet(setId, false);
  return validateStepOutput({ step: 'idempotency', exitCode: result.exitCode, output: result.output });
}

function hasLine(output: string, pattern: RegExp): boolean {
  return output.split(/\r?\n/).some((line) => pattern.test(line.trim()));
}

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

  return {
    step: params.step,
    exitCode: params.exitCode,
    output: params.output,
    passed: errors.length === 0,
    ...(errors.length > 0 ? { error: errors.join(' ') } : {}),
    ...(expectedCards !== undefined ? { expectedCards } : {}),
    ...(receivedCards !== undefined ? { receivedCards } : {}),
    ...(plannedWrites !== undefined ? { plannedWrites } : {}),
    ...(databaseWrites !== undefined ? { databaseWrites } : {}),
  };
}

function executedSteps(result: SetResult): StepResult[] {
  return [result.dryRun, result.write, result.idempotency].filter((step): step is StepResult => Boolean(step));
}

function setPassed(result: SetResult): boolean {
  const steps = executedSteps(result);
  return !result.error && steps.length > 0 && steps.every((step) => step.passed);
}

function firstFailedStep(result: SetResult): StepResult | undefined {
  return executedSteps(result).find((step) => !step.passed);
}

function latestStep(result: SetResult): StepResult | undefined {
  return executedSteps(result).at(-1);
}

function stepStatuses(result: SetResult): string {
  const statuses = executedSteps(result).map((step) => `${step.step}=${step.passed ? 'PASS' : 'FAIL'}`);
  return statuses.length > 0 ? statuses.join(', ') : 'not-run';
}

function printStep(setId: string, result: StepResult): void {
  console.log(`\n=== ${setId} / ${result.step} ===`);
  process.stdout.write(result.output);
  if (!result.output.endsWith('\n')) console.log('');
  console.log(`Batch step: ${result.passed ? 'PASS' : 'FAIL'}`);
  if (result.error) console.log(`Batch validation: ${result.error}`);
}

function printSummary(params: { mode: CatalogBatchMode; results: SetResult[]; datasetRepository?: string; datasetVersion?: string }): void {
  const failed = params.results.filter((result) => !setPassed(result));
  console.log('\nCatalog batch summary');
  if (params.datasetRepository) console.log(`Dataset repository: ${params.datasetRepository}`);
  if (params.datasetVersion) console.log(`Dataset version: ${params.datasetVersion}`);
  console.log(`Mode: ${params.mode}`);
  console.log(`Sets planned: ${params.results.length}`);
  console.log(`Sets executed: ${params.results.filter((result) => executedSteps(result).length > 0).length}`);
  console.log(`Sets passed: ${params.results.length - failed.length}`);
  console.log(`Sets failed: ${failed.length}`);

  for (const result of params.results) {
    const displayStep = latestStep(result);
    const failedStep = firstFailedStep(result);
    const error = result.error ?? failedStep?.error;
    console.log(
      `- ${result.setId}: ${setPassed(result) ? 'PASS' : 'FAIL'}; steps=${stepStatuses(result)}; expected=${result.expectedCards ?? displayStep?.expectedCards ?? 'n/a'}; received=${displayStep?.receivedCards ?? 'n/a'}; planned_writes=${displayStep?.plannedWrites ?? 'n/a'}; database_writes=${displayStep?.databaseWrites ?? 'n/a'}${error ? `; error=${error}` : ''}`,
    );
  }
}

function readApiSetIds(options: ReturnType<typeof parseCatalogBatchArgs>): string[] {
  if (options.setIds) return options.setIds;
  return parseCatalogBatchConfigFromText(readFileSync(options.configPath, 'utf8')).sets;
}

function selectedLocalSets(options: ReturnType<typeof parseCatalogBatchArgs>): LocalBatchSelection {
  const manifest = parseLocalCatalogManifestFromText(readFileSync(options.manifestPath!, 'utf8'));
  const wanted = options.setIds ? new Set(options.setIds) : undefined;
  const sets = manifest.sets
    .filter((set) => set.enabled && (!wanted || wanted.has(set.setId)))
    .map((set) => ({ ...set, inputPath: resolve(options.inputRoot!, set.jsonPath) }));

  if (sets.length === 0) throw new Error('Geen actieve manifestsets geselecteerd voor uitvoering.');
  if (wanted) {
    for (const setId of wanted) {
      if (!manifest.sets.some((set) => set.setId === setId && set.enabled)) throw new Error(`Geselecteerde set ${setId} staat niet actief in het lokale manifest.`);
    }
  }
  for (const set of sets) {
    if (!existsSync(set.inputPath)) throw new Error(`Lokale JSON-input ontbreekt voor ${set.setId}: ${set.inputPath}`);
  }
  return { datasetRepository: manifest.datasetRepository, datasetVersion: manifest.datasetVersion, sets };
}

function localIdentity(local: LocalBatchSelection, manifestPath: string): CheckpointIdentity {
  return {
    checkpointSchemaVersion: CHECKPOINT_SCHEMA_VERSION,
    source: 'pokemon_tcg_data',
    mode: 'dry-run',
    datasetRepository: local.datasetRepository,
    datasetVersion: local.datasetVersion,
    manifestHash: sha256File(manifestPath),
    setIds: local.sets.map((set) => set.setId),
    supabaseProjectIdentity: supabaseProjectIdentity(process.env.SUPABASE_URL),
  };
}

function initialCheckpoint(identity: CheckpointIdentity, sets: LocalBatchSelection['sets'], now = new Date().toISOString()): CatalogBatchCheckpoint {
  return { ...identity, startedAt: now, updatedAt: now, sets: sets.map((set) => ({ setId: set.setId, expectedCards: set.expectedCards, status: 'pending' })) };
}

function saveCheckpoint(path: string, checkpoint: CatalogBatchCheckpoint): void {
  writeAtomicJson(path, { ...checkpoint, updatedAt: new Date().toISOString() });
}

function checkpointSetFromResult(result: SetResult, expectedCards: number): CheckpointSet {
  const step = latestStep(result);
  return {
    setId: result.setId,
    expectedCards,
    status: setPassed(result) ? 'passed' : 'failed',
    ...(step?.receivedCards !== undefined ? { receivedCards: step.receivedCards } : {}),
    ...(step?.plannedWrites !== undefined ? { plannedWrites: step.plannedWrites } : {}),
    ...(step?.databaseWrites !== undefined ? { databaseWrites: step.databaseWrites } : {}),
    ...((result.error ?? firstFailedStep(result)?.error) ? { error: result.error ?? firstFailedStep(result)?.error } : {}),
  };
}

function setResultFromCheckpoint(set: CheckpointSet): SetResult {
  return { setId: set.setId, expectedCards: set.expectedCards, error: set.error, dryRun: set.status === 'passed' ? {
    step: 'dry-run', exitCode: 0, output: '', passed: true,
    ...(set.receivedCards !== undefined ? { receivedCards: set.receivedCards } : {}),
    ...(set.plannedWrites !== undefined ? { plannedWrites: set.plannedWrites } : {}),
    ...(set.databaseWrites !== undefined ? { databaseWrites: set.databaseWrites } : {}),
  } : undefined };
}

function checkpointSet(checkpoint: CatalogBatchCheckpoint, setId: string): CheckpointSet {
  const set = checkpoint.sets.find((item) => item.setId === setId);
  if (!set) throw new Error(`Checkpoint mist set ${setId}.`);
  return set;
}

function reportTotals(results: SetResult[]): { expectedCardsTotal: number; receivedCardsTotal: number; plannedWritesTotal: number; databaseWritesTotal: number } {
  return results.reduce((totals, result) => {
    const step = latestStep(result);
    return {
      expectedCardsTotal: totals.expectedCardsTotal + (result.expectedCards ?? 0),
      receivedCardsTotal: totals.receivedCardsTotal + (step?.receivedCards ?? 0),
      plannedWritesTotal: totals.plannedWritesTotal + (step?.plannedWrites ?? 0),
      databaseWritesTotal: totals.databaseWritesTotal + (step?.databaseWrites ?? 0),
    };
  }, { expectedCardsTotal: 0, receivedCardsTotal: 0, plannedWritesTotal: 0, databaseWritesTotal: 0 });
}

function toReportStep(step: StepResult): ReportStep {
  return {
    name: step.step,
    exitCode: step.exitCode,
    passed: step.passed,
    ...(step.expectedCards !== undefined ? { expectedCards: step.expectedCards } : {}),
    ...(step.receivedCards !== undefined ? { receivedCards: step.receivedCards } : {}),
    ...(step.plannedWrites !== undefined ? { plannedWrites: step.plannedWrites } : {}),
    ...(step.databaseWrites !== undefined ? { databaseWrites: step.databaseWrites } : {}),
    ...(step.error ? { error: step.error } : {}),
  };
}

function toReportSet(result: SetResult): ReportSet {
  const displayStep = latestStep(result);
  const error = result.error ?? firstFailedStep(result)?.error;
  return {
    setId: result.setId,
    passed: setPassed(result),
    ...(result.expectedCards !== undefined || displayStep?.expectedCards !== undefined ? { expectedCards: result.expectedCards ?? displayStep?.expectedCards } : {}),
    ...(displayStep?.receivedCards !== undefined ? { receivedCards: displayStep.receivedCards } : {}),
    ...(displayStep?.plannedWrites !== undefined ? { plannedWrites: displayStep.plannedWrites } : {}),
    ...(displayStep?.databaseWrites !== undefined ? { databaseWrites: displayStep.databaseWrites } : {}),
    ...(error ? { error } : {}),
    steps: executedSteps(result).map(toReportStep),
  };
}

function writeReport(path: string, report: unknown): void {
  writeAtomicJson(path, report);
}

async function main(): Promise<number> {
  const results: SetResult[] = [];
  let mode: CatalogBatchMode = 'dry-run';
  let datasetRepository: string | undefined;
  let datasetVersion: string | undefined;

  try {
    const options = parseCatalogBatchArgs(process.argv.slice(2));
    mode = options.mode;
    console.log('Catalog batch import');
    console.log(`Source: ${options.source}`);
    console.log(`Mode: ${mode}`);

    if (options.source === 'pokemon_tcg_data') {
      const local = selectedLocalSets(options);
      validateLocalDatasetCheckout(options.inputRoot!);
      datasetRepository = local.datasetRepository;
      datasetVersion = local.datasetVersion;
      console.log(`Dataset repository: ${datasetRepository}`);
      console.log(`Dataset version: ${datasetVersion}`);
      console.log(`Sets: ${local.sets.map((set) => set.setId).join(', ')}`);

      const identity = localIdentity(local, options.manifestPath!);
      let checkpoint: CatalogBatchCheckpoint | undefined;
      if (options.checkpointPath) {
        if (options.resume) {
          if (!checkpointExists(options.checkpointPath)) throw new Error(`--resume vereist een bestaand checkpoint: ${options.checkpointPath}`);
          checkpoint = readCheckpoint(options.checkpointPath);
          assertCheckpointIdentity(checkpoint, identity);
        } else {
          if (checkpointExists(options.checkpointPath)) throw new Error(`Checkpoint bestaat al; gebruik --resume om het te hervatten: ${options.checkpointPath}`);
          checkpoint = initialCheckpoint(identity, local.sets);
          saveCheckpoint(options.checkpointPath, checkpoint);
        }
      }

      const checkpointResults = checkpoint?.sets.map(setResultFromCheckpoint) ?? [];
      results.push(...checkpointResults);
      let setsExecutedThisInvocation = 0;
      let setsSkippedFromCheckpoint = 0;
      for (const set of local.sets) {
        const saved = checkpoint ? checkpointSet(checkpoint, set.setId) : undefined;
        if (saved?.status === 'passed') { setsSkippedFromCheckpoint += 1; continue; }
        const result: SetResult = { setId: set.setId, expectedCards: set.expectedCards };
        const existingIndex = results.findIndex((item) => item.setId === set.setId);
        if (existingIndex >= 0) results[existingIndex] = result; else results.push(result);
        setsExecutedThisInvocation += 1;
        if (checkpoint) {
          saved!.status = 'running';
          delete saved!.error;
          saveCheckpoint(options.checkpointPath!, checkpoint);
        }
        result.dryRun = runImportSet(set.setId, false, set.inputPath);
        if (result.dryRun.receivedCards !== set.expectedCards) {
          result.dryRun.passed = false;
          result.dryRun.error = `${result.dryRun.error ? `${result.dryRun.error} ` : ''}Expected/received mismatch: manifest=${set.expectedCards}, importer=${result.dryRun.receivedCards ?? 'unknown'}.`;
        }
        if (result.dryRun.databaseWrites !== 0) {
          result.dryRun.passed = false;
          result.dryRun.error = `${result.dryRun.error ? `${result.dryRun.error} ` : ''}Lokale dry-run rapporteert databasewrites != 0.`;
        }
        printStep(set.setId, result.dryRun);
        if (checkpoint) {
          const updated = checkpointSetFromResult(result, set.expectedCards);
          const index = checkpoint.sets.findIndex((item) => item.setId === set.setId);
          checkpoint.sets[index] = updated;
          saveCheckpoint(options.checkpointPath!, checkpoint);
        }
      }
      const totals = reportTotals(results);
      const statuses = checkpoint?.sets ?? results.map((result) => checkpointSetFromResult(result, result.expectedCards ?? 0));
      const localReport = {
        checkpointSchemaVersion: CHECKPOINT_SCHEMA_VERSION,
        source: options.source,
        mode,
        datasetRepository: local.datasetRepository,
        datasetVersion: local.datasetVersion,
        manifestHash: identity.manifestHash,
        supabaseProjectIdentity: identity.supabaseProjectIdentity,
        startedAt: checkpoint?.startedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        setsPlanned: local.sets.length,
        setsExecutedThisInvocation,
        setsSkippedFromCheckpoint,
        setsPassed: statuses.filter((set) => set.status === 'passed').length,
        setsFailed: statuses.filter((set) => set.status === 'failed').length,
        setsPending: statuses.filter((set) => set.status === 'pending' || set.status === 'running').length,
        ...totals,
        status: statuses.every((set) => set.status === 'passed') && totals.expectedCardsTotal === totals.receivedCardsTotal && totals.databaseWritesTotal === 0 ? 'PASS' : 'FAIL',
        results: statuses.map((set) => ({ setId: set.setId, status: set.status, expectedCards: set.expectedCards, ...(set.receivedCards !== undefined ? { receivedCards: set.receivedCards } : {}), ...(set.plannedWrites !== undefined ? { plannedWrites: set.plannedWrites } : {}), ...(set.databaseWrites !== undefined ? { databaseWrites: set.databaseWrites } : {}), ...(set.error ? { error: set.error } : {}) })),
      };
      if (options.reportPath) writeReport(options.reportPath, localReport);
      printSummary({ mode, results, datasetRepository, datasetVersion });
      return localReport.status === 'PASS' ? 0 : 1;
    } else {
      const setIds = readApiSetIds(options);
      console.log(`Sets: ${setIds.join(', ')}`);
      for (const setId of setIds) {
        const result: SetResult = { setId };
        results.push(result);
        result.dryRun = runImportSet(setId, false);
        printStep(setId, result.dryRun);
        if (!result.dryRun.passed) break;

        if (mode === 'write-approved') {
          result.write = runImportSet(setId, true);
          printStep(setId, result.write);
          if (!result.write.passed) break;

          result.idempotency = runIdempotency(setId);
          printStep(setId, result.idempotency);
          if (!result.idempotency.passed) break;
        }
      }
    }

    printSummary({ mode, results, datasetRepository, datasetVersion });
    if (options.reportPath) {
      writeReport(options.reportPath, {
        source: options.source,
        mode,
        ...(datasetRepository ? { datasetRepository } : {}),
        ...(datasetVersion ? { datasetVersion } : {}),
        results: results.map(toReportSet),
      });
    }
    return results.some((result) => !setPassed(result)) ? 1 : 0;
  } catch (error) {
    console.error('Catalog batch import');
    console.error(`Mode: ${mode}`);
    console.error(`Fout: ${error instanceof Error ? error.message : 'Onbekende batchfout.'}`);
    return 1;
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch(() => {
    console.error('Onverwachte fout tijdens catalog batch import.');
    process.exitCode = 1;
  });
