import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runner = readFileSync('scripts/catalog/apply-catalog-svp-null-recovery.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260721190000_apply_catalog_svp_null_recovery.sql', 'utf8');

test('SVP recovery accepts only the exact approved 11-card analysis', () => {
  assert.match(runner, /8ba60f79b218692757a8af4d6b7b82279c97ea7a4eaa9964edfc0f94568fd068/);
  assert.match(runner, /exactRecoveryCandidates !== EXPECTED_CANDIDATES/);
  assert.match(runner, /metadataConflicts !== 0/);
  assert.match(runner, /recover-11-svp-null-set-codes/);
  assert.match(runner, /candidate\.mismatches\.length !== 0/);
});

test('SVP dry-run performs no database mutation', () => {
  assert.match(runner, /options\.mode === 'write'/);
  assert.match(runner, /plannedWrites: options\.mode === 'dry-run' \? EXPECTED_CANDIDATES : 0/);
  assert.match(runner, /databaseWritesTotal: writes/);
  assert.doesNotMatch(runner, /\.from\(['"]collection_cards['"]\)\.(insert|update|upsert|delete)/);
  assert.doesNotMatch(runner, /\.from\(['"]card_external_references['"]\)\.(insert|update|upsert|delete)/);
});

test('SVP transaction changes only set_code for exactly 11 guarded rows', () => {
  assert.match(migration, /expected_rows <> 11/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke execute.*public/);
  assert.match(migration, /revoke execute.*anon/);
  assert.match(migration, /revoke execute.*authenticated/);
  assert.match(migration, /grant execute.*service_role/);
  assert.match(migration, /set set_code = r\.target_set_code/);
  assert.doesNotMatch(migration, /set_name\s*=/);
  assert.doesNotMatch(migration, /pokemon\s*=/);
  assert.doesNotMatch(migration, /number\s*=/);
  assert.doesNotMatch(migration, /update public\.collection_cards|update public\.card_external_references/);
});
