import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSetCardDetailProductCopy,
  hasConfirmedPhysicalPresence,
} from '../../src/features/setsPage/setCardDetailAdapter.ts';
import type { CollectionStatus, ConfirmedOwnership, OwnershipRecord } from '../../src/features/collectionCards/index.ts';

const collectionId = 'collection-1';
const cardCatalogId = 'card-1';

function record(status: CollectionStatus, quantity = 1, id = `${status}-1`): OwnershipRecord {
  return {
    collectionCardId: id,
    collectionId,
    cardCatalogId,
    quantity,
    condition: status === 'owned' ? 'Near Mint' : 'Excellent',
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

test('owned confirms physical presence without redundant normal status item', () => {
  const ownership = snapshot({ owned: [record('owned')] });

  assert.equal(hasConfirmedPhysicalPresence(ownership), true);
  assert.deepEqual(createSetCardDetailProductCopy({ ownership, hasConflictingRows: false, showManageElsewhere: false }), {
    statusItems: [],
    physicalPresenceLabel: 'In collectie',
    managementMessage: undefined,
  });
});

test('trade confirms physical presence and is shown as trade copy', () => {
  const ownership = snapshot({ trade: [record('trade', 2)] });

  assert.equal(hasConfirmedPhysicalPresence(ownership), true);
  assert.deepEqual(createSetCardDetailProductCopy({ ownership, hasConflictingRows: false, showManageElsewhere: false }).statusItems, [
    { status: 'trade', label: 'Voor ruil · 2 exemplaren' },
  ]);
});

test('wishlist does not confirm physical presence', () => {
  const ownership = snapshot({ wishlist: [record('wishlist')] });

  assert.equal(hasConfirmedPhysicalPresence(ownership), false);
  assert.deepEqual(createSetCardDetailProductCopy({ ownership, hasConflictingRows: false, showManageElsewhere: false }), {
    statusItems: [{ status: 'wishlist', label: 'Op wishlist · 1 exemplaar' }],
    physicalPresenceLabel: undefined,
    managementMessage: undefined,
  });
});

test('missing does not confirm physical presence', () => {
  const ownership = snapshot({ missing: [record('missing')] });

  assert.equal(hasConfirmedPhysicalPresence(ownership), false);
  assert.deepEqual(createSetCardDetailProductCopy({ ownership, hasConflictingRows: false, showManageElsewhere: false }).statusItems, [
    { status: 'missing', label: 'Ontbreekt · 1 exemplaar' },
  ]);
});

test('conflict does not confirm physical presence and reports conflict copy', () => {
  const ownership: ConfirmedOwnership = { kind: 'conflict', reason: 'Ambiguous rows.' };

  assert.equal(hasConfirmedPhysicalPresence(ownership), false);
  assert.deepEqual(createSetCardDetailProductCopy({ ownership, hasConflictingRows: true, showManageElsewhere: false }), {
    statusItems: [],
    physicalPresenceLabel: undefined,
    managementMessage: 'Gegevensconflict',
  });
});

test('multiple records with the same status are grouped once with summed quantity', () => {
  const ownership = snapshot({
    trade: [record('trade', 2, 'trade-1'), record('trade', 3, 'trade-2')],
    wishlist: [record('wishlist', 1, 'wishlist-1'), record('wishlist', 4, 'wishlist-2')],
  });

  assert.equal(hasConfirmedPhysicalPresence(ownership), true);
  assert.deepEqual(createSetCardDetailProductCopy({ ownership, hasConflictingRows: false, showManageElsewhere: false }).statusItems, [
    { status: 'wishlist', label: 'Op wishlist · 5 exemplaren' },
    { status: 'trade', label: 'Voor ruil · 5 exemplaren' },
  ]);
});
