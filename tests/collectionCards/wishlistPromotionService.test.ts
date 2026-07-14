import assert from 'node:assert/strict';
import test from 'node:test';
import { promoteWishlistToOwned, WishlistPromotionError, __wishlistPromotionServiceTestUtils } from '../../src/features/collectionCards/wishlistPromotionService.ts';

const params = { collectionId: 'collection-1', cardCatalogId: 'card-1' };
const ownedRow = { id: 'owned-1', collection_id: params.collectionId, card_catalog_id: params.cardCatalogId, quantity: 1, condition: 'Near Mint', status: 'owned' };

function client(response: { data: unknown; error: { message?: string } | null }) {
  const calls: unknown[] = [];
  return {
    calls,
    rpc: async (...args: unknown[]) => { calls.push(args); return response; },
  };
}

test('promotion calls the single RPC with stable collection and catalog IDs', async () => {
  const fake = client({ data: [ownedRow], error: null });
  const result = await promoteWishlistToOwned(params, () => fake);
  assert.deepEqual(result, { collectionCardId: 'owned-1', collectionId: params.collectionId, cardCatalogId: params.cardCatalogId, quantity: 1, condition: 'Near Mint', status: 'owned' });
  assert.deepEqual(fake.calls[0], ['promote_wishlist_to_owned', { p_collection_id: params.collectionId, p_card_catalog_id: params.cardCatalogId }]);
});

test('promotion requires exactly one returned owned row and validates every field', async () => {
  for (const data of [[], [ownedRow, ownedRow], [{ ...ownedRow, collection_id: 'other' }], [{ ...ownedRow, card_catalog_id: 'other' }], [{ ...ownedRow, quantity: 2 }], [{ ...ownedRow, condition: null }], [{ ...ownedRow, status: 'wishlist' }]]) {
    const fake = client({ data, error: null });
    await assert.rejects(() => promoteWishlistToOwned(params, () => fake), (error: unknown) => error instanceof WishlistPromotionError && error.reason === 'invalid-result');
  }
});

test('promotion maps exact-one, conflict and ownership failures to safe typed errors', async () => {
  await assert.rejects(() => promoteWishlistToOwned(params, () => client({ data: null, error: { message: 'Exact één geldige wishlistrij is vereist voor promotie.' } })), (error: unknown) => error instanceof WishlistPromotionError && error.reason === 'conflict');
  await assert.rejects(() => promoteWishlistToOwned(params, () => client({ data: null, error: { message: 'De actieve collectie is niet van de ingelogde gebruiker.' } })), (error: unknown) => error instanceof WishlistPromotionError && error.reason === 'not-ready');
});

test('promotion response helper rejects wrong state and preserves operation name for retry contracts', () => {
  assert.equal(__wishlistPromotionServiceTestUtils.PROMOTION_RPC_NAME, 'promote_wishlist_to_owned');
  assert.throws(() => __wishlistPromotionServiceTestUtils.mapAndValidatePromotionRow({ ...ownedRow, status: 'trade' }, params), (error: unknown) => error instanceof WishlistPromotionError && error.reason === 'invalid-result');
});
