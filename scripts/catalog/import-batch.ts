import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseCatalogBatchArgs, parseCatalogBatchConfigFromText, type CatalogBatchMode } from './import-batch-args.ts';

type StepName = 'dry-run' | 'write' | 'idempotency';

type StepResult = {
  step: StepName;
  exitCode: number;
  output: string;
  passed: boolean;
  error?: string;
};

type SetResult = {
  setId: string;
  dryRun?: StepResult;
  write?: StepResult;
  idempotency?: StepResult;
};

class CatalogBatchError extends Error {}

function runImportSet(setId: string, write: boolean): StepResult {
  const step: StepName = write ? 'write' : 'dry-run';
  const args = ['--experimental-strip-types', 'scripts/catalog/import-set.ts', '--set', setId, ...(write ? ['--write'] : [])];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const exitCode = result.status ?? 1;
  return validateStepOutput({ step, exitCode, output });
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
  };
}

function printStep(setId: string, result: StepResult): void {
  console.log(`\n=== ${setId} / ${result.step} ===`);
  process.stdout.write(result.output);
  if (!result.output.endsWith('\n')) console.log('');
  console.log(`Batch step: ${result.passed ? 'PASS' : 'FAIL'}`);
  if (result.error) console.log(`Batch validation: ${result.error}`);
}

function printSummary(mode: CatalogBatchMode, results: SetResult[]): void {
  const failed = results.filter((result) =>
    [result.dryRun, result.write, result.idempotency].some((step) => step && !step.passed),
  );
  console.log('\nCatalog batch summary');
  console.log(`Mode: ${mode}`);
  console.log(`Sets planned: ${results.length}`);
  console.log(`Sets completed: ${results.length - failed.length}`);
  console.log(`Sets failed: ${failed.length}`);
  for (const result of results) {
    const statuses = [result.dryRun, result.write, result.idempotency]
      .filter((step): step is StepResult => Boolean(step))
      .map((step) => `${step.step}=${step.passed ? 'PASS' : 'FAIL'}`)
      .join(', ');
    console.log(`- ${result.setId}: ${statuses}`);
  }
}

function readSetIds(options: ReturnType<typeof parseCatalogBatchArgs>): string[] {
  if (options.setIds) return options.setIds;
  const config = parseCatalogBatchConfigFromText(readFileSync(options.configPath, 'utf8'));
  return config.sets;
}

async function main(): Promise<number> {
  const results: SetResult[] = [];
  let mode: CatalogBatchMode = 'dry-run';

  try {
    const options = parseCatalogBatchArgs(process.argv.slice(2));
    mode = options.mode;
    const setIds = readSetIds(options);

    console.log('Catalog batch import');
    console.log('Source: pokemon_tcg_api');
    console.log(`Mode: ${mode}`);
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

    printSummary(mode, results);
    const failed = results.some((result) => [result.dryRun, result.write, result.idempotency].some((step) => step && !step.passed));
    return failed ? 1 : 0;
  } catch (error) {
    console.error('Catalog batch import');
    console.error(`Mode: ${mode}`);
    console.error(`Fout: ${error instanceof Error ? error.message : 'Onbekende batchfout.'}`);
    if (error instanceof CatalogBatchError) return 1;
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
