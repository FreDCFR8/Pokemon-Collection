import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCardToWishlist,
  removeCardFromWishlist,
  WishlistMutationError,
  __wishlistMutationServiceTestUtils,
} from '../../src/features/collectionCards/wishlistMutationService.ts';
import type { ConfirmedOwnership } from '../../src/features/collectionCards/collectionCardOwnershipTypes.ts';

const params = { collectionId: 'collection-1', cardCatalogId: 'card-151-1' };

function ownership(wishlist = false): ConfirmedOwnership {
  return {
    kind: 'snapshot',
    value: {
      byStatus: {
        owned: [],
        wishlist: wishlist ? [{ collectionCardId: 'wishlist-row', ...params, quantity: 1, condition: null, status: 'wishlist' }] : [],
        trade: [],
        missing: [],
      },
      physicalPresence: 'absent',
    },
  };
}

function ownershipWithWishlistRow(row: unknown): ConfirmedOwnership {
  const snapshot = ownership(false);
  return {
    kind: 'snapshot',
    value: {
      ...snapshot.value,
      byStatus: {
        ...snapshot.value.byStatus,
        wishlist: [row as never],
      },
    },
  } as ConfirmedOwnership;
}

function fakeClient(response: { data: unknown; error: unknown }) {
  let inserted = false;
  let deleted = false;
  const client = {
    from() {
      const query = {
        insert() { inserted = true; return query; },
        delete() { deleted = true; return query; },
        select() { return query; },
        eq() { return query; },
        is() { return query; },
        single() { return { returns: async () => response }; },
        maybeSingle: async () => response,
      };
      return query;
    },
  };
  return { client, wasInserted: () => inserted, wasDeleted: () => deleted };
}

test('wishlist mutation performs the readiness read and returns an existing wishlist row without inserting', async () => {
  const fake = fakeClient({ data: null, error: null });
  const result = await addCardToWishlist(params, () => fake.client, async () => ownership(true));

  assert.equal(result.status, 'wishlist');
  assert.equal(result.collectionCardId, 'wishlist-row');
  assert.equal(fake.wasInserted(), false);
});

test('existing wishlist row with the wrong collection is rejected before writing', async () => {
  const fake = fakeClient({ data: null, error: null });
  await assert.rejects(
    () => addCardToWishlist(params, () => fake.client, async () => ownershipWithWishlistRow({ collectionCardId: 'row', collectionId: 'other-collection', cardCatalogId: params.cardCatalogId, quantity: 1, condition: null, status: 'wishlist' })),
    (error: unknown) => error instanceof WishlistMutationError && error.reason === 'invalid-result',
  );
  assert.equal(fake.wasInserted(), false);
});

test('existing wishlist row with the wrong catalog card is rejected before writing', async () => {
  const fake = fakeClient({ data: null, error: null });
  await assert.rejects(
    () => addCardToWishlist(params, () => fake.client, async () => ownershipWithWishlistRow({ collectionCardId: 'row', collectionId: params.collectionId, cardCatalogId: 'other-card', quantity: 1, condition: null, status: 'wishlist' })),
    (error: unknown) => error instanceof WishlistMutationError && error.reason === 'invalid-result',
  );
  assert.equal(fake.wasInserted(), false);
});

test('existing row with the wrong status is rejected before writing', async () => {
  const fake = fakeClient({ data: null, error: null });
  await assert.rejects(
    () => addCardToWishlist(params, () => fake.client, async () => ownershipWithWishlistRow({ collectionCardId: 'row', collectionId: params.collectionId, cardCatalogId: params.cardCatalogId, quantity: 1, condition: null, status: 'owned' })),
    (error: unknown) => error instanceof WishlistMutationError && error.reason === 'invalid-result',
  );
  assert.equal(fake.wasInserted(), false);
});

test('existing row with an empty collection-card ID is rejected before writing', async () => {
  const fake = fakeClient({ data: null, error: null });
  await assert.rejects(
    () => addCardToWishlist(params, () => fake.client, async () => ownershipWithWishlistRow({ collectionCardId: '  ', collectionId: params.collectionId, cardCatalogId: params.cardCatalogId, quantity: 1, condition: null, status: 'wishlist' })),
    (error: unknown) => error instanceof WishlistMutationError && error.reason === 'invalid-result',
  );
  assert.equal(fake.wasInserted(), false);
});

