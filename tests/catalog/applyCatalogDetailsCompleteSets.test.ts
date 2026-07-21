import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runner = readFileSync('scripts/catalog/apply-catalog-details-complete-sets.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260721210000_apply_catalog_details_complete_sets.sql', 'utf8');

test('complete-set details runner binds to the approved read-only quality audit', () => {
  assert.match(runner, /017a7cb5030cca30b9059b3e7e91171fc9c84cf2b24e7c55431706c25945d42f/);
  assert.match(runner, /EXPECTED_SET_COUNT = 35/);
  assert.match(runner, /EXPECTED_DETAIL_ROWS = 607/);
  assert.match(runner, /issues\.length === 1 && result\.issues\[0\] === 'missing_card_details'/);
  assert.match(runner, /validateLocalDatasetCheckout/);
});

test('dry-run and idempotency never invoke the database mutation RPC', () => {
  assert.match(runner, /options\.mode === 'write'/);
  assert.match(runner, /options\.mode === 'idempotency' \? 'filled' : 'empty'/);
  assert.match(runner, /plannedWrites: options\.mode === 'dry-run' \? EXPECTED_DETAIL_ROWS : 0/);
  assert.doesNotMatch(runner, /collection_cards.*\.(insert|update|upsert|delete)/);
  assert.doesNotMatch(runner, /card_external_references.*\.(insert|update|upsert|delete)/);
});

test('transaction updates exactly the guarded card_details field with least privilege', () => {
  assert.match(migration, /jsonb_array_length\(p_rows\) <> 607/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all.*from public/);
  assert.match(migration, /revoke all.*from anon/);
  assert.match(migration, /revoke all.*from authenticated/);
  assert.match(migration, /grant execute.*to service_role/);
  assert.match(migration, /set card_details = r\.target_card_details/);
  assert.doesNotMatch(migration, /set\s+set_code\s*=/);
  assert.doesNotMatch(migration, /update public\.collection_cards|update public\.card_external_references/);
});
