import assert from 'node:assert/strict';
import test from 'node:test';
import { getCardDetailDetails, getCardDetailSections } from '../../src/features/cardDetail/cardDetails.ts';

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

test('shows available extended sections and omits empty sections', () => {
  assert.deepEqual(getCardDetailSections({
    abilities: [{ name: 'Flame Body', text: 'Burn your opponent.' }],
    attacks: [{ name: 'Fire Spin', cost: ['Fire', 'Colorless'], damage: '120', text: 'Discard an Energy.' }],
    rules: ['Pokémon ex rule.'],
    weaknesses: [{ type: 'Water', value: '×2' }],
    resistances: [{ type: 'Metal', value: '-30' }],
    retreatCost: ['Colorless', 'Colorless'],
    nationalPokedexNumbers: [6],
    legalities: { unlimited: 'Legal', standard: 'Legal' },
  }), [
    { title: 'Abilities', items: [{ label: 'Flame Body', value: 'Burn your opponent.' }] },
    { title: 'Aanvallen', items: [{ label: 'Fire Spin', value: 'Fire, Colorless · Schade: 120 · Discard an Energy.' }] },
    { title: 'Regels', items: [{ label: 'Regel 1', value: 'Pokémon ex rule.' }] },
    { title: 'Zwaktes', items: [{ label: 'Water', value: 'Water ×2' }] },
    { title: 'Weerstanden', items: [{ label: 'Metal', value: 'Metal -30' }] },
    { title: 'Terugtrekkosten', items: [{ label: 'Energie', value: 'Colorless, Colorless' }] },
    { title: 'Pokédex', items: [{ label: 'Nationale nummers', value: '6' }] },
    { title: 'Legaliteit', items: [{ label: 'Formaten', value: 'unlimited: Legal, standard: Legal' }] },
  ]);
  assert.deepEqual(getCardDetailSections({ abilities: [{ name: 'Empty' }] }), []);
});
