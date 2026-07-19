import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseCatalogBatchArgs, parseCatalogBatchConfigFromText, type CatalogBatchMode } from './import-batch-args.ts';
import { parseLocalCatalogManifestFromText, type LocalCatalogManifestSet } from './local-manifest.ts';
import { validateLocalDatasetCheckout } from './local-checkout.ts';
import { assertCheckpointIdentity, CHECKPOINT_SCHEMA_VERSION, checkpointExists, readCheckpoint, supabaseProjectIdentity, writeAtomicJson, type CatalogBatchCheckpoint, type CheckpointIdentity, type CheckpointSet } from './checkpoint.ts';
import { addDiagnosticFailure, assertValidDiagnosticResult, classifyDiagnosticOutcome, readDiagnosticResult, type SingleSetDiagnosticResult } from './diagnostic-result.ts';
import { createClient } from '@supabase/supabase-js';
import { analysisHash, reportHash } from './catalog-report-identity.ts';
import { localManifestIdentityFromText } from './catalog-manifest-identity.ts';
import { validateCatalogWritePlan, type CatalogWritePlan } from './catalog-write-plan.ts';
import { deriveImportLifecycle, ImportLifecycleTracker, type ImportLifecycleState } from './import-lifecycle.ts';
import { batchSetConfigurationFromReport, classifyDynamicPrecheck, expectedPostWriteCounts, PhaseAReportValidationError, type CatalogTableCounts } from './catalog-batch-validation.ts';
import type { CatalogBatchApproval } from './import-args.ts';

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
  lifecycle?: ImportLifecycleState;
};

type SetResult = {
  setId: string;
  expectedCards?: number;
  dryRun?: StepResult;
  write?: StepResult;
  idempotency?: StepResult;
  error?: string;
  lifecycle?: ImportLifecycleState;
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
  lifecycle: ImportLifecycleState;
  diagnostic?: Omit<SingleSetDiagnosticResult, 'schemaVersion'>;
};

function runImportSet(setId: string, write: boolean, inputPath?: string, stepOverride?: StepName, setMetadata?: { name: string; series: string }, expectedCards?: number, batchApproval?: CatalogBatchApproval, writePlanPath?: string, reconcile = false, lifecycle?: ImportLifecycleTracker): StepResult {
  const step: StepName = stepOverride ?? (write ? 'write' : 'dry-run');
  if (write) lifecycle?.startWrite();
  const resultPath = join(tmpdir(), `pokemon-catalog-diagnostic-${process.pid}-${Date.now()}-${setId}-${step}.json`);
  const args = [
    '--experimental-strip-types',
    process.env.CATALOG_IMPORT_SET_SCRIPT ?? 'scripts/catalog/import-set.ts',
    '--set',
    setId,
    ...(inputPath ? ['--source', 'pokemon_tcg_data', '--input', inputPath] : []),
    ...(setMetadata ? ['--set-name', setMetadata.name, '--set-series', setMetadata.series] : []),
    ...(write ? ['--write'] : []),
    ...(step === 'idempotency' ? ['--idempotency'] : []),
    ...(batchApproval ? ['--batch-approval', batchApproval] : []),
    ...(writePlanPath ? ['--write-plan', writePlanPath] : []),
    ...(reconcile ? ['--reconcile'] : []),
    '--diagnostic-result', resultPath,
  ];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  try {
    if (!existsSync(resultPath)) {
      const failed = failClosedStep({ setId, step, exitCode: result.status ?? 1, output, error: 'Subprocessresultaat ontbreekt.' });
      if (write) lifecycle?.fail(failed.databaseWrites ?? 0);
      return { ...failed, lifecycle: lifecycle?.state };
    }
    const diagnostic = readDiagnosticResult(resultPath);
    if (diagnostic.setId !== setId) throw new Error('Diagnostisch resultaat hoort bij een andere set.');
    if (expectedCards !== undefined && diagnostic.expectedCards !== expectedCards) throw new Error('Diagnostisch expectedCards komt niet overeen met het manifest.');
    const validated = validateStepOutput({ step, exitCode: result.status ?? 1, output, diagnostic });
    if (write) validated.passed ? lifecycle?.completeWrite() : lifecycle?.fail(validated.databaseWrites ?? 0);
    return { ...validated, lifecycle: lifecycle?.state };
  } catch (error) {
    const failed = failClosedStep({ setId, step, exitCode: result.status ?? 1, output, error: error instanceof Error ? error.message : 'Ongeldig subprocessresultaat.' });
    if (write) lifecycle?.fail(failed.databaseWrites ?? 0);
    return { ...failed, lifecycle: lifecycle?.state };
  } finally {
    try { rmSync(resultPath, { force: true }); } catch { /* diagnostiek is al ingelezen */ }
  }
}