test('wishlist mutation validates the inserted server response', async () => {
  const fake = fakeClient({
    data: { id: 'new-row', collection_id: params.collectionId, card_catalog_id: params.cardCatalogId, quantity: 1, condition: null, status: 'wishlist' },
    error: null,
  });
  const result = await addCardToWishlist(params, () => fake.client, async () => ownership(false));

  assert.deepEqual(result, {
    collectionCardId: 'new-row',
    collectionId: params.collectionId,
    cardCatalogId: params.cardCatalogId,
    quantity: 1,
    condition: null,
    status: 'wishlist',
  });
});

test('wishlist removal deletes the exact validated row', async () => {
  const fake = fakeClient({
    data: { id: 'wishlist-row', collection_id: params.collectionId, card_catalog_id: params.cardCatalogId, quantity: 1, condition: null, status: 'wishlist' },
    error: null,
  });
  const result = await removeCardFromWishlist(params, () => fake.client, async () => ownership(true));

  assert.equal(result.collectionCardId, 'wishlist-row');
  assert.equal(fake.wasDeleted(), true);
});

test('wishlist removal fails closed for missing, duplicate or invalid ownership rows', async () => {
  const cases: Array<{ name: string; state: ConfirmedOwnership }> = [
    { name: 'missing', state: ownership(false) },
    {
      name: 'duplicate',
      state: {
        kind: 'snapshot',
        value: { ...ownership(true).value, byStatus: { ...ownership(true).value.byStatus, wishlist: [ownership(true).value.byStatus.wishlist[0], ownership(true).value.byStatus.wishlist[0]] } },
      },
    },
    {
      name: 'invalid identity',
      state: ownershipWithWishlistRow({ collectionCardId: 'row', collectionId: 'other-collection', cardCatalogId: params.cardCatalogId, quantity: 1, condition: null, status: 'wishlist' }),
    },
  ];

  for (const currentCase of cases) {
    const fake = fakeClient({ data: null, error: null });
    await assert.rejects(
      () => removeCardFromWishlist(params, () => fake.client, async () => currentCase.state),
      (error: unknown) => error instanceof WishlistMutationError && ['stale', 'duplicate', 'invalid-result'].includes(error.reason),
      currentCase.name,
    );
    assert.equal(fake.wasDeleted(), false, currentCase.name);
  }
});

test('wishlist removal validates the complete delete response', async () => {
  const mismatches = [
    { collection_id: 'other-collection' },
    { card_catalog_id: 'other-card' },
    { id: 'other-row' },
    { status: 'owned' },
    { quantity: 2 },
    { condition: 'Near Mint' },
  ];

  for (const mismatch of mismatches) {
    const fake = fakeClient({
      data: { id: 'wishlist-row', collection_id: params.collectionId, card_catalog_id: params.cardCatalogId, quantity: 1, condition: null, status: 'wishlist', ...mismatch },
      error: null,
    });
    await assert.rejects(
      () => removeCardFromWishlist(params, () => fake.client, async () => ownership(true)),
      (error: unknown) => error instanceof WishlistMutationError && error.reason === 'invalid-result',
    );
  }
});

test('duplicate insert is resolved by a fresh read and never creates a second wishlist row', async () => {
  const fake = fakeClient({ data: null, error: { code: '23505' } });
  let reads = 0;
  const result = await addCardToWishlist(params, () => fake.client, async () => {
    reads += 1;
    return reads === 1 ? ownership(false) : ownership(true);
  });

  assert.equal(result.collectionCardId, 'wishlist-row');
  assert.equal(reads, 2);
});

test('wishlist mutation rejects a stale or invalid readiness result before writing', async () => {
  const fake = fakeClient({ data: null, error: null });

  await assert.rejects(
    () => addCardToWishlist(params, () => fake.client, async () => ({ kind: 'conflict', reason: 'read failed' })),
    (error: unknown) => error instanceof WishlistMutationError && error.reason === 'not-ready',
  );
  assert.equal(fake.wasInserted(), false);
});

test('wishlist mutation response validation rejects identity and state mismatches', () => {
  assert.throws(
    () => __wishlistMutationServiceTestUtils.mapAndValidateWishlistRow(
      { id: 'row', collection_id: params.collectionId, card_catalog_id: 'other-card', quantity: 1, condition: null, status: 'wishlist' },
      params,
    ),
    (error: unknown) => error instanceof WishlistMutationError && error.reason === 'invalid-result',
  );
});
