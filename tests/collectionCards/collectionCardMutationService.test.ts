import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CollectionCardMutationError,
  __collectionCardMutationServiceTestUtils,
  addOwnedNearMintCollectionCard,
  decreaseCollectionCardQuantity,
  increaseCollectionCardQuantity,
} from '../../src/features/collectionCards/collectionCardMutationCore.ts';

const baseRow = {
  id: 'collection-card-1',
  collection_id: 'collection-1',
  card_catalog_id: 'card-1',
  quantity: 1,
  condition: 'Near Mint',
  status: 'owned',
};

function createMockClient(result, calls = []) {
  const builder = {
    insert(values) {
      calls.push(['insert', values]);
      return builder;
    },
    update(values) {
      calls.push(['update', values]);
      return builder;
    },
    delete() {
      calls.push(['delete']);
      return builder;
    },
    select(columns) {
      calls.push(['select', columns]);
      return builder;
    },
    eq(column, value) {
      calls.push(['eq', column, value]);
      return builder;
    },
    single() {
      calls.push(['single']);
      return { returns: async () => result };
    },
    async maybeSingle() {
      calls.push(['maybeSingle']);
      return result;
    },
  };

  return {
    calls,
    createClient: () => ({
      from(table) {
        calls.push(['from', table]);
        return builder;
      },
    }),
  };
}

test('normalizes add input and returns a camelCase domain record', async () => {
  const mock = createMockClient({ data: baseRow, error: null });

  const card = await addOwnedNearMintCollectionCard(
    { collectionId: ' collection-1 ', cardCatalogId: ' card-1 ' },
    mock.createClient,
  );

  assert.deepEqual(card, {
    collectionCardId: 'collection-card-1',
    collectionId: 'collection-1',
    cardCatalogId: 'card-1',
    quantity: 1,
    condition: 'Near Mint',
    status: 'owned',
  });
  assert.deepEqual(mock.calls[1], ['insert', {
    collection_id: 'collection-1',
    card_catalog_id: 'card-1',
    quantity: 1,
    condition: 'Near Mint',
    status: 'owned',
  }]);
});

test('classifies duplicate insert errors as typed duplicate errors', async () => {
  const mock = createMockClient({ data: null, error: { code: '23505' } });

  await assert.rejects(
    () => addOwnedNearMintCollectionCard({ collectionId: 'collection-1', cardCatalogId: 'card-1' }, mock.createClient),
    (error) => error instanceof CollectionCardMutationError && error.reason === 'duplicate',
  );
});

test('validates the complete server response', async () => {
  assert.throws(
    () => __collectionCardMutationServiceTestUtils.mapAndValidateCard(
      { ...baseRow, status: 'wishlist' },
      { collectionId: 'collection-1', cardCatalogId: 'card-1', quantity: 1 },
    ),
    (error) => error instanceof CollectionCardMutationError && error.reason === 'invalid-result',
  );
});

test('increase uses the expected current quantity filter and exact +1 quantity', async () => {
  const mock = createMockClient({ data: { ...baseRow, quantity: 4 }, error: null });

  await increaseCollectionCardQuantity(
    { collectionId: 'collection-1', collectionCardId: 'collection-card-1', currentQuantity: 3 },
    mock.createClient,
  );

  assert.ok(mock.calls.some((call) => call[0] === 'update' && call[1].quantity === 4));
  assert.ok(mock.calls.some((call) => call[0] === 'eq' && call[1] === 'quantity' && call[2] === 3));
});

test('decrease uses the expected current quantity filter and exact -1 quantity', async () => {
  const mock = createMockClient({ data: { ...baseRow, quantity: 2 }, error: null });

  await decreaseCollectionCardQuantity(
    { collectionId: 'collection-1', collectionCardId: 'collection-card-1', currentQuantity: 3 },
    mock.createClient,
  );

  assert.ok(mock.calls.some((call) => call[0] === 'update' && call[1].quantity === 2));
  assert.ok(mock.calls.some((call) => call[0] === 'eq' && call[1] === 'quantity' && call[2] === 3));
});

test('stale update results are typed stale errors', async () => {
  const mock = createMockClient({ data: null, error: null });

  await assert.rejects(
    () => increaseCollectionCardQuantity(
      { collectionId: 'collection-1', collectionCardId: 'collection-card-1', currentQuantity: 3 },
      mock.createClient,
    ),
    (error) => error instanceof CollectionCardMutationError && error.reason === 'stale',
  );
});

test('quantity 1 decrease deletes and validates the deleted row result', async () => {
  const mock = createMockClient({ data: baseRow, error: null });

  const result = await decreaseCollectionCardQuantity(
    { collectionId: 'collection-1', collectionCardId: 'collection-card-1', currentQuantity: 1 },
    mock.createClient,
  );

  assert.deepEqual(result, { action: 'deleted', collectionCardId: 'collection-card-1' });
  assert.ok(mock.calls.some((call) => call[0] === 'delete'));
  assert.ok(mock.calls.some((call) => call[0] === 'eq' && call[1] === 'quantity' && call[2] === 1));
});
