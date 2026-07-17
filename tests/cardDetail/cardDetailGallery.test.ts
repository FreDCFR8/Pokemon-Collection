import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCardDetailReleaseDate, getCardDetailMetadata, getCardDetailNavigationState } from '../../src/features/cardDetail/cardDetailGallery.ts';

const card = {
  cardCatalogId: 'card-1',
  name: 'Pikachu',
  number: '25',
  set: { setCode: 'base1', name: 'Base Set', series: 'Original', releaseDate: '1999-01-09' },
  rarity: 'Rare',
  energyType: 'Lightning',
  details: { artist: 'Artist', nationalPokedexNumbers: [25] },
  images: { small: 'small.jpg', large: 'large.jpg' },
};

test('Card Detail metadata includes available fields and hides missing values', () => {
  assert.deepEqual(getCardDetailMetadata(card), [
    { label: 'Energy Type', value: 'Lightning', icon: 'energy-lightning' },
    { label: 'Rarity', value: 'Rare', icon: 'rarity-rare' },
    { label: 'Pokédex Number', value: '25', icon: 'pokedex' },
    { label: 'Release Date', value: '9 jan 1999', icon: 'release-date' },
    { label: 'Illustrator', value: 'Artist', icon: 'illustrator' },
  ]);

  assert.deepEqual(getCardDetailMetadata({ ...card, number: null, rarity: null, energyType: null, details: null, set: { setCode: null, name: null } }), []);
});

test('formats release dates stably and keeps invalid source values unchanged', () => {
  assert.equal(formatCardDetailReleaseDate('2023-09-22'), '22 sep 2023');
  assert.equal(formatCardDetailReleaseDate('not-a-date'), 'not-a-date');
});

test('derives energy and rarity icons from real values', () => {
  const energyTypes = ['Psychic', 'Darkness', 'Fire', 'Water', 'Grass', 'Lightning', 'Colorless'];
  assert.deepEqual(energyTypes.map((energyType) => getCardDetailMetadata({ ...card, energyType })[0]?.icon), [
    'energy-psychic', 'energy-darkness', 'energy-fire', 'energy-water', 'energy-grass', 'energy-lightning', 'energy-colorless',
  ]);

  const rarities = ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Special Illustration Rare', 'Secret Rare', 'Hyper Rare'];
  assert.deepEqual(rarities.map((rarity) => getCardDetailMetadata({ ...card, rarity })[1]?.icon), [
    'rarity-common', 'rarity-uncommon', 'rarity-rare', 'rarity-ultra', 'rarity-special', 'rarity-secret', 'rarity-hyper',
  ]);
});

test('Card Detail navigation disables previous and next at list boundaries', () => {
  assert.deepEqual(getCardDetailNavigationState(0, 3), { canPrevious: false, canNext: true });
  assert.deepEqual(getCardDetailNavigationState(1, 3), { canPrevious: true, canNext: true });
  assert.deepEqual(getCardDetailNavigationState(2, 3), { canPrevious: true, canNext: false });
  assert.deepEqual(getCardDetailNavigationState(0, 1), { canPrevious: false, canNext: false });
});
