import assert from 'node:assert/strict';
import test from 'node:test';
import { areCardDetailActionsBlocked, getCardDetailActionMode } from '../../src/features/cardDetail/cardDetailMutationState.ts';
import type { CardDetailMutationState } from '../../src/features/cardDetail/CardDetailDialog.tsx';

test('shared Card Detail blocks repeated wishlist/quantity actions during pending and conflict', () => {
  const pending: CardDetailMutationState = { status: 'pending', operation: 'remove-wishlist' };
  const conflict: CardDetailMutationState = { status: 'conflict', operation: 'remove-wishlist', refreshStatus: 'pending', message: 'Conflict' };

  assert.equal(areCardDetailActionsBlocked(pending), true);
  assert.equal(areCardDetailActionsBlocked(conflict), true);
  assert.equal(areCardDetailActionsBlocked({ status: 'idle' }), false);
  assert.equal(areCardDetailActionsBlocked({ status: 'success', message: 'Klaar' }), false);
});

test('shared Card Detail uses an explicit add action for absent cards', () => {
  assert.equal(getCardDetailActionMode({ readOnly: false, canAdd: true, isWishlistOnly: false }), 'add');
  assert.notEqual(getCardDetailActionMode({ readOnly: false, canAdd: true, isWishlistOnly: false }), 'quantity');
});

test('shared Card Detail keeps quantity controls for owned and promotion for wishlist-only cards', () => {
  assert.equal(getCardDetailActionMode({ readOnly: false, canAdd: false, isWishlistOnly: false }), 'quantity');
  assert.equal(getCardDetailActionMode({ readOnly: false, canAdd: false, isWishlistOnly: true }), 'wishlist');
  assert.equal(getCardDetailActionMode({ readOnly: true, canAdd: true, isWishlistOnly: false }), 'read-only');
});
