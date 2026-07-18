import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inventoryLocalDataset, parseGenerateArgs, PINNED_DATASET_VERSION, writeGeneratedManifest } from '../../scripts/catalog/generate-local-manifest.ts';

const repo = 'PokemonTCG/pokemon-tcg-data';
function fixture(): string { const root = mkdtempSync(join(tmpdir(), 'pokemon-manifest-')); mkdirSync(join(root, 'sets')); mkdirSync(join(root, 'cards', 'en'), { recursive: true }); return root; }
function writeFixture(root: string, sets: unknown, cards: Record<string, unknown[]>): void {
  writeFileSync(join(root, 'sets', 'en.json'), JSON.stringify(sets)); for (const [id, value] of Object.entries(cards)) writeFileSync(join(root, 'cards', 'en', `${id}.json`), JSON.stringify(value));
}
function fakeGit(root: string, dirty = '') { return (_root: string, args: string[]) => { if (args[0] === 'status') return dirty; if (args[0] === 'remote') return `https://github.com/${repo}`; if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') return 'true'; return PINNED_DATASET_VERSION; }; }
function validFixture() { const root = fixture(); writeFixture(root, [{ id: 'base1', total: 2 }, { id: 'sv1', total: 1 }], { base1: [{ id: 'a' }, { id: 'b' }], sv1: [{ id: 'c' }] }); return root; }

test('generates a valid, sorted manifest and PASS report', () => {
  const root = validFixture(); const output = join(root, 'manifest.json'); const result = inventoryLocalDataset(root, output, fakeGit(root));
  assert.equal(result.report.status, 'PASS'); assert.equal(result.report.setsIndexed, 2); assert.equal(result.report.expectedCardsTotal, 3); assert.equal(result.report.receivedCardsTotal, 3); assert.deepEqual(result.manifest?.sets.map((set) => set.setId), ['base1', 'sv1']);
});

test('manifest serialization is deterministic', () => {
  const root = validFixture(); const first = inventoryLocalDataset(root, join(root, 'a.json'), fakeGit(root)).manifest!; const second = inventoryLocalDataset(root, join(root, 'b.json'), fakeGit(root)).manifest!;
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test('rejects wrong pinned commit, origin, and dirty worktree', () => {
  const root = validFixture();
  assert.match(inventoryLocalDataset(root, 'manifest.json', () => 'bad').report.errors![0].reason, /checkout-validatie|HEAD/);
  assert.match(inventoryLocalDataset(root, 'manifest.json', (_r, args) => args[0] === 'remote' ? 'https://github.com/wrong/repo' : args[0] === 'status' ? '' : args[1] === '--is-inside-work-tree' ? 'true' : PINNED_DATASET_VERSION).report.errors![0].reason, /origin/);
  assert.match(inventoryLocalDataset(root, 'manifest.json', fakeGit(root, ' M cards/en/base1.json')).report.errors![0].reason, /niet schoon/);
});

test('reports malformed index, duplicate IDs, invalid total, missing and invalid cards', () => {
  const root = validFixture(); writeFixture(root, [{ id: 'sv1', total: 0 }, { id: 'sv1', total: 1 }], { sv1: [{ id: 'c' }] });
  const report = inventoryLocalDataset(root, 'manifest.json', fakeGit(root)).report; assert.equal(report.status, 'FAIL'); assert.ok(report.errors?.some((error) => /positief geheel|getal/.test(error.reason))); assert.ok(report.errors?.some((error) => /dubbele/.test(error.reason)));
  writeFileSync(join(root, 'sets', 'en.json'), '{'); assert.equal(inventoryLocalDataset(root, 'manifest.json', fakeGit(root)).report.status, 'FAIL');
});

test('reports card-file errors and never returns a partial manifest', () => {
  const root = fixture(); writeFixture(root, [{ id: 'sv1', total: 2 }, { id: 'sv2', total: 1 }], { sv1: [{ id: 'same' }, { id: 'same' }], sv2: [{ name: 'missing-id' }] });
  const result = inventoryLocalDataset(root, join(root, 'manifest.json'), fakeGit(root)); assert.equal(result.manifest, undefined); assert.equal(result.report.setsFailed, 2);
  writeFileSync(join(root, 'sets', 'en.json'), JSON.stringify([{ id: 'sv1', total: 1 }])); const mismatch = inventoryLocalDataset(root, 'manifest.json', fakeGit(root)); assert.equal(mismatch.manifest, undefined); assert.ok(mismatch.report.errors?.some((error) => /mismatch/.test(error.reason)));
});

test('reports a missing card file with its set and path', () => {
  const root = fixture(); writeFixture(root, [{ id: 'sv1', total: 1 }], {});
  const report = inventoryLocalDataset(root, 'manifest.json', fakeGit(root)).report;
  assert.equal(report.status, 'FAIL'); assert.deepEqual(report.errors?.[0], { setId: 'sv1', file: 'cards/en/sv1.json', reason: 'bestand ontbreekt' });
});

test('writes an atomic-compatible manifest shape with pinned SHA', () => {
  const root = validFixture(); const path = join(root, 'manifest.json'); const result = inventoryLocalDataset(root, path, fakeGit(root)); writeGeneratedManifest(result.manifest!, path); const saved = JSON.parse(readFileSync(path, 'utf8')); assert.equal(saved.datasetVersion, PINNED_DATASET_VERSION); assert.equal(saved.sets.length, 2);
});

test('parses the dedicated CLI arguments', () => { assert.deepEqual(parseGenerateArgs(['--input-root', 'dataset', '--output=out.json', '--report', 'report.json']), { inputRoot: join(process.cwd(), 'dataset'), outputPath: join(process.cwd(), 'out.json'), reportPath: join(process.cwd(), 'report.json') }); });

test('real temporary Git fixtures can configure origin and local identity', () => {
  const root = fixture(); execFileSync('git', ['-C', root, 'init', '--quiet']); execFileSync('git', ['-C', root, 'config', 'user.email', 'fixture@example.invalid']); execFileSync('git', ['-C', root, 'config', 'user.name', 'Fixture']); execFileSync('git', ['-C', root, 'remote', 'add', 'origin', `https://github.com/${repo}`]); assert.equal(repo, 'PokemonTCG/pokemon-tcg-data');
});