type TableCounts = CatalogTableCounts;

export function validateApprovedDryRunReportText(text: string): Record<string, any> {
  let report: any;
  try { report = JSON.parse(text); } catch { throw new Error('Goedgekeurd dry-runrapport is geen geldige JSON.'); }
  const suppliedReportHash = report?.reportHash;
  const suppliedAnalysisHash = report?.analysisHash;
  if (typeof suppliedReportHash !== 'string' || reportHash(report) !== suppliedReportHash) throw new Error('reportHash van het goedgekeurde dry-runrapport komt niet overeen.');
  if (typeof suppliedAnalysisHash !== 'string' || analysisHash(report) !== suppliedAnalysisHash) throw new Error('analysisHash van het goedgekeurde dry-runrapport komt niet overeen.');
  if (!Object.prototype.hasOwnProperty.call(report, 'source') || report.source !== 'pokemon_tcg_data' || report.finalStatus !== 'PASS') throw new Error('Goedgekeurd dry-runrapport heeft geen geldige lokale PASS-identiteit.');
  batchSetConfigurationFromReport(report);
  const batch = typeof report.batch === 'string' ? report.batches.find((item: { name?: unknown }) => item.name === report.batch) : undefined;
  if (!batch || report.setsPlanned !== batch.setIds.length || report.setsProcessed !== report.setsPlanned || report.expectedCardsTotal !== report.receivedCardsTotal) throw new Error('Goedgekeurd dry-runrapport bevat inconsistente batch- of kaarttotalen.');
  if (!report.theoreticalWrites || !Number.isInteger(report.theoreticalWrites.cardsCatalog) || !Number.isInteger(report.theoreticalWrites.cardExternalReferences) || report.theoreticalWrites.total !== report.theoreticalWrites.cardsCatalog + report.theoreticalWrites.cardExternalReferences) throw new Error('Goedgekeurd dry-runrapport mist dynamische write-totalen.');
  if (report.databaseWritesTotal !== 0 || report.actualWrites !== 0 || report.conflicts?.total !== 0 || report.operationalErrors?.length !== 0 || report.setsBlocked !== 0 || report.setsNeedsManualReview !== 0) throw new Error('Goedgekeurd dry-runrapport bevat conflicten, fouten of databasewrites.');
  return report;
}

function readApprovedReport(path: string): Record<string, any> {
  if (!existsSync(path)) throw new Error(`Goedgekeurd dry-runrapport ontbreekt: ${path}`);
  return validateApprovedDryRunReportText(readFileSync(path, 'utf8'));
}

function readApprovedWritePlan(path: string, local: LocalBatchSelection, manifestHash: string, sourceReportHash: string): CatalogWritePlan {
  if (!existsSync(path)) throw new Error(`Goedgekeurd writeplan ontbreekt: ${path}`);
  let value: unknown;
  try { value = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new Error('Goedgekeurd writeplan is geen geldige JSON.'); }
  return validateCatalogWritePlan(value, { datasetVersion: local.datasetVersion, datasetCommit: local.datasetVersion, manifestHash, sourceReportHash, sets: local.sets.map((set) => set.setId) });
}

