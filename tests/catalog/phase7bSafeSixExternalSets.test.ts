import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { hasExactLegacySetMapping, selectExternalReferenceScope } from '../../scripts/catalog/phase-7b-import-six-external-sets.ts';
import { PINNED_DATASET_VERSION } from '../../scripts/catalog/local-checkout.ts';

const manifest = JSON.parse(readFileSync('config/catalog/local-pokemon-tcg-data-manifest.json', 'utf8'));
const source = readFileSync('scripts/catalog/phase-7b-import-six-external-sets.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260720135000_phase_7b_safe_six_external_set_cards.sql', 'utf8');

test('safe external-reference scope is exactly six verified legacy sets and 494 cards', () => {
  const scope = selectExternalReferenceScope(manifest);
  assert.deepEqual(scope.map((set) => set.setId), ['swsh10tg', 'swsh11tg', 'swsh12pt5gg', 'swsh12tg', 'swsh9tg', 'swshp']);
  assert.equal(scope.reduce((total, set) => total + set.expectedCards, 0), 494);
  assert.equal(manifest.datasetVersion, PINNED_DATASET_VERSION);
});

test('safe external-reference scope rejects a changed dataset identity or missing approved set', () => {
  assert.throws(() => selectExternalReferenceScope({ ...manifest, datasetVersion: 'wrong' }), /Manifestidentiteit/);
  assert.throws(() => selectExternalReferenceScope({ ...manifest, sets: manifest.sets.map((set: { setId: string }) => set.setId === 'swshp' ? { ...set, setId: 'unapproved-set' } : set) }), /zes-setscope/);
});

test('runner requires exact external mapping evidence and has no set writes', () => {
  assert.match(source, /set_external_references/);
  assert.match(source, /exact extern setmappingbewijs/);
  assert.doesNotMatch(source, /loaded\.setName/);
  assert.doesNotMatch(source, /\.from\('sets_catalog'\)\.(insert|update|upsert|delete)/);
});

test('legacy mapping accepts only an absent series, never an incorrect populated series', () => {
  const expected = selectExternalReferenceScope(manifest)[0];
  const reference = { set_catalog_id: 'legacy-set-id', source: 'pokemon_tcg_api', external_id: expected.setId };
  assert.equal(hasExactLegacySetMapping(expected, { id: 'legacy-set-id', set_code: expected.setId, name: expected.name, series: null }, reference), true);
  assert.equal(hasExactLegacySetMapping(expected, { id: 'legacy-set-id', set_code: expected.setId, name: expected.name, series: 'Wrong series' }, reference), false);
  assert.equal(hasExactLegacySetMapping(expected, { id: 'legacy-set-id', set_code: expected.setId, name: 'Wrong name', series: null }, reference), false);
  assert.equal(hasExactLegacySetMapping(expected, { id: 'legacy-set-id', set_code: expected.setId, name: expected.name, series: null }, { ...reference, external_id: 'wrong' }), false);
});

test('transaction function is internal, insert-only, and requires the exact legacy set reference', () => {
  assert.match(migration, /security invoker/);
  assert.match(migration, /set_reference\.set_catalog_id = set_row\.id/);
  assert.match(migration, /set_reference\.source = 'pokemon_tcg_api'/);
  assert.match(migration, /set_reference\.external_id = incoming\.set_code/);
  assert.match(migration, /insert into public\.cards_catalog/);
  assert.match(migration, /insert into public\.card_external_references/);
  assert.match(migration, /revoke execute on function public\.phase_7b_insert_catalog_card_chunk_external_set_reference\(jsonb\) from public/);
  assert.doesNotMatch(migration, /\b(update|delete)\s+(public\.)?(sets_catalog|set_external_references|cards_catalog|card_external_references)\b/i);
});
