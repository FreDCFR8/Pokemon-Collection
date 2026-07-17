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
    { label: 'Genset', value: 'Original', icon: 'genset' },
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
  assert.equal(getCardDetailMetadata({ ...card, energyType: 'Psychic', rarity: 'Ultra Rare' })[0]?.icon, 'energy-psychic');
  assert.equal(getCardDetailMetadata({ ...card, energyType: 'Darkness', rarity: 'Special Illustration Rare' })[1]?.icon, 'rarity-special');
});

test('Card Detail navigation disables previous and next at list boundaries', () => {
  assert.deepEqual(getCardDetailNavigationState(0, 3), { canPrevious: false, canNext: true });
  assert.deepEqual(getCardDetailNavigationState(1, 3), { canPrevious: true, canNext: true });
  assert.deepEqual(getCardDetailNavigationState(2, 3), { canPrevious: true, canNext: false });
  assert.deepEqual(getCardDetailNavigationState(0, 1), { canPrevious: false, canNext: false });
});
