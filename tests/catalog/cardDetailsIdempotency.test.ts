import assert from 'node:assert/strict';
import test from 'node:test';
import { cardDetailsSemanticallyEqual } from '../../scripts/catalog/import-set.ts';

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
