import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CATALOG_BATCH_CONFIG_PATH,
  parseCatalogBatchArgs,
  parseCatalogBatchConfigFromText,
} from '../../scripts/catalog/import-batch-args.ts';

const parses = (args: string[]) => parseCatalogBatchArgs(args);
const rejects = (args: string[]) => assert.throws(() => parses(args));

test('uses dry-run mode and default config by default', () => {
  assert.deepEqual(parses([]), { mode: 'dry-run', configPath: DEFAULT_CATALOG_BATCH_CONFIG_PATH });
});

test('parses explicit dry-run and write-approved modes', () => {
  assert.deepEqual(parses(['--mode', 'dry-run']), { mode: 'dry-run', configPath: DEFAULT_CATALOG_BATCH_CONFIG_PATH });
  assert.deepEqual(parses(['--mode=write-approved']), { mode: 'write-approved', configPath: DEFAULT_CATALOG_BATCH_CONFIG_PATH });
});

test('parses config path and comma separated set override', () => {
  assert.deepEqual(parses(['--config', 'tmp/sets.json', '--sets', 'sv3pt5,sv3']), {
    mode: 'dry-run',
    configPath: 'tmp/sets.json',
    setIds: ['sv3pt5', 'sv3'],
  });
});

test('rejects unsafe or malformed batch arguments', () => {
  for (const args of [
    ['--mode'], ['--mode', 'write'], ['--mode=WRITE'], ['--config'], ['--config='], ['--sets'], ['--sets='],
    ['--sets', 'sv3,sv3'], ['--sets', 'SV3'], ['--sets', 'sv/3'], ['--sets', 'sv3', '--sets', 'sv4'], ['--unknown'],
  ]) rejects(args);
});

test('parses and validates batch config', () => {
  assert.deepEqual(parseCatalogBatchConfigFromText('{"source":"pokemon_tcg_api","sets":["sv3pt5","sv3"]}'), {
    source: 'pokemon_tcg_api',
    sets: ['sv3pt5', 'sv3'],
  });
});

test('rejects invalid batch config', () => {
  for (const text of [
    '', '{}', '{"source":"tcgdex","sets":["sv3"]}', '{"source":"pokemon_tcg_api","sets":[]}',
    '{"source":"pokemon_tcg_api","sets":["sv3","sv3"]}', '{"source":"pokemon_tcg_api","sets":["SV3"]}',
    '{"source":"pokemon_tcg_api","sets":[3]}',
  ]) {
    assert.throws(() => parseCatalogBatchConfigFromText(text));
  }
});
