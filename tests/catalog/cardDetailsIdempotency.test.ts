import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCatalogCardMatches, cardDetailsSemanticallyEqual, validateExistingIdenticalRecord, type PokemonCard } from '../../scripts/catalog/import-set.ts';

const card: PokemonCard = { id: 'sm4-67', name: 'Lycanroc', number: '67', rarity: 'Rare', images: { small: 'small', large: 'large' }, details: { hp: '110', types: ['Fighting'] } };
const catalogId = '67e47ce4-4519-489d-9fa7-ed395fda6dd6';
const catalog = { id: catalogId, external_source: 'legacy_public_cards', external_id: '6e2ed332-1e23-5bab-a206-06e5df9261ef', set_code: 'sm4', set_name: 'Forbidden Light', number: '67', pokemon: 'Lycanroc', rarity: 'Rare', image_small: 'small', image_large: 'large', card_details: { types: ['Fighting'], hp: '110' } };
const reference = { id: 'ref-1', source: 'pokemon_tcg_api', external_id: 'sm4-67', card_catalog_id: catalogId };

test('legacy cards_catalog plus exact pokemon_tcg_api-reference passes existingIdentical validation', () => {
  assert.doesNotThrow(() => validateExistingIdenticalRecord({ catalog, incoming: card, expectedCatalogId: catalogId, setCode: 'sm4', references: [reference] }));
});

test('legacy existingIdentical without card_details passes and reports a non-blocking diagnostic', () => {
  const diagnosticCodes = validateExistingIdenticalRecord({ catalog: { ...catalog, card_details: null }, incoming: card, expectedCatalogId: catalogId, setCode: 'sm4', references: [reference] });
  assert.deepEqual(diagnosticCodes, ['existing_catalog_details_missing']);
  assert.deepEqual(validateExistingIdenticalRecord({ catalog: { ...catalog, card_details: {} }, incoming: card, expectedCatalogId: catalogId, setCode: 'sm4', references: [reference] }), ['existing_catalog_details_missing']);
});

test('existingIdentical validation fails closed for catalog identity and reference integrity', () => {
  assert.throws(() => validateExistingIdenticalRecord({ catalog: { ...catalog, id: 'wrong-id' }, incoming: card, expectedCatalogId: catalogId, setCode: 'sm4', references: [reference] }), /UUID/);
  assert.throws(() => validateExistingIdenticalRecord({ catalog, incoming: card, expectedCatalogId: catalogId, setCode: 'sm4', references: [] }), /exact één/);
  for (const invalidReference of [
    { ...reference, source: 'legacy_public_cards' },
    { ...reference, external_id: 'wrong-id' },
    { ...reference, card_catalog_id: 'wrong-id' },
  ]) assert.throws(() => validateExistingIdenticalRecord({ catalog, incoming: card, expectedCatalogId: catalogId, setCode: 'sm4', references: [invalidReference] }), /exact één/);
  assert.throws(() => validateExistingIdenticalRecord({ catalog, incoming: card, expectedCatalogId: catalogId, setCode: 'sm4', references: [reference, { ...reference, id: 'ref-2' }] }), /exact één/);
  assert.throws(() => validateExistingIdenticalRecord({ catalog: { ...catalog, external_source: 'untrusted_source' }, incoming: card, expectedCatalogId: catalogId, setCode: 'sm4', references: [reference] }), /external_source/);
  assert.throws(() => validateExistingIdenticalRecord({ catalog: { ...catalog, pokemon: 'Different name' }, incoming: card, expectedCatalogId: catalogId, setCode: 'sm4', references: [reference] }), /pokemon/);
  assert.throws(() => validateExistingIdenticalRecord({ catalog: { ...catalog, card_details: { hp: '90' } }, incoming: card, expectedCatalogId: catalogId, setCode: 'sm4', references: [reference] }), /card_details/);
});

test('insertCardAndReference still requires complete matching card_details', () => {
  const action = { action: 'insertCardAndReference' as const, externalSource: 'pokemon_tcg_api', externalId: card.id, setId: 'sm4', setCode: 'sm4', setCatalogId: 'set-sm4', cardNumber: card.number, catalogInsert: { id: catalogId, external_source: 'pokemon_tcg_api', external_id: card.id, pokemon: card.name, set_name: 'Forbidden Light', number: card.number, rarity: card.rarity, image_small: 'small', image_large: 'large', card_details: card.details, set_code: 'sm4' }, referenceInsert: { card_catalog_id: catalogId, source: 'pokemon_tcg_api', external_id: card.id, source_url: null, last_seen_at: '1970-01-01T00:00:00.000Z' } };
  assert.throws(() => assertCatalogCardMatches({ ...catalog, external_source: 'pokemon_tcg_api', external_id: card.id, card_details: null }, { action, incoming: card, setCode: 'sm4', setName: 'Forbidden Light' }), /card_details/);
  assert.throws(() => assertCatalogCardMatches({ ...catalog, external_source: 'pokemon_tcg_api', external_id: card.id, card_details: { hp: '90' } }, { action, incoming: card, setCode: 'sm4', setName: 'Forbidden Light' }), /card_details/);
});

test('card_details comparison ignores object key order and undefined object fields', () => {
  assert.equal(cardDetailsSemanticallyEqual({ attacks: [{ name: 'A', cost: ['Fire'] }], hp: '120' }, { hp: '120', ignored: undefined, attacks: [{ cost: ['Fire'], name: 'A' }] }), true);
});

test('card_details comparison preserves array order and meaningful values', () => {
  assert.equal(cardDetailsSemanticallyEqual({ attacks: ['A', 'B'] }, { attacks: ['A', 'B'] }), true);
  assert.equal(cardDetailsSemanticallyEqual({ attacks: ['A', 'B'] }, { attacks: ['B', 'A'] }), false);
  assert.equal(cardDetailsSemanticallyEqual({ hp: '120' }, { hp: '130' }), false);
  assert.equal(cardDetailsSemanticallyEqual({ hp: '120', types: ['Fire'] }, { hp: '120' }), false);
  assert.equal(cardDetailsSemanticallyEqual({ evolvesFrom: null }, { evolvesFrom: 'Charmander' }), false);
});

test('card_details treats missing top-level details and null as absent, but not as a real value', () => {
  assert.equal(cardDetailsSemanticallyEqual(undefined, null), true);
  assert.equal(cardDetailsSemanticallyEqual(null, { hp: '110' }), false);
});
