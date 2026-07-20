import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260720110000_phase_7b_atomic_catalog_card_chunk.sql', 'utf8');
const runner = readFileSync('scripts/catalog/phase-7b-safe-card-import.ts', 'utf8');

test('Phase 7B atomic chunk RPC keeps cards and references in one invoker transaction', () => {
  assert.match(migration, /create or replace function public\.phase_7b_import_catalog_card_chunk\(p_rows jsonb\)/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /insert into public\.cards_catalog/);
  assert.match(migration, /insert into public\.card_external_references/);
  assert.match(migration, /v_cards_inserted <> v_references_inserted/);
  assert.doesNotMatch(migration, /\bupdate\s+public\.(cards_catalog|card_external_references)\b/i);
  assert.doesNotMatch(migration, /\bdelete\s+from\s+public\.(cards_catalog|card_external_references)\b/i);
});

test('Phase 7B atomic chunk RPC is unavailable to browser roles', () => {
  assert.match(migration, /revoke execute on function public\.phase_7b_import_catalog_card_chunk\(jsonb\) from public/);
  assert.match(migration, /revoke execute on function public\.phase_7b_import_catalog_card_chunk\(jsonb\) from anon/);
  assert.match(migration, /revoke execute on function public\.phase_7b_import_catalog_card_chunk\(jsonb\) from authenticated/);
  assert.match(migration, /grant execute on function public\.phase_7b_import_catalog_card_chunk\(jsonb\) to service_role/);
});

test('Phase 7B runner hard-blocks svp and fixes the approved 116-set / 10,703-card scope', () => {
  assert.match(runner, /const BLOCKED_SET_ID = 'svp'/);
  assert.match(runner, /selected\.length !== 116/);
  assert.match(runner, /rows\.length !== 10703/);
  assert.match(runner, /phase-7b-safe-116/);
  assert.match(runner, /phase_7b_import_catalog_card_chunk/);
});
