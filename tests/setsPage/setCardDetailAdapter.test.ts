import assert from 'node:assert/strict';
import test from 'node:test';

import { createSetCardDetailProductCopy, getSetCardMutationRetryHandler, getSetWishlistCapabilities } from '../../src/features/setsPage/setCardDetailAdapter.ts';
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

test('Sets wishlist add is only available for confirmed absence', () => {
  const makeRecord = (status: 'owned' | 'trade' | 'missing'): OwnershipRecord<typeof status> => ({
    collectionCardId: `${status}-1`, collectionId: 'collection-1', cardCatalogId: 'card-1', quantity: 1, condition: null, status,
  });

  for (const status of ['owned', 'trade', 'missing'] as const) {
    assert.deepEqual(
      getSetWishlistCapabilities({
        ownership: { kind: 'snapshot', value: { byStatus: { owned: status === 'owned' ? [makeRecord(status)] : [], wishlist: [], trade: status === 'trade' ? [makeRecord(status)] : [], missing: status === 'missing' ? [makeRecord(status)] : [] }, physicalPresence: status === 'owned' || status === 'trade' ? 'present' : 'absent' } },
        hasConflictingRows: false,
      }),
      { canAddWishlist: false, canRemoveWishlist: false },
    );
  }
});

test('Sets retry dispatch preserves each original operation and omits unknown operations', () => {
  const calls: string[] = [];
  const handlers = {
    add: () => calls.push('add'),
    'add-wishlist': () => calls.push('add-wishlist'),
    'remove-wishlist': () => calls.push('remove-wishlist'),
    increase: () => calls.push('increase'),
    decrease: () => calls.push('decrease'),
    delete: () => calls.push('delete'),
  };

  for (const operation of ['add', 'add-wishlist', 'remove-wishlist', 'increase', 'decrease', 'delete'] as const) {
    getSetCardMutationRetryHandler(operation, handlers)?.();
  }
  assert.deepEqual(calls, ['add', 'add-wishlist', 'remove-wishlist', 'increase', 'decrease', 'delete']);
  assert.equal(getSetCardMutationRetryHandler(undefined, handlers), undefined);
  assert.equal(getSetCardMutationRetryHandler('unknown' as never, handlers), undefined);
});
