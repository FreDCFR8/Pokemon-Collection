import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260714193000_phase_7c_2g_promote_wishlist_to_owned.sql', 'utf8');

test('wishlist promotion migration is atomic, invoker-scoped and explicitly ownership checked', () => {
  assert.match(migration, /security invoker/i);
  assert.match(migration, /p\.auth_user_id\s*=\s*auth\.uid\(\)/i);
  assert.match(migration, /select count\(\*\).*into v_wishlist_count/is);
  assert.match(migration, /v_wishlist_count <> 1/i);
  assert.match(migration, /status in \('owned', 'trade', 'missing'\)/i);
  assert.match(migration, /delete from public\.collection_cards/i);
  assert.match(migration, /get diagnostics v_deleted_count = row_count/i);
  assert.match(migration, /insert into public\.collection_cards/i);
  assert.match(migration, /revoke execute on function public\.promote_wishlist_to_owned/i);
  assert.match(migration, /grant execute on function public\.promote_wishlist_to_owned.*authenticated/is);
});
