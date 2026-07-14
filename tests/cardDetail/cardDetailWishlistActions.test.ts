import assert from 'node:assert/strict';
import test from 'node:test';
import { areCardDetailActionsBlocked } from '../../src/features/cardDetail/cardDetailMutationState.ts';
import type { CardDetailMutationState } from '../../src/features/cardDetail/CardDetailDialog.tsx';

test('shared Card Detail blocks repeated wishlist/quantity actions during pending and conflict', () => {
  const pending: CardDetailMutationState = { status: 'pending', operation: 'remove-wishlist' };
  const conflict: CardDetailMutationState = { status: 'conflict', operation: 'remove-wishlist', refreshStatus: 'pending', message: 'Conflict' };

  assert.equal(areCardDetailActionsBlocked(pending), true);
  assert.equal(areCardDetailActionsBlocked(conflict), true);
  assert.equal(areCardDetailActionsBlocked({ status: 'idle' }), false);
  assert.equal(areCardDetailActionsBlocked({ status: 'success', message: 'Klaar' }), false);
});
