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
  assert.deepEqual(parses([]), { mode: 'dry-run', source: 'pokemon_tcg_api', configPath: DEFAULT_CATALOG_BATCH_CONFIG_PATH });
});

test('parses explicit dry-run and write-approved modes', () => {
  assert.deepEqual(parses(['--mode', 'dry-run']), { mode: 'dry-run', source: 'pokemon_tcg_api', configPath: DEFAULT_CATALOG_BATCH_CONFIG_PATH });
  assert.deepEqual(parses(['--mode=write-approved']), { mode: 'write-approved', source: 'pokemon_tcg_api', configPath: DEFAULT_CATALOG_BATCH_CONFIG_PATH });
});

test('parses config path and comma separated set override', () => {
  assert.deepEqual(parses(['--config', 'tmp/sets.json', '--sets', 'sv3pt5,sv3']), {
    mode: 'dry-run',
    source: 'pokemon_tcg_api',
    configPath: 'tmp/sets.json',
    setIds: ['sv3pt5', 'sv3'],
  });
});



test('parses controlled local manifest batch arguments', () => {
  assert.deepEqual(parses(['--source', 'pokemon_tcg_data', '--manifest', 'config/local.json', '--input-root', 'tmp/data', '--sets', 'sv3pt5,sv3', '--report', 'tmp/report.json']), {
    mode: 'dry-run',
    source: 'pokemon_tcg_data',
    configPath: DEFAULT_CATALOG_BATCH_CONFIG_PATH,
    manifestPath: 'config/local.json',
    inputRoot: 'tmp/data',
    reportPath: 'tmp/report.json',
    setIds: ['sv3pt5', 'sv3'],
  });
});

test('blocks local write attempts and incomplete local batch arguments', () => {
  for (const args of [
    ['--source', 'pokemon_tcg_data', '--mode', 'write-approved', '--manifest', 'm.json', '--input-root', 'data'],
    ['--source', 'pokemon_tcg_data', '--input-root', 'data'],
    ['--source', 'pokemon_tcg_data', '--manifest', 'm.json'],
    ['--manifest', 'm.json'],
    ['--input-root', 'data'],
  ]) rejects(args);
});

test('rejects unsafe or malformed batch arguments', () => {
  for (const args of [
    ['--mode'], ['--mode', 'write'], ['--mode=WRITE'], ['--config'], ['--config='], ['--sets'], ['--sets='],
    ['--sets', 'sv3,sv3'], ['--sets', 'SV3'], ['--sets', 'sv/3'], ['--sets', 'sv3', '--sets', 'sv4'], ['--unknown'], ['--resume'], ['--checkpoint'], ['--checkpoint', 'a', '--checkpoint', 'b'],
  ]) rejects(args);
});

test('parses checkpoint and resume flags and keeps local mode read-only', () => {
  assert.deepEqual(parses(['--source', 'pokemon_tcg_data', '--manifest', 'm.json', '--input-root', 'data', '--checkpoint', 'run.json', '--resume']), {
    mode: 'dry-run', source: 'pokemon_tcg_data', configPath: DEFAULT_CATALOG_BATCH_CONFIG_PATH, manifestPath: 'm.json', inputRoot: 'data', checkpointPath: 'run.json', resume: true,
  });
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