async function readTableCounts(): Promise<TableCounts> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist voor lokale write-prechecks.');
  const supabase = createClient(url, key);
  const tables: (keyof TableCounts)[] = ['cards_catalog', 'card_external_references', 'collection_cards', 'sets_catalog', 'set_external_references'];
  const entries = await Promise.all(tables.map(async (table) => {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
    if (error || count === null) throw new Error(`Supabase read-only precheck mislukt voor ${table}.`);
    return [table, count] as const;
  }));
  return Object.fromEntries(entries) as TableCounts;
}

function approvedInitialCounts(value: unknown): TableCounts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Goedgekeurd dry-runrapport mist een geldige oorspronkelijke database-nulmeting.');
  const counts = value as Partial<TableCounts>;
  for (const table of Object.keys(counts) as (keyof TableCounts)[]) if (!Number.isInteger(counts[table]) || (counts[table] as number) < 0) throw new Error(`Goedgekeurd dry-runrapport mist een geldige oorspronkelijke count voor ${table}.`);
  for (const table of ['cards_catalog', 'card_external_references', 'collection_cards', 'sets_catalog', 'set_external_references'] as (keyof TableCounts)[]) if (!Number.isInteger(counts[table]) || (counts[table] as number) < 0) throw new Error(`Goedgekeurd dry-runrapport mist een geldige oorspronkelijke count voor ${table}.`);
  return counts as TableCounts;
}

function alreadyAppliedStep(setId: string, expectedCards: number): StepResult {
  const diagnostic: SingleSetDiagnosticResult = { schemaVersion: 1, setId, status: 'PASS', expectedCards, receivedCards: expectedCards, setMappingStatus: 'already_reliable', setMapping: { status: 'already_reliable', candidates: [], evidence: ['already_applied_precheck'] }, externalReferenceMatches: expectedCards, fallbackCandidatesQueried: 0, safeFallbackCandidates: 0, newCards: 0, ambiguousItems: 0, conflicts: 0, unresolvedWithoutSetMapping: 0, metadataUnchanged: expectedCards, metadataChanged: 0, blockedItems: 0, plannedDatabaseWrites: 0, databaseWrites: 0, failureReasons: [], examples: {} };
  return { step: 'write', exitCode: 0, output: 'Write overgeslagen: batch al volledig toegepast; databaseWrites=0', passed: true, expectedCards, receivedCards: expectedCards, plannedWrites: 0, databaseWrites: 0, diagnostic };
}

function runIdempotency(setId: string, inputPath: string, setMetadata: { name: string; series: string }, expectedCards: number, writePlanPath: string): StepResult {
  return runImportSet(setId, false, inputPath, 'idempotency', setMetadata, expectedCards, undefined, writePlanPath);
}

function runApiIdempotency(setId: string): StepResult {
  return runImportSet(setId, false, undefined, 'idempotency');
}

