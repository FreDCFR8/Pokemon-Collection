import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { selectSafeScope } from '../../scripts/catalog/phase-7b-import-safe-116.ts';
import { PINNED_DATASET_VERSION } from '../../scripts/catalog/local-checkout.ts';

const manifest = JSON.parse(readFileSync('config/catalog/local-pokemon-tcg-data-manifest.json', 'utf8'));
const review = JSON.parse(readFileSync('config/catalog/remaining-set-catalog-mapping-review.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20260720123000_phase_7b_safe_116_card_import.sql', 'utf8');

test('safe Phase 7B scope is exactly 116 sets and excludes svp', () => {
  const scope = selectSafeScope(review);
  assert.equal(scope.length, 116);
  assert.equal(scope.some((set) => set.setId === 'svp'), false);
  assert.equal(scope.reduce((total, set) => total + set.expectedCards, 0), 10_703);
});

test('safe Phase 7B scope rejects a changed dataset identity and an invalid scope', () => {
  assert.throws(() => selectSafeScope({ ...review, createdFrom: { ...review.createdFrom, datasetVersion: 'wrong' } }), /Reviewidentiteit/);
  assert.throws(() => selectSafeScope({ ...review, proposedMappings: review.proposedMappings.slice(0, 116) }), /Reviewidentiteit/);
  assert.equal(manifest.datasetVersion, PINNED_DATASET_VERSION);
});

test('transaction function is internal, insert-only, and keeps both records together', () => {
  assert.match(migration, /security invoker/);
  assert.match(migration, /insert into public\.cards_catalog/);
  assert.match(migration, /insert into public\.card_external_references/);
  assert.match(migration, /inserted_cards <> inserted_references/);
  assert.match(migration, /conflicts with existing data; nothing was changed/);
  assert.match(migration, /revoke execute on function public\.phase_7b_insert_catalog_card_chunk\(jsonb\) from public/);
  assert.doesNotMatch(migration, /\bupdate\s+public\.(cards_catalog|card_external_references)\b/i);
  assert.doesNotMatch(migration, /\bdelete\s+from\s+public\.(cards_catalog|card_external_references)\b/i);
});
