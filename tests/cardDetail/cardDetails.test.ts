import assert from 'node:assert/strict';
import test from 'node:test';
import { getCardDetailDetails } from '../../src/features/cardDetail/cardDetails.ts';

test('shows available stable card detail fields and hides missing values', () => {
  assert.deepEqual(getCardDetailDetails({
    supertype: 'Pokémon',
    subtypes: ['Basic', 'ex'],
    hp: '220',
    types: ['Fire'],
    evolvesFrom: 'Charmeleon',
    artist: 'Artist',
    regulationMark: 'G',
  }), [
    { label: 'Type kaart', value: 'Pokémon' },
    { label: 'Subtypes', value: 'Basic, ex' },
    { label: 'HP', value: '220' },
    { label: 'Types', value: 'Fire' },
    { label: 'Evolves from', value: 'Charmeleon' },
    { label: 'Illustrator', value: 'Artist' },
    { label: 'Regulation mark', value: 'G' },
  ]);
});
