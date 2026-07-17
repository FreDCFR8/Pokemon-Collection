import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertWriteAuthorized, getWritePlanTitle, parseCatalogImportArgs } from '../../scripts/catalog/import-args.ts';

const parses = (args: string[]) => parseCatalogImportArgs(args);
const rejects = (args: string[]) => assert.throws(() => parses(args));

test('allows dry-run for the reference set and other valid set IDs', () => {
  assert.deepEqual(parses(['--set', 'sv3pt5']), { setId: 'sv3pt5', write: false });
  assert.deepEqual(parses(['--set', 'sv3']), { setId: 'sv3', write: false });
  assert.deepEqual(parses(['--set', 'swsh12']), { setId: 'swsh12', write: false });
  assert.deepEqual(parses(['--set', 'base1']), { setId: 'base1', write: false });
});

test('dry-run is never write-authorized', () => {
  const options = parses(['--set', 'sv4']);
  assert.equal(options.write, false);
  assert.doesNotThrow(() => assertWriteAuthorized(options));
});

test('writeplan title distinguishes dry-run from write mode', () => {
  assert.equal(getWritePlanTitle(false), 'Theoretisch writeplan (read-only analyse)');
  assert.equal(getWritePlanTitle(true), 'Goedgekeurd writeplan (WRITE)');
  assert.doesNotMatch(getWritePlanTitle(true), /read-only analyse/i);
});

test('only exact sv3pt5 or sv3 --write is authorized', () => {
  assert.doesNotThrow(() => assertWriteAuthorized(parses(['--set', 'sv3pt5', '--write'])));
  assert.doesNotThrow(() => assertWriteAuthorized(parses(['--set', 'sv3', '--write'])));
  for (const setId of ['sv4', 'swsh12', 'sm115', 'base1']) {
    assert.throws(() => assertWriteAuthorized(parses(['--set', setId, '--write'])), /write.*allowlist/i);
  }
});

test('rejects unsafe or malformed arguments', () => {
  for (const args of [
    [], ['--set'], ['--set', ''], ['--set', 'sv3pt5', '--set', 'sv4'], ['--set', 'sv3pt5', '--write', '--write'],
    ['--set', 'sv3pt5', '--write=true'], ['--set', 'sv3pt5', '--write=false'], ['--set', 'sv3pt5', '--wat'],
    ['--set', 'SV3PT5'], ['--set', 'sv 3pt5'], ['--set', 'sv/3pt5'], ['--set', 'sv?3pt5'], ['--set', 'sv&3pt5'],
    ['--set', 'sv:3pt5'], ['--set', 'sv.3pt5'], ['--set', 'sv\\3pt5'], ['--set', 'a'.repeat(33)], ['--set', 'sv3pt5', 'extra'],
  ]) rejects(args);
});

test('keeps the importer write boundary and collection isolation intact', () => {
  const importer = readFileSync('scripts/catalog/import-set.ts', 'utf8');
  const authorization = importer.indexOf('assertWriteAuthorized(options);');
  const apiConfig = importer.indexOf('const apiKey = getApiKey();');
  assert.notEqual(authorization, -1);
  assert.ok(authorization < apiConfig, 'write authorization must precede API configuration');
  assert.doesNotMatch(importer, /\.from\(['"]collection_cards['"]\)\.(insert|update|delete)/i);
  assert.doesNotMatch(importer, /\.from\(['"]public\.cards['"]\)/i);
  assert.match(importer, /if \(!options\.write\)[\s\S]*?printFinalResult\(true, 0\)/);
});
