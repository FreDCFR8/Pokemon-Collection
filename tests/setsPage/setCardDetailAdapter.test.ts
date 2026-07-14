import assert from 'node:assert/strict';
import test from 'node:test';

import { createSetCardDetailProductCopy, getSetWishlistCapabilities } from '../../src/features/setsPage/setCardDetailAdapter.ts';
import type { ConfirmedOwnership, OwnershipRecord } from '../../src/features/collectionCards/index.ts';

const ownedRecord: OwnershipRecord<'owned'> = {
  collectionCardId: 'owned-1',
  collectionId: 'collection-1',
  cardCatalogId: 'card-1',
  quantity: 1,
  condition: 'Near Mint',
  status: 'owned',
};

const normalOwned: ConfirmedOwnership = {
  kind: 'snapshot',
  value: {
    byStatus: { owned: [ownedRecord], wishlist: [], trade: [], missing: [] },
    physicalPresence: 'present',
    manageableOwnedNearMintRecord: ownedRecord,
  },
};

test('Sets adapter preserves normal owned presentation parity', () => {
  assert.deepEqual(
    createSetCardDetailProductCopy({
      ownership: normalOwned,
      hasConflictingRows: false,
      showManageElsewhere: false,
    }),
    {
      statusItems: [],
      physicalPresenceLabel: 'In collectie',
      managementMessage: undefined,
    },
  );
});

test('Sets adapter preserves safe conflict copy', () => {
  assert.deepEqual(
    createSetCardDetailProductCopy({
      ownership: { kind: 'conflict', reason: 'Ambiguous rows.' },
      hasConflictingRows: true,
      showManageElsewhere: false,
    }),
    {
      statusItems: [],
      physicalPresenceLabel: undefined,
      managementMessage: 'Gegevensconflict',
    },
  );
});

test('Sets adapter keeps manage-elsewhere copy ahead of conflict copy', () => {
  assert.equal(
    createSetCardDetailProductCopy({
      ownership: normalOwned,
      hasConflictingRows: true,
      showManageElsewhere: true,
    }).managementMessage,
    'Beheer via collectie',
  );
});

test('Sets wishlist capability transitions from add to remove to collection-add-ready absence', () => {
  const wishlistRecord: OwnershipRecord<'wishlist'> = {
    collectionCardId: 'wishlist-1',
    collectionId: 'collection-1',
    cardCatalogId: 'card-1',
    quantity: 1,
    condition: null,
    status: 'wishlist',
  };
  const wishlistOwnership: ConfirmedOwnership = {
    kind: 'snapshot',
    value: { byStatus: { owned: [], wishlist: [wishlistRecord], trade: [], missing: [] }, physicalPresence: 'absent' },
  };

  assert.deepEqual(getSetWishlistCapabilities({ ownership: { kind: 'absent' }, hasConflictingRows: false }), { canAddWishlist: true, canRemoveWishlist: false });
  assert.deepEqual(getSetWishlistCapabilities({ ownership: wishlistOwnership, hasConflictingRows: false }), { canAddWishlist: false, canRemoveWishlist: true });
  assert.deepEqual(getSetWishlistCapabilities({ ownership: { kind: 'absent' }, hasConflictingRows: false }), { canAddWishlist: true, canRemoveWishlist: false });
});

test('Sets wishlist capabilities fail closed for conflicts and duplicate wishlist rows', () => {
  const wishlistRecord: OwnershipRecord<'wishlist'> = {
    collectionCardId: 'wishlist-1', collectionId: 'collection-1', cardCatalogId: 'card-1', quantity: 1, condition: null, status: 'wishlist',
  };
  const duplicateWishlistOwnership: ConfirmedOwnership = {
    kind: 'snapshot',
    value: { byStatus: { owned: [], wishlist: [wishlistRecord, { ...wishlistRecord, collectionCardId: 'wishlist-2' }], trade: [], missing: [] }, physicalPresence: 'absent' },
  };
  assert.deepEqual(getSetWishlistCapabilities({ ownership: duplicateWishlistOwnership, hasConflictingRows: false }), { canAddWishlist: false, canRemoveWishlist: false });
  assert.deepEqual(getSetWishlistCapabilities({ ownership: { kind: 'conflict', reason: 'conflict' }, hasConflictingRows: true }), { canAddWishlist: false, canRemoveWishlist: false });
});
