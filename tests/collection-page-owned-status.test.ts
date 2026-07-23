import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { toCollectionPageCard, type CardsCatalogPageRow } from '../src/features/collectionPage/collectionPageCardMapper.ts';

function createRow(collectionCards: CardsCatalogPageRow['collection_cards']): CardsCatalogPageRow {
  return {
    id: 'card-1',
    pokemon: 'Pikachu',
    set_name: 'Test Set',
    set_code: 'test1',
    number: '1',
    rarity: 'Rare',
    image_small: 'small.webp',
    image_large: 'large.webp',
    collection_cards: collectionCards,
  };
}

test('collection mapper ignores wishlist-only cards', () => {
  const card = toCollectionPageCard(
    createRow({ quantity: 0, condition: null, status: 'wishlist' }),
  );

  assert.equal(card, null);
});

test('collection mapper selects the owned row when wishlist and owned rows coexist', () => {
  const card = toCollectionPageCard(
    createRow([
      { quantity: 0, condition: null, status: 'wishlist' },
      { quantity: 2, condition: 'near_mint', status: 'owned' },
    ]),
  );

  assert.equal(card?.quantity, 2);
  assert.equal(card?.condition, 'near_mint');
  assert.equal(card?.status, 'owned');
});

test('collection mapper rejects owned rows with zero quantity', () => {
  const card = toCollectionPageCard(
    createRow({ quantity: 0, condition: 'near_mint', status: 'owned' }),
  );

  assert.equal(card, null);
});

test('collection count and page queries filter owned cards with positive quantity', async () => {
  const serviceSource = await readFile(
    new URL('../src/features/collectionPage/collectionPageService.ts', import.meta.url),
    'utf8',
  );

  assert.equal(serviceSource.match(/\.eq\('collection_cards\.status', 'owned'\)/g)?.length, 2);
  assert.equal(serviceSource.match(/\.gt\('collection_cards\.quantity', 0\)/g)?.length, 2);
});
