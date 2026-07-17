import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    { label: 'Energy Type', value: 'Lightning', icons: ['energy-lightning'] },
    { label: 'Rarity', value: 'Rare', icons: ['rarity-rare'] },
    { label: 'Pokédex Number', value: '25', icons: ['pokedex'] },
    { label: 'Release Date', value: '9 jan 1999', icons: ['release-date'] },
    { label: 'Illustrator', value: 'Artist', icons: ['illustrator'] },
  ]);

  assert.deepEqual(getCardDetailMetadata({ ...card, number: null, rarity: null, energyType: null, details: null, set: { setCode: null, name: null } }), []);
});

test('formats release dates stably and keeps invalid source values unchanged', () => {
  assert.equal(formatCardDetailReleaseDate('2023-09-22'), '22 sep 2023');
  assert.equal(formatCardDetailReleaseDate('not-a-date'), 'not-a-date');
});

test('derives all supported energy icons from card_details.types and supports multiple types', () => {
  const energyTypes = ['Psychic', 'Darkness', 'Fire', 'Water', 'Grass', 'Lightning', 'Colorless', 'Fighting', 'Metal', 'Fairy', 'Dragon'];
  assert.deepEqual(energyTypes.map((energyType) => getCardDetailMetadata({ ...card, details: { ...card.details, types: [energyType] } })[0]?.icons), [
    ['energy-psychic'], ['energy-darkness'], ['energy-fire'], ['energy-water'], ['energy-grass'], ['energy-lightning'], ['energy-colorless'],
    ['energy-fighting'], ['energy-metal'], ['energy-fairy'], ['energy-dragon'],
  ]);

  assert.deepEqual(getCardDetailMetadata({ ...card, details: { ...card.details, types: ['Fire', 'Dragon'] } })[0], {
    label: 'Energy Type', value: 'Fire, Dragon', icons: ['energy-fire', 'energy-dragon'],
  });
  assert.deepEqual(getCardDetailMetadata({ ...card, details: { ...card.details, types: ['Mystery'] } })[0]?.icons, ['energy-unknown']);
});

test('derives every supported rarity icon and uses a neutral fallback', () => {
  const rarities = ['Common', 'Uncommon', 'Rare', 'Rare Holo', 'Double Rare', 'Ultra Rare', 'Illustration Rare', 'Special Illustration Rare', 'Hyper Rare', 'Secret Rare', 'ACE SPEC Rare'];
  assert.deepEqual(rarities.map((rarity) => getCardDetailMetadata({ ...card, rarity })[1]?.icons), [
    ['rarity-common'], ['rarity-uncommon'], ['rarity-rare'], ['rarity-rare-holo'], ['rarity-double'], ['rarity-ultra'],
    ['rarity-illustration'], ['rarity-special'], ['rarity-hyper'], ['rarity-secret'], ['rarity-ace-spec'],
  ]);
  assert.deepEqual(getCardDetailMetadata({ ...card, rarity: 'Promo' })[1]?.icons, ['rarity-unknown']);
});

test('Card Detail icon implementation references only bundled local assets', () => {
  const source = readFileSync(new URL('../../src/features/cardDetail/CardDetailAttributeIcon.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /https?:\/\//);
  assert.doesNotMatch(source, /<use\b/);
  assert.match(source, /assets\/tcg-symbols\/energy-psychic\.png/);
  assert.match(source, /assets\/tcg-symbols\/energy-darkness\.png/);
  assert.match(source, /assets\/tcg-symbols\/rarity-common\.png/);
  assert.match(source, /assets\/tcg-symbols\/rarity-ace-spec\.png/);
});

test('always assigns visible neutral icons to Pokédex Number, Release Date and Illustrator rows', () => {
  const metadata = getCardDetailMetadata(card);
  assert.deepEqual(metadata.slice(2).map(({ label, icons }) => ({ label, icons })), [
    { label: 'Pokédex Number', icons: ['pokedex'] },
    { label: 'Release Date', icons: ['release-date'] },
    { label: 'Illustrator', icons: ['illustrator'] },
  ]);
});

test('Card Detail navigation disables previous and next at list boundaries', () => {
  assert.deepEqual(getCardDetailNavigationState(0, 3), { canPrevious: false, canNext: true });
  assert.deepEqual(getCardDetailNavigationState(1, 3), { canPrevious: true, canNext: true });
  assert.deepEqual(getCardDetailNavigationState(2, 3), { canPrevious: true, canNext: false });
  assert.deepEqual(getCardDetailNavigationState(0, 1), { canPrevious: false, canNext: false });
});
