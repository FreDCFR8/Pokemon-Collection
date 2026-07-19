import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertCheckpointIdentity, readCheckpoint, supabaseProjectIdentity, writeAtomicJson, type CatalogBatchCheckpoint, type CheckpointIdentity } from '../../scripts/catalog/checkpoint.ts';
import type { SingleSetDiagnosticResult } from '../../scripts/catalog/diagnostic-result.ts';

const identity: CheckpointIdentity = {
  checkpointSchemaVersion: 2, source: 'pokemon_tcg_data', mode: 'dry-run', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion: '0af6250a22495e4a3e9f60ff45fc3fedc2e0563d', manifestHash: 'a'.repeat(64), setIds: ['sv1', 'sv2'], supabaseProjectIdentity: 'https://example.supabase.co',
};

function diagnostic(setId: string, status: 'PASS' | 'FAIL' = 'PASS'): SingleSetDiagnosticResult {
  return { schemaVersion: 1, setId, expectedCards: 1, receivedCards: 1, status, setCode: status === 'PASS' ? setId : undefined, setMappingStatus: status === 'PASS' ? 'already_reliable' : 'no_candidate', setMapping: status === 'PASS' ? { status: 'already_reliable', reliableSetCode: setId, candidates: [], evidence: [] } : { status: 'no_candidate', candidates: [], evidence: [] }, externalReferenceMatches: 1, fallbackCandidatesQueried: 0, safeFallbackCandidates: 0, newCards: 0, ambiguousItems: 0, conflicts: 0, unresolvedWithoutSetMapping: 0, metadataUnchanged: 1, metadataChanged: 0, blockedItems: status === 'PASS' ? 0 : 1, plannedDatabaseWrites: 0, databaseWrites: 0, failureReasons: status === 'PASS' ? [] : ['unexpected_runner_failure'], examples: status === 'PASS' ? {} : { unexpected_runner_failure: [{ reason: 'test' }] } };
}

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
  const checkpoint: CatalogBatchCheckpoint = { ...identity, startedAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:01.000Z', sets: [{ setId: 'sv1', expectedCards: 1, status: 'passed', receivedCards: 1, plannedWrites: 0, databaseWrites: 0, diagnostic: diagnostic('sv1') }, { setId: 'sv2', expectedCards: 1, status: 'pending' }] };
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
  return { ...identity, startedAt: '2026-07-18T00:00:00.000Z', updatedAt: '2026-07-18T00:00:01.000Z', sets: [{ setId: 'sv1', expectedCards: 1, status: 'passed', receivedCards: 1, plannedWrites: 0, databaseWrites: 0, diagnostic: diagnostic('sv1') }, { setId: 'sv2', expectedCards: 2, status: 'pending' }] };
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

test('schema-1 checkpoint is rejected before resume execution', () => {
  const old = { ...validCheckpoint(), checkpointSchemaVersion: 1 };
  assert.throws(() => readCheckpoint(writeTemp(old)), /verwacht 2/);
});

test('passed and failed checkpoint sets require full diagnostics', () => {
  const invalidPassed = validCheckpoint(); invalidPassed.sets[0].diagnostic = undefined;
  assert.throws(() => readCheckpoint(writeTemp(invalidPassed)), /vereist volledige diagnostiek/);
  const invalidPending = validCheckpoint(); invalidPending.sets[1].diagnostic = diagnostic('sv2');
  assert.throws(() => readCheckpoint(writeTemp(invalidPending)), /mag geen diagnostiek/);
});

test('checkpoint v2 preserves both fallback counters exactly', () => {
  const value = validCheckpoint();
  value.sets[0].diagnostic = { ...diagnostic('sv1'), fallbackCandidatesQueried: 1, safeFallbackCandidates: 0 };
  const loaded = readCheckpoint(writeTemp(value));
  assert.equal(loaded.sets[0].diagnostic?.fallbackCandidatesQueried, 1);
  assert.equal(loaded.sets[0].diagnostic?.safeFallbackCandidates, 0);
});

function writeTemp(value: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), 'pokemon-checkpoint-')), 'checkpoint.json'); writeAtomicJson(path, value); return path;
}
