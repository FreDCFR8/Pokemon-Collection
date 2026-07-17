import assert from 'node:assert/strict';
import test from 'node:test';
import { createWishlistCardDetailProductCopy, toWishlistCardDetailCard } from '../../src/features/wishlistPage/wishlistCardDetailAdapter.ts';
import type { CollectionOwnershipState, OwnershipRecord } from '../../src/features/collectionCards/index.ts';
import { createWishlistPageErrorState, createWishlistPageLoadingState, getSafeWishlistPageAfterRemoval, getWishlistPageRange, getWishlistVisibleRange, resolveWishlistRemovalRecovery, shouldApplyWishlistDetailResponse, type WishlistPageCard } from '../../src/features/wishlistPage/wishlistPageTypes.ts';

const wishlistCard: WishlistPageCard = {
  cardCatalogId: 'catalog-42',
  pokemon: 'Pikachu',
  setName: '151',
  setCode: 'sv3pt5',
  series: 'Scarlet & Violet',
  releaseDate: '2023-09-22',
  number: '025',
  rarity: 'Common',
  imageSmall: 'https://img.test/small.png',
  imageLarge: 'https://img.test/large.png',
};

const wishlistRecord: OwnershipRecord<'wishlist'> = {
  collectionCardId: 'wishlist-1',
  collectionId: 'collection-1',
  cardCatalogId: 'catalog-42',
  quantity: 1,
  condition: null,
  status: 'wishlist',
};

test('Wishlist adapter preserves catalog identity, metadata and large image', () => {
  assert.deepEqual(toWishlistCardDetailCard(wishlistCard), {
    cardCatalogId: 'catalog-42',
    name: 'Pikachu',
    number: '025',
    set: { setCode: 'sv3pt5', name: '151', series: 'Scarlet & Violet', releaseDate: '2023-09-22' },
    rarity: 'Common',
    images: { small: 'https://img.test/small.png', large: 'https://img.test/large.png' },
  });
});

test('Wishlist adapter rejects missing catalog identity', () => {
  assert.equal(toWishlistCardDetailCard({ ...wishlistCard, cardCatalogId: '  ' }), null);
});

test('Wishlist read-only copy reuses shared ownership status presentation', () => {
  const ownership: CollectionOwnershipState = {
    status: 'ready',
    value: {
      kind: 'snapshot',
      value: {
        byStatus: { owned: [], wishlist: [wishlistRecord], trade: [], missing: [] },
        physicalPresence: 'absent',
        manageableOwnedNearMintRecord: undefined,
      },
    },
  };

  assert.deepEqual(createWishlistCardDetailProductCopy(ownership), {
    statusItems: [{ status: 'wishlist', label: 'Op wishlist · 1 exemplaar' }],
    physicalPresenceLabel: undefined,
    managementMessage: undefined,
  });
});

test('Wishlist read-only copy keeps loading and error states available for retry UI', () => {
  assert.deepEqual(createWishlistCardDetailProductCopy({ status: 'loading' }), {
    statusItems: [],
    physicalPresenceLabel: undefined,
    managementMessage: undefined,
  });
  assert.deepEqual(createWishlistCardDetailProductCopy({ status: 'error', retryable: true }), {
    statusItems: [],
    physicalPresenceLabel: undefined,
    managementMessage: undefined,
  });
});

test('Wishlist pagination keeps the browser bounded and addresses the second page', () => {
  assert.deepEqual(getWishlistPageRange(1), { from: 0, to: 23 });
  assert.deepEqual(getWishlistPageRange(2), { from: 24, to: 47 });
  assert.deepEqual(getWishlistPageRange(3, 10), { from: 20, to: 29 });
});

test('Wishlist page retry preserves the requested page and resets only Wishlist state', () => {
  const error = createWishlistPageErrorState(2, 'Load failed');
  const retryState = createWishlistPageLoadingState(error.page);
  assert.equal(error.status, 'error');
  assert.equal(retryState.status, 'loading');
  assert.equal(retryState.page, 2);
  assert.deepEqual(retryState.cards, []);
});

test('Wishlist removal safely moves an emptied last page to the previous valid page', () => {
  assert.equal(getSafeWishlistPageAfterRemoval(2, 24), 1);
  assert.equal(getSafeWishlistPageAfterRemoval(2, 25), 2);
  assert.equal(getSafeWishlistPageAfterRemoval(1, 0), 1);
});

test('Wishlist summary reports the visible range without exceeding the total', () => {
  assert.deepEqual(getWishlistVisibleRange(0, 1), { first: 0, last: 0 });
  assert.deepEqual(getWishlistVisibleRange(25, 1), { first: 1, last: 24 });
  assert.deepEqual(getWishlistVisibleRange(25, 2), { first: 25, last: 25 });
});

test('Wishlist promotion reuses bounded refresh clamping when the promoted card was the last row', () => {
  assert.equal(getSafeWishlistPageAfterRemoval(2, 24), 1);
  assert.equal(getSafeWishlistPageAfterRemoval(2, 25), 2);
});

test('Wishlist remove recovery closes when stale row disappeared and keeps exact remove retry when it remains', () => {
  assert.equal(resolveWishlistRemovalRecovery({ kind: 'absent' }), 'close');
  assert.equal(resolveWishlistRemovalRecovery({ kind: 'snapshot', value: { byStatus: { owned: [], wishlist: [], trade: [], missing: [] }, physicalPresence: 'absent' } }), 'close');
  assert.equal(resolveWishlistRemovalRecovery({ kind: 'snapshot', value: { byStatus: { owned: [], wishlist: [{ collectionCardId: 'row', collectionId: 'collection', cardCatalogId: 'card', quantity: 1, condition: null, status: 'wishlist' }], trade: [], missing: [] }, physicalPresence: 'absent' } }), 'retry-remove');
  assert.equal(resolveWishlistRemovalRecovery({ kind: 'conflict', reason: 'late response' }), 'blocked');
  assert.equal(resolveWishlistRemovalRecovery(null), 'blocked');
});

test('Wishlist late recovery responses are ignored after close, card, collection or page changes', () => {
  const expected = { mutationRequestId: 4, cardCatalogId: 'card-1', collectionId: 'collection-1', page: 2 };
  assert.equal(shouldApplyWishlistDetailResponse(expected, expected), true);
  assert.equal(shouldApplyWishlistDetailResponse(expected, { ...expected, mutationRequestId: 5 }), false);
  assert.equal(shouldApplyWishlistDetailResponse(expected, { ...expected, cardCatalogId: 'card-2' }), false);
  assert.equal(shouldApplyWishlistDetailResponse(expected, { ...expected, collectionId: 'collection-2' }), false);
  assert.equal(shouldApplyWishlistDetailResponse(expected, { ...expected, page: 1 }), false);
});
