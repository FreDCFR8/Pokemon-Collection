import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCardDetailOwnershipPresentation,
  hasConfirmedPhysicalPresence,
} from '../../src/features/cardDetail/cardDetailOwnershipPresentation.ts';
import type { CollectionStatus, ConfirmedOwnership, OwnershipRecord } from '../../src/features/collectionCards/index.ts';

const collectionId = 'collection-1';
const cardCatalogId = 'card-1';

function record(status: CollectionStatus, quantity = 1, id = `${status}-1`): OwnershipRecord {
  return {
    collectionCardId: id,
    collectionId,
    cardCatalogId,
    quantity,
    condition: status === 'owned' ? 'Near Mint' : null,
    status,
  };
}

function snapshot(records: Partial<Record<CollectionStatus, OwnershipRecord[]>>): ConfirmedOwnership {
  const byStatus = {
    owned: records.owned ?? [],
    wishlist: records.wishlist ?? [],
    trade: records.trade ?? [],
    missing: records.missing ?? [],
  };
  const manageableOwnedNearMintRecord = byStatus.owned.length === 1 && byStatus.owned[0].condition === 'Near Mint'
    ? byStatus.owned[0]
    : undefined;

  return {
    kind: 'snapshot',
    value: {
      byStatus,
      physicalPresence: byStatus.owned.length > 0 || byStatus.trade.length > 0 ? 'present' : 'absent',
      manageableOwnedNearMintRecord,
    },
  };
}

test('shared presentation suppresses the redundant status row for normal manageable owned', () => {
  const ownership = snapshot({ owned: [record('owned', 2)] });

  assert.equal(hasConfirmedPhysicalPresence(ownership), true);
  assert.deepEqual(createCardDetailOwnershipPresentation({ ownership }), {
    statusItems: [],
    physicalPresenceLabel: 'In collectie',
    conflictMessage: undefined,
  });
});

test('shared presentation keeps trade distinct while confirming physical presence', () => {
  const ownership = snapshot({ trade: [record('trade', 2)] });

  assert.equal(hasConfirmedPhysicalPresence(ownership), true);
  assert.deepEqual(createCardDetailOwnershipPresentation({ ownership }), {
    statusItems: [{ status: 'trade', label: 'Voor ruil · 2 exemplaren' }],
    physicalPresenceLabel: 'In collectie',
    conflictMessage: undefined,
  });
});

test('shared presentation keeps wishlist without physical presence', () => {
  const ownership = snapshot({ wishlist: [record('wishlist')] });

  assert.equal(hasConfirmedPhysicalPresence(ownership), false);
  assert.deepEqual(createCardDetailOwnershipPresentation({ ownership }), {
    statusItems: [{ status: 'wishlist', label: 'Op wishlist · 1 exemplaar' }],
    physicalPresenceLabel: undefined,
    conflictMessage: undefined,
  });
});

test('shared presentation keeps missing without physical presence', () => {
  const ownership = snapshot({ missing: [record('missing')] });

  assert.equal(hasConfirmedPhysicalPresence(ownership), false);
  assert.deepEqual(createCardDetailOwnershipPresentation({ ownership }), {
    statusItems: [{ status: 'missing', label: 'Ontbreekt · 1 exemplaar' }],
    physicalPresenceLabel: undefined,
    conflictMessage: undefined,
  });
});

test('shared presentation returns safe conflict copy', () => {
  assert.deepEqual(
    createCardDetailOwnershipPresentation({
      ownership: { kind: 'conflict', reason: 'Ambiguous rows.' },
    }),
    {
      statusItems: [],
      physicalPresenceLabel: undefined,
      conflictMessage: 'Gegevensconflict',
    },
  );
});

test('shared presentation aggregates status quantities in stable status order', () => {
  const ownership = snapshot({
    wishlist: [record('wishlist', 1, 'wishlist-1'), record('wishlist', 4, 'wishlist-2')],
    trade: [record('trade', 2, 'trade-1'), record('trade', 3, 'trade-2')],
  });

  assert.deepEqual(createCardDetailOwnershipPresentation({ ownership }).statusItems, [
    { status: 'wishlist', label: 'Op wishlist · 5 exemplaren' },
    { status: 'trade', label: 'Voor ruil · 5 exemplaren' },
  ]);
});
