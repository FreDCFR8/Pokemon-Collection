import assert from 'node:assert/strict';
import test from 'node:test';
import { createWishlistCardDetailProductCopy, toWishlistCardDetailCard } from '../../src/features/wishlistPage/wishlistCardDetailAdapter.ts';
import type { CollectionOwnershipState, OwnershipRecord } from '../../src/features/collectionCards/index.ts';
import type { WishlistPageCard } from '../../src/features/wishlistPage/wishlistPageTypes.ts';

const wishlistCard: WishlistPageCard = {
  cardCatalogId: 'catalog-42',
  pokemon: 'Pikachu',
  setName: '151',
  setCode: 'sv3pt5',
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
    set: { setCode: 'sv3pt5', name: '151' },
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
