import assert from 'node:assert/strict';
import test from 'node:test';

import { createSetCardDetailProductCopy } from '../../src/features/setsPage/setCardDetailAdapter.ts';
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
