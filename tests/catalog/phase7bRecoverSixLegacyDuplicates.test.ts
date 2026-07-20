import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRepairPlan } from '../../scripts/catalog/phase-7b-recover-six-legacy-duplicates.ts';

const migration = readFileSync('supabase/migrations/20260720143000_phase_7b_recover_six_legacy_duplicates.sql', 'utf8');
const details = { hp: '100' };
const legacy = { id: '00000000-0000-4000-8000-000000000001', external_source: 'legacy_public_cards', external_id: 'legacy', pokemon: 'Falinks', set_name: 'Astral Radiance Trainer Gallery', set_code: 'swsh10tg', number: 'TG07', rarity: 'Rare', image_small: null, image_large: null, card_details: {}, created_at: '2026-07-08T00:00:00Z' };
const imported = { ...legacy, id: '00000000-0000-4000-8000-000000000002', external_source: 'pokemon_tcg_api', external_id: 'swsh10tg-TG07', card_details: details, created_at: '2026-07-20T00:00:00Z' };

test('recovery plan refuses any scope other than exactly 36 proven legacy/API pairs', () => {
  assert.throws(() => createRepairPlan([legacy, imported], [{ id: 'a', card_catalog_id: legacy.id, source: 'pokemon_tcg_api', external_id: 'swsh10tg-tg07' }, { id: 'b', card_catalog_id: imported.id, source: 'pokemon_tcg_api', external_id: imported.external_id }], new Map([[legacy.id, 1], [imported.id, 0]])), /exact 36/);
});
test('recovery migration preserves collection rows and blocks mismatched details', () => {
  assert.match(migration, /collection_cards cc where cc\.card_catalog_id = legacy\.id\) <> 1/);
  assert.match(migration, /duplicate\.card_details is distinct from incoming\.card_details/);
  assert.match(migration, /delete from public\.card_external_references/);
  assert.match(migration, /delete from public\.cards_catalog/);
  assert.doesNotMatch(migration, /\b(update|delete|insert)\s+(into\s+)?public\.collection_cards\b/i);
  assert.match(migration, /security invoker/);
});

test('recovery runner batches reference and collection prechecks', () => {
  const source = readFileSync('scripts/catalog/phase-7b-recover-six-legacy-duplicates.ts', 'utf8');
  assert.match(source, /function batches<T>/);
  assert.match(source, /batches\(ids\)\.map\(\(idsPart\)/);
  assert.match(source, /Reference- of collectieprecheck mislukt: \$\{/);
});
