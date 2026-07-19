import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertCheckpointIdentity, readCheckpoint, supabaseProjectIdentity, writeAtomicJson, type CatalogBatchCheckpoint, type CheckpointIdentity } from '../../scripts/catalog/checkpoint.ts';

const identity: CheckpointIdentity = {
  checkpointSchemaVersion: 1, source: 'pokemon_tcg_data', mode: 'dry-run', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion: '0af6250a22495e4a3e9f60ff45fc3fedc2e0563d', manifestHash: 'a'.repeat(64), setIds: ['sv1', 'sv2'], supabaseProjectIdentity: 'https://example.supabase.co',
};

test('checkpoint identity includes normalized Supabase project URL without secrets', () => {
  assert.equal(supabaseProjectIdentity('https://abc.supabase.co/'), 'https://abc.supabase.co');
  assert.equal(supabaseProjectIdentity('https://abc.supabase.co?service_role=secret'), 'https://abc.supabase.co');
  assert.throws(() => supabaseProjectIdentity(undefined), /SUPABASE_URL ontbreekt/);
  assert.throws(() => supabaseProjectIdentity('ftp://abc.supabase.co'), /HTTP\(S\)/);
  assert.throws(() => supabaseProjectIdentity('https://user:secret@abc.supabase.co'), /projectidentiteit/);
});

test('checkpoint identity reports exact field mismatches', () => {
  const checkpoint = { ...identity, startedAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:01.000Z', sets: [{ setId: 'sv1', expectedCards: 1, status: 'pending' as const }, { setId: 'sv2', expectedCards: 1, status: 'pending' as const }] };
  assert.throws(() => assertCheckpointIdentity({ ...checkpoint, manifestHash: 'b'.repeat(64) }, identity, [{ setId: 'sv1', expectedCards: 1 }, { setId: 'sv2', expectedCards: 1 }]), /manifestHash/);
  assert.throws(() => assertCheckpointIdentity({ ...checkpoint, setIds: ['sv2', 'sv1'], sets: [{ ...checkpoint.sets[1] }, { ...checkpoint.sets[0] }] }, identity, [{ setId: 'sv1', expectedCards: 1 }, { setId: 'sv2', expectedCards: 1 }]), /setselectie/);
});

test('atomic checkpoint JSON leaves no temporary file and writes compact data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pokemon-checkpoint-')); const path = join(dir, 'checkpoint.json');
  const checkpoint: CatalogBatchCheckpoint = { ...identity, startedAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:01.000Z', sets: [{ setId: 'sv1', expectedCards: 1, status: 'passed', receivedCards: 1, plannedWrites: 0, databaseWrites: 0 }, { setId: 'sv2', expectedCards: 1, status: 'pending' }] };
  writeAtomicJson(path, { ...checkpoint, secret: undefined });
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

test('atomic replacement preserves an existing checkpoint when rename fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pokemon-checkpoint-')); const path = join(dir, 'checkpoint.json'); const tempPath = `${path}.tmp-test`;
  const existing = JSON.stringify(validCheckpoint(), null, 2) + '\n';
  const replacement = { replacement: true };
  writeFileSync(path, existing, 'utf8');
  assert.throws(() => writeAtomicJson(path, replacement, { tempPath: () => tempPath, renameFile: () => { throw new Error('simulated rename failure'); } }));
  assert.equal(readFileSync(path, 'utf8'), existing);
  assert.equal(existsSync(tempPath), false);
});

function validCheckpoint(): CatalogBatchCheckpoint {
  return { ...identity, startedAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:01.000Z', sets: [{ setId: 'sv1', expectedCards: 1, status: 'passed', receivedCards: 1, plannedWrites: 0, databaseWrites: 0 }, { setId: 'sv2', expectedCards: 2, status: 'pending' }] };
}

test('checkpoint parser rejects duplicate, missing, extra, reordered, and inconsistent sets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pokemon-checkpoint-')); const path = join(dir, 'checkpoint.json');
  for (const mutate of [
    (value: CatalogBatchCheckpoint) => ({ ...value, setIds: ['sv1', 'sv1'] }),
    (value: CatalogBatchCheckpoint) => ({ ...value, sets: [value.sets[0]] }),
    (value: CatalogBatchCheckpoint) => ({ ...value, sets: [{ ...value.sets[0], receivedCards: undefined }, value.sets[1]] }),
    (value: CatalogBatchCheckpoint) => ({ ...value, sets: [{ ...value.sets[0], databaseWrites: 1 }, value.sets[1]] }),
  ]) {
    const candidate = mutate(validCheckpoint());
    writeAtomicJson(path, candidate);
    assert.throws(() => readCheckpoint(path));
  }
});

test('checkpoint compatibility rejects current manifest expectedCards mismatches', () => {
  const checkpoint = validCheckpoint();
  assert.throws(() => assertCheckpointIdentity(checkpoint, identity, [{ setId: 'sv1', expectedCards: 2 }, { setId: 'sv2', expectedCards: 2 }]), /expectedCards/);
  assert.throws(() => assertCheckpointIdentity({ ...checkpoint, setIds: ['sv2', 'sv1'], sets: [checkpoint.sets[1], checkpoint.sets[0]] }, identity, [{ setId: 'sv1', expectedCards: 1 }, { setId: 'sv2', expectedCards: 2 }]), /setselectie|setvolgorde/);
  assert.throws(() => assertCheckpointIdentity({ ...checkpoint, sets: [...checkpoint.sets, { setId: 'sv3', expectedCards: 1, status: 'pending' as const }], setIds: [...checkpoint.setIds, 'sv3'] }, identity, [{ setId: 'sv1', expectedCards: 1 }, { setId: 'sv2', expectedCards: 2 }]), /sets/);
});
