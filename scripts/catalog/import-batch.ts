import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseCatalogBatchArgs, parseCatalogBatchConfigFromText, type CatalogBatchMode } from './import-batch-args.ts';
import { parseLocalCatalogManifestFromText, type LocalCatalogManifestSet } from './local-manifest.ts';
import { validateLocalDatasetCheckout } from './local-checkout.ts';
import { assertCheckpointIdentity, CHECKPOINT_SCHEMA_VERSION, checkpointExists, readCheckpoint, sha256File, supabaseProjectIdentity, writeAtomicJson, type CatalogBatchCheckpoint, type CheckpointIdentity, type CheckpointSet } from './checkpoint.ts';
import { readDiagnosticResult, type SingleSetDiagnosticResult } from './diagnostic-result.ts';

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
  diagnostic?: SingleSetDiagnosticResult;
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
  diagnostic?: SingleSetDiagnosticResult;
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
  diagnostic?: Omit<SingleSetDiagnosticResult, 'schemaVersion'>;
};

function runImportSet(setId: string, write: boolean, inputPath?: string, stepOverride?: StepName, setMetadata?: { name: string; series: string }, expectedCards?: number): StepResult {
  const step: StepName = stepOverride ?? (write ? 'write' : 'dry-run');
  const resultPath = join(tmpdir(), `pokemon-catalog-diagnostic-${process.pid}-${Date.now()}-${setId}-${step}.json`);
  const args = [
    '--experimental-strip-types',
    process.env.CATALOG_IMPORT_SET_SCRIPT ?? 'scripts/catalog/import-set.ts',
    '--set',
    setId,
    ...(inputPath ? ['--source', 'pokemon_tcg_data', '--input', inputPath] : []),
    ...(setMetadata ? ['--set-name', setMetadata.name, '--set-series', setMetadata.series] : []),
    ...(write ? ['--write'] : []),
    '--diagnostic-result', resultPath,
  ];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  try {
    if (!existsSync(resultPath)) return failClosedStep({ setId, step, exitCode: result.status ?? 1, output, error: 'Subprocessresultaat ontbreekt.' });
    const diagnostic = readDiagnosticResult(resultPath);
    if (diagnostic.setId !== setId) throw new Error('Diagnostisch resultaat hoort bij een andere set.');
    if (expectedCards !== undefined && diagnostic.expectedCards !== expectedCards) throw new Error('Diagnostisch expectedCards komt niet overeen met het manifest.');
    return validateStepOutput({ step, exitCode: result.status ?? 1, output, diagnostic });
  } catch (error) {
    return failClosedStep({ setId, step, exitCode: result.status ?? 1, output, error: error instanceof Error ? error.message : 'Ongeldig subprocessresultaat.' });
  } finally {
    try { rmSync(resultPath, { force: true }); } catch { /* diagnostiek is al ingelezen */ }
  }
}

function runIdempotency(setId: string): StepResult {
  return runImportSet(setId, false, undefined, 'idempotency');
}

function failClosedStep(params: { setId: string; step: StepName; exitCode: number; output: string; error: string }): StepResult {
  const diagnostic: SingleSetDiagnosticResult = { schemaVersion: 1, setId: params.setId, status: 'FAIL', receivedCards: 0, setMappingStatus: 'no_candidate', setMapping: { status: 'no_candidate', candidates: [], evidence: [] }, externalReferenceMatches: 0, fallbackCandidates: 0, newCards: 0, ambiguousItems: 0, conflicts: 0, unresolvedWithoutSetMapping: 0, metadataUnchanged: 0, metadataChanged: 0, blockedItems: 0, plannedDatabaseWrites: 0, databaseWrites: 0, failureReasons: ['unexpected_runner_failure'], examples: { unexpected_runner_failure: [{ reason: params.error }] } };
  return { step: params.step, exitCode: params.exitCode, output: params.output, passed: false, error: `${params.error} failureCode=unexpected_runner_failure`, databaseWrites: 0, diagnostic };
}

