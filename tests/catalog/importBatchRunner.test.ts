import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function makeTmp(): string { return mkdtempSync(join(tmpdir(), 'pokemon-batch-')); }
function writeFixture(dir: string, received: Record<string, number>): { manifest: string; root: string; stub: string; report: string } {
  const root = join(dir, 'data'); mkdirSync(root, { recursive: true });
  for (const setId of ['sv3pt5', 'sv3']) writeFileSync(join(root, `${setId}.json`), '[]');
  const manifest = join(dir, 'manifest.json');
  writeFileSync(manifest, JSON.stringify({ source: 'pokemon_tcg_data', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion: 'abc123', sets: [{ setId: 'sv3pt5', jsonPath: 'sv3pt5.json', expectedCards: 207, enabled: true }, { setId: 'sv3', jsonPath: 'sv3.json', expectedCards: 230, enabled: true }] }));
  const stub = join(dir, 'stub-import-set.ts');
  writeFileSync(stub, `const args = process.argv.slice(2);\nconst set = args[args.indexOf('--set') + 1];\nconst input = args[args.indexOf('--input') + 1];\nif (!args.includes('--source') || !args.includes('pokemon_tcg_data') || !input) process.exit(3);\nconst counts = ${JSON.stringify(received)};\nconsole.log('Catalog import dry run');\nconsole.log('Source: pokemon_tcg_data');\nconsole.log('Set: ' + set);\nconsole.log('Mode: DRY RUN');\nconsole.log('Expected cards: ' + counts[set]);\nconsole.log('Received cards: ' + counts[set]);\nconsole.log('Theoretisch geplande writes: 0');\nconsole.log('Result: PASS');\nconsole.log('Database writes: 0');\n`);
  return { manifest, root, stub, report: join(dir, 'report.json') };
}

function runBatch(paths: ReturnType<typeof writeFixture>, extra: string[] = []) {
  return spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/catalog/import-batch.ts', '--source', 'pokemon_tcg_data', '--manifest', paths.manifest, '--input-root', paths.root, ...extra], { encoding: 'utf8', env: { ...process.env, CATALOG_IMPORT_SET_SCRIPT: paths.stub } });
}

test('passes correct CLI arguments to import-set and supports --sets filtering', () => {
  const paths = writeFixture(makeTmp(), { sv3pt5: 207, sv3: 230 });
  const result = runBatch(paths, ['--sets', 'sv3']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Sets: sv3/);
  assert.doesNotMatch(result.stdout, /sv3pt5 \/ dry-run/);
});

test('continues after one failed local set and exits non-zero for partial failure', () => {
  const paths = writeFixture(makeTmp(), { sv3pt5: 206, sv3: 230 });
  const result = runBatch(paths);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /sv3pt5 \/ dry-run/);
  assert.match(result.stdout, /sv3 \/ dry-run/);
  assert.match(result.stdout, /Expected\/received mismatch/);
});

test('local dry-run reports zero database writes and JSON report contains no sensitive values', () => {
  const paths = writeFixture(makeTmp(), { sv3pt5: 207, sv3: 230 });
  const result = runBatch(paths, ['--report', paths.report]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Database writes: 0/);
  const report = readFileSync(paths.report, 'utf8');
  assert.doesNotMatch(report, /SUPABASE|POKEMON_TCG_API_KEY|serviceRole|apiKey|secret/i);
  assert.match(report, /"databaseWrites": 0/);
});
