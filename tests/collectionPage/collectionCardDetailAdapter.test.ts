import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldApplyCollectionCardDetailResponse,
  toCollectionCardDetailCard,
  type CollectionCardDetailRequest,
} from '../../src/features/collectionPage/collectionCardDetailAdapter.ts';
import { toCollectionPageCard, type CardsCatalogPageRow } from '../../src/features/collectionPage/collectionPageCardMapper.ts';

const collectionId = 'collection-1';
const cardCatalogId = 'card-1';

function pageRow(overrides: Partial<CardsCatalogPageRow> = {}): CardsCatalogPageRow {
  return {
    id: cardCatalogId,
    pokemon: 'Pikachu',
    set_name: 'Base Set',
    set_code: 'base1',
    number: '58',
    rarity: 'Common',
    image_small: 'https://images.example/small.png',
    image_large: 'https://images.example/large.png',
    collection_cards: { quantity: 1, condition: 'Near Mint', status: 'owned' },
    ...overrides,
  };
}

test('collection rows safely map stable catalog identity, set code, and both image sizes', () => {
  const card = toCollectionPageCard(pageRow({ id: '  card-1  ', set_code: ' base1 ', image_large: ' large.jpg ' }));

  assert.ok(card);
  assert.equal(card.cardCatalogId, 'card-1');
  assert.equal(card.setCode, 'base1');
  assert.equal(card.imageSmall, 'https://images.example/small.png');
  assert.equal(card.imageLarge, 'large.jpg');
  assert.deepEqual(toCollectionCardDetailCard(card).images, {
    small: 'https://images.example/small.png',
    large: 'large.jpg',
  });

  const cardWithInvalidOptionalValues = toCollectionPageCard(pageRow({
    set_code: { invalid: true },
    image_small: 123,
    image_large: '   ',
  }));
  assert.ok(cardWithInvalidOptionalValues);
  assert.equal(cardWithInvalidOptionalValues.setCode, null);
  assert.equal(cardWithInvalidOptionalValues.imageSmall, null);
  assert.equal(cardWithInvalidOptionalValues.imageLarge, null);
});

test('missing or invalid catalog IDs never produce a valid collection card detail model', () => {
  assert.equal(toCollectionPageCard(pageRow({ id: null })), null);
  assert.equal(toCollectionPageCard(pageRow({ id: '   ' })), null);

  const validCard = toCollectionPageCard(pageRow());
  assert.ok(validCard);
  assert.equal(toCollectionCardDetailCard({ ...validCard, cardCatalogId: '' }), null);
});

test('late ownership responses are ignored after close, card, collection, or page changes', () => {
  const completedRequest: CollectionCardDetailRequest = {
    requestId: 4,
    collectionId,
    cardCatalogId,
    page: 2,
  };

  assert.equal(shouldApplyCollectionCardDetailResponse(completedRequest, completedRequest), true);
  assert.equal(shouldApplyCollectionCardDetailResponse(null, completedRequest), false);
  assert.equal(shouldApplyCollectionCardDetailResponse({ ...completedRequest, requestId: 5 }, completedRequest), false);
  assert.equal(shouldApplyCollectionCardDetailResponse({ ...completedRequest, cardCatalogId: 'card-2' }, completedRequest), false);
  assert.equal(shouldApplyCollectionCardDetailResponse({ ...completedRequest, collectionId: 'collection-2' }, completedRequest), false);
  assert.equal(shouldApplyCollectionCardDetailResponse({ ...completedRequest, page: 3 }, completedRequest), false);
});
