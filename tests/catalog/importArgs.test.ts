import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertWriteAuthorized, getWritePlanTitle, parseCatalogImportArgs } from '../../scripts/catalog/import-args.ts';

const parses = (args: string[]) => parseCatalogImportArgs(args);
const rejects = (args: string[]) => assert.throws(() => parses(args));

test('allows dry-run for the reference set and other valid set IDs', () => {
  assert.deepEqual(parses(['--set', 'sv3pt5']), { setId: 'sv3pt5', write: false, source: 'pokemon_tcg_api' });
  assert.deepEqual(parses(['--set', 'sv3']), { setId: 'sv3', write: false, source: 'pokemon_tcg_api' });
  assert.deepEqual(parses(['--set', 'swsh12']), { setId: 'swsh12', write: false, source: 'pokemon_tcg_api' });
  assert.deepEqual(parses(['--set', 'base1']), { setId: 'base1', write: false, source: 'pokemon_tcg_api' });
});


test('parses local JSON source input as read-only', () => {
  assert.deepEqual(parses(['--set', 'sv3', '--source', 'pokemon_tcg_data', '--input', 'data/sv3.json']), {
    setId: 'sv3',
    write: false,
    source: 'pokemon_tcg_data',
    inputPath: 'data/sv3.json',
  });
  assert.throws(
    () => assertWriteAuthorized(parses(['--set', 'sv3', '--source', 'pokemon_tcg_data', '--input', 'data/sv3.json', '--write'])),
    /lokale JSON-bron.*read-only/i,
  );
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
    ['--set', 'sv:3pt5'], ['--set', 'sv.3pt5'], ['--set', 'sv\\3pt5'], ['--set', 'a'.repeat(33)], ['--set', 'sv3pt5', 'extra'], ['--set', 'sv3', '--source', 'pokemon_tcg_data'], ['--set', 'sv3', '--source', 'pokemon_tcg_data', '--input', 'a', '--input', 'b'], ['--set', 'sv3', '--source', 'pokemon_tcg_data', '--input', 'a', '--source', 'pokemon_tcg_api'],
  ]) rejects(args);
});

test('keeps the importer write boundary and collection isolation intact', () => {
  const importer = readFileSync('scripts/catalog/import-set.ts', 'utf8');
  const authorization = importer.indexOf('assertWriteAuthorized(options);');
  const supabaseConfig = importer.indexOf('const supabaseConfig = getSupabaseConfig();');
  const apiConfig = importer.indexOf('const apiKey = options.source ===');
  const localJsonLoad = importer.indexOf('loadPokemonTcgDataJson(options.inputPath!, setId)');
  assert.notEqual(authorization, -1);
  assert.notEqual(apiConfig, -1);
  assert.ok(authorization < supabaseConfig, 'write authorization must precede database configuration');
  assert.ok(authorization < apiConfig, 'write authorization must precede external API configuration');
  assert.ok(authorization < localJsonLoad, 'write authorization must precede local-source processing');
  assert.throws(
    () => assertWriteAuthorized(parses(['--set', 'sv3', '--source', 'pokemon_tcg_data', '--input', 'data/sv3.json', '--write'])),
    /read-only/i,
  );
  assert.doesNotMatch(importer, /\.from\(['"]collection_cards['"]\)\.(insert|update|delete)/i);
  assert.doesNotMatch(importer, /\.from\(['"]public\.cards['"]\)/i);
  assert.match(importer, /if \(!options\.write\)[\s\S]*?printFinalResult\(true, 0\)/);
});