function failClosedStep(params: { setId: string; step: StepName; exitCode: number; output: string; error: string }): StepResult {
  const diagnostic: SingleSetDiagnosticResult = { schemaVersion: 1, setId: params.setId, status: 'FAIL', receivedCards: 0, setMappingStatus: 'no_candidate', setMapping: { status: 'no_candidate', candidates: [], evidence: [] }, externalReferenceMatches: 0, fallbackCandidatesQueried: 0, safeFallbackCandidates: 0, newCards: 0, ambiguousItems: 0, conflicts: 0, unresolvedWithoutSetMapping: 0, metadataUnchanged: 0, metadataChanged: 0, blockedItems: 0, plannedDatabaseWrites: 0, databaseWrites: 0, failureReasons: ['unexpected_runner_failure'], examples: { unexpected_runner_failure: [{ reason: params.error }] } };
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

  if (params.exitCode !== 0) {
    errors.push(`exitcode ${params.exitCode}`);
    const subprocessReasons = Object.values(diagnostic.examples).flat().map((example) => example.reason).filter((reason): reason is string => typeof reason === 'string' && reason.length > 0);
    if (subprocessReasons.length > 0) errors.push(`subprocessfout: ${[...new Set(subprocessReasons)].join(' | ')}`);
  }
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

  const finalDiagnostic = unexpectedRunnerFailure.size > 0 ? addDiagnosticFailure(diagnostic, 'unexpected_runner_failure') : diagnostic;
  assertValidDiagnosticResult(finalDiagnostic);

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
    diagnostic: finalDiagnostic,
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
  const manifestIdentity = localManifestIdentityFromText(readFileSync(manifestPath, 'utf8'));
  return {
    checkpointSchemaVersion: CHECKPOINT_SCHEMA_VERSION,
    source: 'pokemon_tcg_data',
    mode: 'dry-run',
    datasetRepository: local.datasetRepository,
    datasetVersion: local.datasetVersion,
    manifestHash: manifestIdentity.manifestHash,
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

function reportTotals(results: SetResult[]): { expectedCardsTotal: number; receivedCardsTotal: number; plannedWritesTotal: number; databaseWritesTotal: number; fallbackCandidatesQueriedTotal: number; safeFallbackCandidatesTotal: number } {
  return results.reduce((totals, result) => {
    const step = latestStep(result);
    return {
      expectedCardsTotal: totals.expectedCardsTotal + (result.expectedCards ?? 0),
      receivedCardsTotal: totals.receivedCardsTotal + (step?.receivedCards ?? 0),
      plannedWritesTotal: totals.plannedWritesTotal + (step?.plannedWrites ?? 0),
      databaseWritesTotal: totals.databaseWritesTotal + (step?.databaseWrites ?? 0),
      fallbackCandidatesQueriedTotal: totals.fallbackCandidatesQueriedTotal + (step?.diagnostic?.fallbackCandidatesQueried ?? 0),
      safeFallbackCandidatesTotal: totals.safeFallbackCandidatesTotal + (step?.diagnostic?.safeFallbackCandidates ?? 0),
    };
  }, { expectedCardsTotal: 0, receivedCardsTotal: 0, plannedWritesTotal: 0, databaseWritesTotal: 0, fallbackCandidatesQueriedTotal: 0, safeFallbackCandidatesTotal: 0 });
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
    lifecycle: result.lifecycle ?? deriveImportLifecycle({ writeStarted: Boolean(result.write), writeCompleted: result.write?.passed === true, reconciliationCompleted: result.idempotency?.passed === true, actualWrites: result.write?.databaseWrites ?? 0 }),
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
    const outcome = step.diagnostic ? classifyDiagnosticOutcome(step.diagnostic) : reasons.includes('unexpected_runner_failure') ? 'runner_failure' : setPassed(result) ? 'content_pass' : 'content_blocked';
    if (outcome === 'runner_failure') runnerFailureSets += 1;
    else if (outcome === 'content_pass') contentPassSets += 1;
    else contentBlockedSets += 1;
    for (const reason of reasons) failureReasonsTotal[reason] = (failureReasonsTotal[reason] ?? 0) + 1;
  }
  return { failureReasonsTotal, setMappingStatusTotal, operationalSetsProcessed, contentPassSets, contentBlockedSets, runnerFailureSets };
}

function writeReport(path: string, report: unknown): void {
  writeAtomicJson(path, report);
}

export async function main(): Promise<number> {
  const results: SetResult[] = [];
  let mode: CatalogBatchMode = 'dry-run';
  let datasetRepository: string | undefined;
  let datasetVersion: string | undefined;
  let failureReportPath: string | undefined;

  try {
    const options = parseCatalogBatchArgs(process.argv.slice(2));
    failureReportPath = options.reportPath;
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
      const approvedReport = options.mode === 'write-approved' ? readApprovedReport(options.approvedDryRunReportPath!) : undefined;
      const approvedPlan = options.mode === 'write-approved' ? readApprovedWritePlan(options.writePlanPath!, local, identity.manifestHash, approvedReport!.reportHash) : undefined;
      const approvedBatchConfiguration = approvedReport ? batchSetConfigurationFromReport(approvedReport) : undefined;
      const approvedBatchSetIds = approvedReport && approvedBatchConfiguration ? approvedBatchConfiguration.batches.find((batch) => batch.name === approvedReport.batch)?.setIds : undefined;
      if (options.mode === 'write-approved' && (!approvedBatchSetIds || JSON.stringify(approvedBatchSetIds) !== JSON.stringify(local.sets.map((set) => set.setId)))) throw new Error('Actuele lokale selectie wijkt af van de officiële batch-setlijst uit het goedgekeurde rapport.');
      if (approvedReport && (local.datasetVersion !== approvedReport.datasetVersion || identity.manifestHash !== approvedReport.manifestHash)) throw new Error('Actuele dataset- of manifestHash-identiteit wijkt af van het goedgekeurde rapport.');
      if (approvedReport && approvedPlan && (
        approvedReport.datasetVersion !== approvedPlan.datasetVersion ||
        approvedReport.manifestHash !== approvedPlan.manifestHash ||
        JSON.stringify(approvedBatchSetIds) !== JSON.stringify(approvedPlan.sets) ||
        approvedReport.expectedCardsTotal !== approvedPlan.expectedCardsTotal ||
        approvedReport.receivedCardsTotal !== approvedPlan.perSet.reduce((sum, set) => sum + set.receivedCards, 0) ||
        approvedReport.theoreticalWrites?.cardsCatalog !== approvedPlan.plannedCatalogInserts ||
        approvedReport.theoreticalWrites?.cardExternalReferences !== approvedPlan.plannedReferenceInserts ||
        approvedReport.theoreticalWrites?.total !== approvedPlan.plannedCatalogInserts + approvedPlan.plannedReferenceInserts
      )) throw new Error('Goedgekeurd rapport en writeplan hebben geen identieke dataset-, batch-, kaart- of write-identiteit.');
      if (approvedReport && approvedPlan && approvedReport.reportHash !== approvedPlan.sourceReportHash) throw new Error('Goedgekeurd dry-runrapport en writeplan hebben verschillende reportHash/sourceReportHash-identiteit.');
      const precheckCounts = options.mode === 'write-approved' ? await readTableCounts() : undefined;
      const initialDatabaseCounts = options.mode === 'write-approved' ? approvedInitialCounts(approvedReport?.precheckCounts) : undefined;
      const dynamicExpectedPostWriteCounts = options.mode === 'write-approved' ? expectedPostWriteCounts(initialDatabaseCounts!, approvedPlan!.plannedCatalogInserts, approvedPlan!.plannedReferenceInserts) : undefined;
      const precheckDisposition = options.mode === 'write-approved' ? classifyDynamicPrecheck(precheckCounts!, initialDatabaseCounts!, dynamicExpectedPostWriteCounts!) : undefined;

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

      let setsExecutedThisInvocation = 0;
      let setsSkippedFromCheckpoint = 0;
      if (mode !== 'write-approved') {
      const checkpointResults = checkpoint?.sets.map(setResultFromCheckpoint) ?? [];
      results.push(...checkpointResults);
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
          const diagnostic = result.dryRun.diagnostic ? addDiagnosticFailure(result.dryRun.diagnostic, 'input_validation_failure') : undefined;
          result.dryRun = { ...result.dryRun, passed: false, ...(diagnostic ? { diagnostic } : {}), error: `${result.dryRun.error ? `${result.dryRun.error} ` : ''}Expected/received mismatch: manifest=${set.expectedCards}, importer=${result.dryRun.receivedCards ?? 'unknown'}.` };
        }
        if (result.dryRun.databaseWrites !== 0) {
          const diagnostic = result.dryRun.diagnostic ? addDiagnosticFailure(result.dryRun.diagnostic, 'unexpected_runner_failure') : undefined;
          result.dryRun = { ...result.dryRun, passed: false, ...(diagnostic ? { diagnostic } : {}), error: `${result.dryRun.error ? `${result.dryRun.error} ` : ''}Lokale dry-run rapporteert databasewrites != 0.` };
        }
        if (result.dryRun.diagnostic) assertValidDiagnosticResult(result.dryRun.diagnostic);
        printStep(set.setId, result.dryRun);
        if (checkpoint) {
          const updated = checkpointSetFromResult(result, set.expectedCards);
          const index = checkpoint.sets.findIndex((item) => item.setId === set.setId);
          checkpoint.sets[index] = updated;
          saveCheckpoint(options.checkpointPath!, checkpoint);
        }
      }

      }

      if (mode === 'write-approved') {
        const lifecycleTrackers = new Map<string, ImportLifecycleTracker>();
        for (const set of local.sets) results.push({ setId: set.setId, expectedCards: set.expectedCards });
        for (const set of local.sets) {
          const result = results.find((item) => item.setId === set.setId)!;
          const tracker = new ImportLifecycleTracker();
          lifecycleTrackers.set(set.setId, tracker);
          result.write = precheckDisposition === 'alreadyApplied'
            ? alreadyAppliedStep(set.setId, set.expectedCards)
            : runImportSet(set.setId, true, set.inputPath, 'write', { name: set.name, series: set.series }, set.expectedCards, options.confirmWriteBatch, options.writePlanPath, precheckDisposition === 'partial', tracker);
          result.lifecycle = result.write.lifecycle ?? tracker.state;
          printStep(set.setId, result.write);
          if (!result.write.passed) break;
        }
        if (results.every((result) => result.write?.passed)) {
          for (const set of local.sets) {
            const result = results.find((item) => item.setId === set.setId)!;
            result.idempotency = runIdempotency(set.setId, set.inputPath, { name: set.name, series: set.series }, set.expectedCards, options.writePlanPath!);
            printStep(set.setId, result.idempotency);
            if (!result.idempotency.passed) break;
          }
        }
        let postcheckCounts: TableCounts | undefined;
        let postcheckError: string | undefined;
        const actualCatalogWrites = results.reduce((sum, result) => sum + (result.write?.diagnostic?.newCards ?? 0), 0);
        if (results.every((result) => result.idempotency?.passed)) {
          try {
            postcheckCounts = await readTableCounts();
            if (JSON.stringify(postcheckCounts) !== JSON.stringify(dynamicExpectedPostWriteCounts)) postcheckError = 'Read-only postcheck wijkt af van dynamisch expectedPostWriteCounts.';
          } catch (error) { postcheckError = error instanceof Error ? error.message : 'Read-only postcheck mislukt.'; }
        }
        for (const result of results) {
          const tracker = lifecycleTrackers.get(result.setId);
          const liveVerified = result.idempotency?.passed === true && !postcheckError && Boolean(postcheckCounts);
          if (liveVerified && tracker) tracker.completeReconciliation(true);
          else if (!liveVerified && tracker && (result.write?.passed || result.write?.databaseWrites)) tracker.fail(result.write?.databaseWrites ?? 0);
          result.lifecycle = tracker?.state ?? deriveImportLifecycle({ writeStarted: Boolean(result.write), writeCompleted: result.write?.passed === true, reconciliationCompleted: liveVerified, actualWrites: result.write?.databaseWrites ?? 0 });
        }
        const localReport = {
          phase: 'controlled-local-write', source: 'pokemon_tcg_data', mode, batch: approvedReport!.batch, datasetRepository: local.datasetRepository, datasetVersion: local.datasetVersion,
          manifestHash: identity.manifestHash, approvedDryRunReport: options.approvedDryRunReportPath, approvedWritePlan: options.writePlanPath, sourceReportHash: approvedReport!.reportHash, analysisHash: approvedPlan!.analysisHash,
          initialDatabaseCounts, currentDatabaseCounts: precheckCounts, alreadyApplied: { status: precheckDisposition === 'alreadyApplied' ? 'complete' : precheckDisposition === 'partial' ? 'partial' : 'none', catalogRecords: precheckDisposition === 'alreadyApplied' ? approvedPlan!.plannedCatalogInserts : Math.max(0, precheckCounts!.cards_catalog - initialDatabaseCounts!.cards_catalog), referenceRecords: precheckDisposition === 'alreadyApplied' ? approvedPlan!.plannedReferenceInserts : Math.max(0, precheckCounts!.card_external_references - initialDatabaseCounts!.card_external_references) },
          setsPlanned: local.sets.map((set) => set.setId), setsProcessed: results.filter((result) => result.write?.passed).map((result) => result.setId), expectedCardsTotal: approvedReport!.expectedCardsTotal, receivedCardsTotal: approvedReport!.receivedCardsTotal,
          plannedCatalogWrites: approvedPlan!.plannedCatalogInserts, plannedReferenceWrites: approvedPlan!.plannedReferenceInserts, actualCatalogWrites, actualReferenceWrites: results.reduce((sum, result) => sum + (result.write?.databaseWrites ?? 0) - (result.write?.diagnostic?.newCards ?? 0), 0),
          actualWrites: results.reduce((sum, result) => sum + (result.write?.databaseWrites ?? 0), 0),
          databaseWritesTotal: results.reduce((sum, result) => sum + (result.write?.databaseWrites ?? 0), 0), conflicts: 0, operationalErrors: postcheckError ? [postcheckError] : [], contentBlockades: results.filter((result) => result.lifecycle === 'FAILED_BEFORE_WRITE').map((result) => result.setId), precheckCounts, expectedPostWriteCounts: dynamicExpectedPostWriteCounts, postcheckCounts,
          plannedWrites: approvedPlan!.plannedCatalogInserts + approvedPlan!.plannedReferenceInserts, alreadyAppliedRecords: approvedPlan!.plannedCatalogInserts + approvedPlan!.plannedReferenceInserts - results.reduce((sum, result) => sum + (result.write?.databaseWrites ?? 0), 0),
          idempotencyStatus: results.every((result) => result.idempotency?.passed) ? 'PASS' : 'BLOCKED', reconciliationStatus: postcheckCounts && !postcheckError && results.every((result) => result.idempotency?.passed) ? 'PASS' : 'BLOCKED', reconciliationVerification: postcheckCounts && !postcheckError ? 'LIVE_READ_ONLY_SUPABASE' : 'NOT_VERIFIED', idempotencyResult: results.every((result) => result.idempotency?.passed) ? 'PASS' : 'BLOCKED', idempotencyChecks: { passed: results.filter((result) => result.idempotency?.passed).length, total: local.sets.length }, lifecycle: results.some((result) => result.lifecycle === 'FAILED_AFTER_WRITE') ? 'FAILED_AFTER_WRITE' : results.every((result) => result.idempotency?.passed) && postcheckCounts && !postcheckError ? 'RECONCILIATION_COMPLETE' : results.some((result) => result.write?.passed) ? 'FAILED_AFTER_WRITE' : 'FAILED_BEFORE_WRITE', finalStatus: results.some((result) => result.lifecycle === 'FAILED_AFTER_WRITE') ? 'FAILED_AFTER_WRITE' : results.every((result) => result.idempotency?.passed) && postcheckCounts && !postcheckError ? 'PASS' : 'BLOCKED', startedAt: localStartedAt, finishedAt: new Date().toISOString(), results: results.map(toReportSet),
        };
        if (options.reportPath) writeReport(options.reportPath, localReport);
        printSummary({ mode, results, datasetRepository, datasetVersion });
        return localReport.finalStatus === 'PASS' ? 0 : 1;
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

          result.idempotency = runApiIdempotency(setId);
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
    if (failureReportPath) {
      const message = error instanceof Error ? error.message : 'Onbekende batchfout.';
      const phaseA = error instanceof PhaseAReportValidationError ? {
        status: 'BLOCKED',
        missingField: error.field,
        requiredBatchInformation: error.requiredBatchInformation,
        regenerationCommand: error.regenerationCommand,
        message,
      } : undefined;
      writeReport(failureReportPath, { phase: mode === 'write-approved' ? 'controlled-local-write' : 'catalog-batch', mode, datasetRepository, datasetVersion, finalStatus: 'BLOCKED', databaseWritesTotal: 0, operationalErrors: [message], ...(phaseA ? { phaseAValidation: phaseA } : {}), startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() });
    }
    return 1;
  }
}

if (process.argv[1]?.endsWith('import-batch.ts')) main().then((exitCode) => { process.exitCode = exitCode; }).catch(() => {
    console.error('Onverwachte fout tijdens catalog batch import.');
    process.exitCode = 1;
  });
