import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const datasetVersion = '0af6250a22495e4a3e9f60ff45fc3fedc2e0563d';

function makeTmp(): string { return mkdtempSync(join(tmpdir(), 'pokemon-batch-')); }

function writeLocalFixture(dir: string, received: Record<string, number>): { manifest: string; root: string; stub: string; report: string } {
  const root = join(dir, 'data'); mkdirSync(root, { recursive: true });
  for (const setId of ['sv3pt5', 'sv3']) writeFileSync(join(root, `${setId}.json`), '[]');
  const manifest = join(dir, 'manifest.json');
  writeFileSync(manifest, JSON.stringify({ source: 'pokemon_tcg_data', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion, sets: [{ setId: 'sv3pt5', jsonPath: 'sv3pt5.json', expectedCards: 207, enabled: true }, { setId: 'sv3', jsonPath: 'sv3.json', expectedCards: 230, enabled: true }] }));
  const stub = join(dir, 'stub-import-set.ts');
  writeFileSync(stub, `const args = process.argv.slice(2);\nconst set = args[args.indexOf('--set') + 1];\nconst input = args[args.indexOf('--input') + 1];\nif (!args.includes('--source') || !args.includes('pokemon_tcg_data') || !input) process.exit(3);\nconst counts = ${JSON.stringify(received)};\nconsole.log('Catalog import dry run');\nconsole.log('Source: pokemon_tcg_data');\nconsole.log('Set: ' + set);\nconsole.log('Mode: DRY RUN');\nconsole.log('Expected cards: ' + counts[set]);\nconsole.log('Received cards: ' + counts[set]);\nconsole.log('Theoretisch geplande writes: 0');\nconsole.log('Result: PASS');\nconsole.log('Database writes: 0');\n`);
  return { manifest, root, stub, report: join(dir, 'report.json') };
}

function writeApiFixture(dir: string, failureStep?: 'write' | 'idempotency'): { config: string; stub: string; report: string; state: string } {
  const config = join(dir, 'sets.json');
  const state = join(dir, 'state.txt');
  writeFileSync(config, JSON.stringify({ source: 'pokemon_tcg_api', sets: ['sv3'] }));
  writeFileSync(state, '0');
  const stub = join(dir, 'stub-import-set.ts');
  writeFileSync(stub, `import { readFileSync, writeFileSync } from 'node:fs';\nconst state = process.env.BATCH_STUB_STATE;\nconst count = Number(readFileSync(state, 'utf8')) + 1;\nwriteFileSync(state, String(count));\nconst isWrite = process.argv.includes('--write');\nconst phase = isWrite ? 'write' : count === 1 ? 'dry-run' : 'idempotency';\nconst failure = ${JSON.stringify(failureStep ?? '')};\nconst failed = phase === failure;\nconsole.log('Catalog import ' + (isWrite ? 'write' : 'dry run'));\nconsole.log('Set: sv3');\nconsole.log('Mode: ' + (isWrite ? 'WRITE' : 'DRY RUN'));\nconsole.log('Expected cards: 230');\nconsole.log('Received cards: 230');\nconsole.log('New: ' + (phase === 'idempotency' && failed ? '1' : '0'));\nconsole.log('Theoretisch geplande writes: ' + (phase === 'idempotency' && failed ? '2' : '0'));\nif (isWrite) console.log('Mislukte writes: ' + (failed ? '1' : '0'));\nconsole.log('Result: ' + (failed ? 'FAIL' : 'PASS'));\nconsole.log('Database writes: ' + (isWrite && !failed ? '5' : '0'));\nprocess.exit(failed ? 1 : 0);\n`);
  return { config, stub, report: join(dir, 'report.json'), state };
}

