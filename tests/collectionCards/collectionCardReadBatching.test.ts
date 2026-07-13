import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COLLECTION_CARD_READ_BATCH_SIZE,
  createCollectionCardReadBatches,
} from '../../src/features/collectionCards/collectionCardReadBatching.ts';

function cardCatalogIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `card-${index + 1}`);
}

test('creates no query batches for 0 card catalog IDs', () => {
  assert.deepEqual(createCollectionCardReadBatches([]), []);
  assert.deepEqual(createCollectionCardReadBatches(['', '   ', '']), []);
});

test('keeps exactly 100 card catalog IDs in one query batch', () => {
  const batches = createCollectionCardReadBatches(cardCatalogIds(100));

  assert.equal(COLLECTION_CARD_READ_BATCH_SIZE, 100);
  assert.deepEqual(batches.map((batch) => batch.length), [100]);
});

test('splits 101 card catalog IDs into fixed query batches', () => {
  const batches = createCollectionCardReadBatches(cardCatalogIds(101));

  assert.deepEqual(batches.map((batch) => batch.length), [100, 1]);
});

test('splits 207 card catalog IDs into fixed query batches', () => {
  const batches = createCollectionCardReadBatches(cardCatalogIds(207));

  assert.deepEqual(batches.map((batch) => batch.length), [100, 100, 7]);
});

test('does not lose, duplicate or overlap IDs between batches', () => {
  const requestedIds = cardCatalogIds(207);
  const batches = createCollectionCardReadBatches([
    '  card-1  ',
    ...requestedIds,
    'card-100',
    '',
    '   ',
    'card-207',
  ]);
  const flattenedIds = batches.flat();

  assert.deepEqual(flattenedIds, requestedIds);
  assert.equal(new Set(flattenedIds).size, requestedIds.length);
  assert.ok(batches.every((batch) => batch.length <= COLLECTION_CARD_READ_BATCH_SIZE));

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const currentBatchIds = new Set(batches[batchIndex]);

    for (let otherBatchIndex = batchIndex + 1; otherBatchIndex < batches.length; otherBatchIndex += 1) {
      assert.ok(batches[otherBatchIndex].every((cardCatalogId) => !currentBatchIds.has(cardCatalogId)));
    }
  }
});
