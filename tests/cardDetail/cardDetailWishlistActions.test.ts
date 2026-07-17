import assert from 'node:assert/strict';
import test from 'node:test';
import { areCardDetailActionsBlocked, getCardDetailActionMode, getCardDetailWishlistAction } from '../../src/features/cardDetail/cardDetailMutationState.ts';
import type { CardDetailMutationState } from '../../src/features/cardDetail/CardDetailDialog.tsx';
import type { ConfirmedOwnership } from '../../src/features/collectionCards/index.ts';

const absentOwnership: ConfirmedOwnership = { kind: 'absent' };
const ownedOwnership: ConfirmedOwnership = {
  kind: 'snapshot',
  value: {
    physicalPresence: 'present',
    manageableOwnedNearMintRecord: { collectionCardId: 'owned-1', collectionId: 'collection-1', cardCatalogId: 'card-1', quantity: 2, condition: 'Near Mint', status: 'owned' },
    byStatus: { owned: [{ collectionCardId: 'owned-1', collectionId: 'collection-1', cardCatalogId: 'card-1', quantity: 2, condition: 'Near Mint', status: 'owned' }], wishlist: [], trade: [], missing: [] },
  },
};
const wishlistOwnership: ConfirmedOwnership = {
  kind: 'snapshot',
  value: {
    physicalPresence: 'absent',
    manageableOwnedNearMintRecord: null,
    byStatus: { owned: [], wishlist: [{ collectionCardId: 'wish-1', collectionId: 'collection-1', cardCatalogId: 'card-1', quantity: 1, condition: null, status: 'wishlist' }], trade: [], missing: [] },
  },
};

test('shared Card Detail blocks repeated wishlist/quantity actions during pending and conflict', () => {
  const pending: CardDetailMutationState = { status: 'pending', operation: 'remove-wishlist' };
  const conflict: CardDetailMutationState = { status: 'conflict', operation: 'remove-wishlist', refreshStatus: 'pending', message: 'Conflict' };

  assert.equal(areCardDetailActionsBlocked(pending), true);
  assert.equal(areCardDetailActionsBlocked(conflict), true);
  assert.equal(areCardDetailActionsBlocked({ status: 'idle' }), false);
  assert.equal(areCardDetailActionsBlocked({ status: 'success', message: 'Klaar' }), false);
});

test('shared Card Detail uses an explicit add action for absent cards', () => {
  assert.equal(getCardDetailActionMode({ readOnly: false, ownership: absentOwnership }), 'add');
  assert.notEqual(getCardDetailActionMode({ readOnly: false, ownership: absentOwnership }), 'quantity');
});

test('shared Card Detail exposes one wishlist action in the primary action row', () => {
  const base = { canAdd: false, canIncrease: false, canDecrease: false };
  assert.equal(getCardDetailWishlistAction({ ...base, canAddWishlist: true, canRemoveWishlist: false }), 'add');
  assert.equal(getCardDetailWishlistAction({ ...base, canAddWishlist: false, canRemoveWishlist: true }), 'remove');
  assert.equal(getCardDetailWishlistAction({ ...base, canAddWishlist: false, canRemoveWishlist: false }), null);
  assert.equal(getCardDetailWishlistAction({ ...base, canAddWishlist: true, canRemoveWishlist: true }), 'add');
});

test('absent pending keeps the explicit add action visible and blocked', () => {
  assert.equal(getCardDetailActionMode({ readOnly: false, ownership: absentOwnership }), 'add');
  assert.equal(areCardDetailActionsBlocked({ status: 'pending', operation: 'add' }), true);
  assert.notEqual(getCardDetailActionMode({ readOnly: false, ownership: absentOwnership }), 'quantity');
});

test('shared Card Detail switches to quantity after owned confirmation and preserves wishlist promotion', () => {
  assert.equal(getCardDetailActionMode({ readOnly: false, ownership: ownedOwnership }), 'quantity');
  assert.equal(getCardDetailActionMode({ readOnly: false, ownership: wishlistOwnership }), 'wishlist');
  assert.equal(getCardDetailActionMode({ readOnly: true, ownership: absentOwnership }), 'read-only');
});

test('conflicting, unknown, and unmanageable ownership never become an active add mode', () => {
  assert.equal(getCardDetailActionMode({ readOnly: false, ownership: { kind: 'conflict', reason: 'conflict' } }), 'unavailable');
  assert.equal(getCardDetailActionMode({ readOnly: false, ownership: undefined }), 'unavailable');
  assert.equal(getCardDetailActionMode({ readOnly: false, ownership: { kind: 'snapshot', value: { ...ownedOwnership.value, manageableOwnedNearMintRecord: null } } }), 'unavailable');
});
