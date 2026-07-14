import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260714182541_collection_cards_wishlist_delete_security.sql', 'utf8');

test('wishlist delete migration is a narrow authenticated ownership policy', () => {
  assert.match(migration, /for delete/i);
  assert.match(migration, /to authenticated/i);
  assert.match(migration, /p\.auth_user_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /status = 'wishlist'/i);
  assert.match(migration, /quantity = 1/i);
  assert.match(migration, /condition is null/i);
  assert.doesNotMatch(migration, /create policy .*for update/i);
  assert.doesNotMatch(migration, /security definer/i);
  assert.doesNotMatch(migration, /service_role/i);
  assert.doesNotMatch(migration, /insert into|update .* set|delete from/i);
});
