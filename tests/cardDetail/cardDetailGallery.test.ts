import assert from 'node:assert/strict';
import test from 'node:test';
import { getCardDetailMetadata, getCardDetailNavigationState } from '../../src/features/cardDetail/cardDetailGallery.ts';

const card = {
  cardCatalogId: 'card-1',
  name: 'Pikachu',
  number: '25',
  set: { setCode: 'base1', name: 'Base Set', releaseDate: '1999-01-09' },
  rarity: 'Rare',
  energyType: 'Lightning',
  details: { artist: 'Artist', nationalPokedexNumbers: [25] },
  images: { small: 'small.jpg', large: 'large.jpg' },
};

test('Card Detail metadata includes available fields and hides missing values', () => {
  assert.deepEqual(getCardDetailMetadata(card), [
    { label: 'Illustrator', value: 'Artist' },
    { label: 'Release Date', value: '1999-01-09' },
    { label: 'Rarity', value: 'Rare' },
    { label: 'National Number', value: '25' },
    { label: 'Energy Type', value: 'Lightning' },
  ]);

  assert.deepEqual(getCardDetailMetadata({ ...card, number: null, rarity: null, energyType: null, details: null, set: { setCode: null, name: null } }), []);
});

test('Card Detail navigation disables previous and next at list boundaries', () => {
  assert.deepEqual(getCardDetailNavigationState(0, 3), { canPrevious: false, canNext: true });
  assert.deepEqual(getCardDetailNavigationState(1, 3), { canPrevious: true, canNext: true });
  assert.deepEqual(getCardDetailNavigationState(2, 3), { canPrevious: true, canNext: false });
  assert.deepEqual(getCardDetailNavigationState(0, 1), { canPrevious: false, canNext: false });
});
