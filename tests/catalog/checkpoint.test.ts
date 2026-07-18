import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertCheckpointIdentity, readCheckpoint, supabaseProjectIdentity, writeAtomicJson, type CheckpointIdentity } from '../../scripts/catalog/checkpoint.ts';

const identity: CheckpointIdentity = {
  checkpointSchemaVersion: 1, source: 'pokemon_tcg_data', mode: 'dry-run', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion: '0af6250a22495e4a3e9f60ff45fc3fedc2e0563d', manifestHash: 'a'.repeat(64), setIds: ['sv1', 'sv2'], supabaseProjectIdentity: 'https://example.supabase.co',
};

test('checkpoint identity includes normalized Supabase project URL without secrets', () => {
  assert.equal(supabaseProjectIdentity('https://abc.supabase.co/'), 'https://abc.supabase.co');
  assert.equal(supabaseProjectIdentity('https://abc.supabase.co?service_role=secret'), 'https://abc.supabase.co');
  assert.equal(supabaseProjectIdentity(undefined), 'missing');
});

test('checkpoint identity reports exact field mismatches', () => {
  assert.throws(() => assertCheckpointIdentity({ ...identity, manifestHash: 'b'.repeat(64) }, identity), /manifestHash/);
  assert.throws(() => assertCheckpointIdentity({ ...identity, setIds: ['sv2', 'sv1'] }, identity), /setselectie/);
});

test('atomic checkpoint JSON leaves no temporary file and writes compact data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pokemon-checkpoint-')); const path = join(dir, 'checkpoint.json');
  writeAtomicJson(path, { ...identity, sets: [], secret: undefined });
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).datasetVersion, identity.datasetVersion);
  assert.equal(existsSync(`${path}.tmp-${process.pid}`), false);
  assert.doesNotMatch(readFileSync(path, 'utf8'), /service_role|apiKey|payload|stdout|stderr/);
  assert.deepEqual(readCheckpoint(path).setIds, identity.setIds);
});

test('atomic write cleans the temporary file when replacement cannot complete', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pokemon-checkpoint-')); const path = join(dir, 'checkpoint.json'); mkdirSync(path);
  assert.throws(() => writeAtomicJson(path, identity));
  assert.equal(readdirSync(dir).some((name) => name.startsWith('checkpoint.json.tmp-')), false);
});