function runLocalBatch(paths: ReturnType<typeof writeLocalFixture>, extra: string[] = []) {
  return spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/catalog/import-batch.ts', '--source', 'pokemon_tcg_data', '--manifest', paths.manifest, '--input-root', paths.root, ...extra], { encoding: 'utf8', env: { ...process.env, CATALOG_IMPORT_SET_SCRIPT: paths.stub } });
}

function runApiBatch(paths: ReturnType<typeof writeApiFixture>, extra: string[] = []) {
  return spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/catalog/import-batch.ts', '--config', paths.config, '--mode', 'write-approved', ...extra], { encoding: 'utf8', env: { ...process.env, CATALOG_IMPORT_SET_SCRIPT: paths.stub, BATCH_STUB_STATE: paths.state } });
}

test('passes correct CLI arguments to import-set and supports --sets filtering', () => {
  const paths = writeLocalFixture(makeTmp(), { sv3pt5: 207, sv3: 230 });
  const result = runLocalBatch(paths, ['--sets', 'sv3']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Sets: sv3/);
  assert.doesNotMatch(result.stdout, /sv3pt5 \/ dry-run/);
});

test('continues after one failed local set and exits non-zero for partial failure', () => {
  const paths = writeLocalFixture(makeTmp(), { sv3pt5: 206, sv3: 230 });
  const result = runLocalBatch(paths);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /sv3pt5 \/ dry-run/);
  assert.match(result.stdout, /sv3 \/ dry-run/);
  assert.match(result.stdout, /Expected\/received mismatch/);
});

test('local dry-run reports zero database writes and JSON report contains no sensitive values', () => {
  const paths = writeLocalFixture(makeTmp(), { sv3pt5: 207, sv3: 230 });
  const result = runLocalBatch(paths, ['--report', paths.report]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Database writes: 0/);
  assert.match(result.stdout, /Dataset repository: PokemonTCG\/pokemon-tcg-data/);
  assert.match(result.stdout, new RegExp(`Dataset version: ${datasetVersion}`));
  const report = JSON.parse(readFileSync(paths.report, 'utf8'));
  assert.equal(report.datasetRepository, 'PokemonTCG/pokemon-tcg-data');
  assert.equal(report.datasetVersion, datasetVersion);
  assert.doesNotMatch(JSON.stringify(report), /SUPABASE|POKEMON_TCG_API_KEY|serviceRole|apiKey|secret|Catalog import dry run/i);
  assert.equal(report.results[0].databaseWrites, 0);
  assert.equal(report.results[0].steps[0].databaseWrites, 0);
});

test('dry-run PASS plus write FAIL makes the API set summary and report fail', () => {
  const paths = writeApiFixture(makeTmp(), 'write');
  const result = runApiBatch(paths, ['--report', paths.report]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /- sv3: FAIL; steps=dry-run=PASS, write=FAIL/);
  const report = JSON.parse(readFileSync(paths.report, 'utf8'));
  assert.equal(report.results[0].passed, false);
  assert.deepEqual(report.results[0].steps.map((step: { name: string; passed: boolean }) => [step.name, step.passed]), [['dry-run', true], ['write', false]]);
});

test('dry-run PASS plus write PASS plus idempotency FAIL makes the API set summary and report fail', () => {
  const paths = writeApiFixture(makeTmp(), 'idempotency');
  const result = runApiBatch(paths, ['--report', paths.report]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /- sv3: FAIL; steps=dry-run=PASS, write=PASS, idempotency=FAIL/);
  const report = JSON.parse(readFileSync(paths.report, 'utf8'));
  assert.equal(report.results[0].passed, false);
  assert.deepEqual(report.results[0].steps.map((step: { name: string; passed: boolean }) => [step.name, step.passed]), [['dry-run', true], ['write', true], ['idempotency', false]]);
});

test('API batch without --report remains backward compatible and does not write a report', () => {
  const paths = writeApiFixture(makeTmp());
  const result = runApiBatch(paths);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /- sv3: PASS; steps=dry-run=PASS, write=PASS, idempotency=PASS/);
});