function validateStepOutput(params: { step: StepName; exitCode: number; output: string; diagnostic: SingleSetDiagnosticResult }): StepResult {
  const errors: string[] = [];
  const unexpectedRunnerFailure = new Set<string>();
  const { diagnostic } = params;
  const expectedCards = diagnostic.expectedCards;
  const receivedCards = diagnostic.receivedCards;
  const plannedWrites = diagnostic.plannedDatabaseWrites;
  const databaseWrites = diagnostic.databaseWrites;

  if (params.exitCode !== 0) errors.push(`exitcode ${params.exitCode}`);
  if (diagnostic.status !== (params.exitCode === 0 ? 'PASS' : 'FAIL')) {
    errors.push('JSON-status komt niet overeen met exitcode.');
    unexpectedRunnerFailure.add('status/exitcode mismatch');
  }

  if (params.step === 'dry-run') {
    if (diagnostic.databaseWrites !== 0) {
      errors.push('Dry-run bevat databasewrites groter dan nul.');
      unexpectedRunnerFailure.add('dry-run databaseWrites != 0');
    }
  }

  if (params.step === 'write') {
    if (diagnostic.databaseWrites < 0) errors.push('Write rapporteert een ongeldige databasewrites-teller.');
  }

  if (params.step === 'idempotency') {
    if (diagnostic.newCards !== 0) errors.push('Idempotency vond nog nieuwe kaarten.');
    if (diagnostic.plannedDatabaseWrites !== 0) errors.push('Idempotency plant nog writes.');
    if (diagnostic.databaseWrites !== 0) {
      errors.push('Idempotency bevat databasewrites groter dan nul.');
      unexpectedRunnerFailure.add('idempotency databaseWrites != 0');
    }
  }

  if (unexpectedRunnerFailure.size > 0 && !diagnostic.failureReasons.includes('unexpected_runner_failure')) {
    diagnostic.failureReasons = [...diagnostic.failureReasons, 'unexpected_runner_failure'];
    diagnostic.status = 'FAIL';
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
    diagnostic,
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

function markCheckpointSetRunning(checkpoint: CatalogBatchCheckpoint, setId: string): void {
  const index = checkpoint.sets.findIndex((set) => set.setId === setId);
  if (index < 0) throw new Error(`Checkpoint mist set ${setId}.`);
  const current = checkpoint.sets[index];
  checkpoint.sets[index] = { setId: current.setId, expectedCards: current.expectedCards, status: 'running' };
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
    ...(step?.diagnostic ? { diagnostic: step.diagnostic } : {}),
    ...((result.error ?? firstFailedStep(result)?.error) ? { error: result.error ?? firstFailedStep(result)?.error } : {}),
  };
}

function setResultFromCheckpoint(set: CheckpointSet): SetResult {
  return { setId: set.setId, expectedCards: set.expectedCards, error: set.error, dryRun: set.status === 'passed' || set.status === 'failed' ? {
    step: 'dry-run', exitCode: set.status === 'passed' ? 0 : 1, output: '', passed: set.status === 'passed',
    ...(set.receivedCards !== undefined ? { receivedCards: set.receivedCards } : {}),
    ...(set.plannedWrites !== undefined ? { plannedWrites: set.plannedWrites } : {}),
    ...(set.databaseWrites !== undefined ? { databaseWrites: set.databaseWrites } : {}),
    ...(set.diagnostic ? { diagnostic: set.diagnostic } : {}),
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
    ...(step.diagnostic ? { diagnostic: step.diagnostic } : {}),
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
    ...(displayStep?.diagnostic ? { diagnostic: displayStep.diagnostic } : {}),
    steps: executedSteps(result).map(toReportStep),
  };
}

function reportClassifications(results: SetResult[]): { failureReasonsTotal: Record<string, number>; setMappingStatusTotal: Record<string, number>; operationalSetsProcessed: number; contentPassSets: number; contentBlockedSets: number; runnerFailureSets: number } {
  const failureReasonsTotal: Record<string, number> = {};
  const setMappingStatusTotal: Record<string, number> = {};
  let operationalSetsProcessed = 0;
  let contentPassSets = 0;
  let contentBlockedSets = 0;
  let runnerFailureSets = 0;
  for (const result of results) {
    const step = latestStep(result);
    if (!step) continue;
    operationalSetsProcessed += 1;
    if (step.diagnostic?.setMappingStatus) setMappingStatusTotal[step.diagnostic.setMappingStatus] = (setMappingStatusTotal[step.diagnostic.setMappingStatus] ?? 0) + 1;
    const reasons = step.diagnostic?.failureReasons ?? (step.error?.includes('failureCode=unexpected_runner_failure') ? ['unexpected_runner_failure'] : []);
    const runnerFailure = reasons.includes('unexpected_runner_failure');
    if (runnerFailure) runnerFailureSets += 1;
    else if (setPassed(result)) contentPassSets += 1;
    else contentBlockedSets += 1;
    for (const reason of reasons) failureReasonsTotal[reason] = (failureReasonsTotal[reason] ?? 0) + 1;
  }
  return { failureReasonsTotal, setMappingStatusTotal, operationalSetsProcessed, contentPassSets, contentBlockedSets, runnerFailureSets };
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
      const localStartedAt = new Date().toISOString();
      const local = selectedLocalSets(options);
      validateLocalDatasetCheckout(options.inputRoot!, local.datasetVersion);
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
          assertCheckpointIdentity(checkpoint, identity, local.sets.map((set) => ({ setId: set.setId, expectedCards: set.expectedCards })));
        } else {
          if (checkpointExists(options.checkpointPath)) throw new Error(`Checkpoint bestaat al; gebruik --resume om het te hervatten: ${options.checkpointPath}`);
          checkpoint = initialCheckpoint(identity, local.sets, localStartedAt);
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
          markCheckpointSetRunning(checkpoint, set.setId);
          saveCheckpoint(options.checkpointPath!, checkpoint);
        }
        result.dryRun = runImportSet(set.setId, false, set.inputPath, undefined, { name: set.name, series: set.series }, set.expectedCards);
        if (result.dryRun.receivedCards !== set.expectedCards) {
          result.dryRun.passed = false;
          if (result.dryRun.diagnostic) result.dryRun.diagnostic.failureReasons = [...new Set([...result.dryRun.diagnostic.failureReasons, 'input_validation_failure'])];
          result.dryRun.error = `${result.dryRun.error ? `${result.dryRun.error} ` : ''}Expected/received mismatch: manifest=${set.expectedCards}, importer=${result.dryRun.receivedCards ?? 'unknown'}.`;
        }
        if (result.dryRun.databaseWrites !== 0) {
          result.dryRun.passed = false;
          if (result.dryRun.diagnostic) result.dryRun.diagnostic.failureReasons = [...new Set([...result.dryRun.diagnostic.failureReasons, 'unexpected_runner_failure'])];
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
      const classifications = reportClassifications(results);
      const reportResults = results.map(toReportSet);
      const localReport = {
        checkpointSchemaVersion: CHECKPOINT_SCHEMA_VERSION,
        source: options.source,
        mode,
        datasetRepository: local.datasetRepository,
        datasetVersion: local.datasetVersion,
        manifestHash: identity.manifestHash,
        supabaseProjectIdentity: identity.supabaseProjectIdentity,
        startedAt: checkpoint?.startedAt ?? localStartedAt,
        updatedAt: new Date().toISOString(),
        setsPlanned: local.sets.length,
        setsExecutedThisInvocation,
        setsSkippedFromCheckpoint,
        setsPassed: statuses.filter((set) => set.status === 'passed').length,
        setsFailed: statuses.filter((set) => set.status === 'failed').length,
        setsPending: statuses.filter((set) => set.status === 'pending' || set.status === 'running').length,
        ...classifications,
        ...totals,
        status: statuses.every((set) => set.status === 'passed') && totals.expectedCardsTotal === totals.receivedCardsTotal && totals.databaseWritesTotal === 0 ? 'PASS' : 'FAIL',
        results: reportResults,
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
