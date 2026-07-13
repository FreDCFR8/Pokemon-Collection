import assert from 'node:assert/strict';
import test from 'node:test';

import {
  projectCollectionOwnership,
  projectCollectionOwnershipBatch,
} from '../../src/features/collectionCards/collectionCardOwnershipProjector.ts';

const collectionId = 'collection-1';
const cardCatalogId = 'card-1';

function record(
  overrides: Partial<{
    collectionCardId: unknown;
    collectionId: unknown;
    cardCatalogId: unknown;
    quantity: unknown;
    condition: unknown;
    status: unknown;
  }> = {},
) {
  return {
    collectionCardId: 'collection-card-1',
    collectionId,
    cardCatalogId,
    quantity: 1,
    condition: 'Excellent',
    status: 'owned',
    ...overrides,
  };
}

test('requested cards without collection-state rows are initialized as confirmed absent', () => {
  const result = projectCollectionOwnershipBatch({
    collectionId,
    cardCatalogIds: [cardCatalogId, 'card-2'],
    records: [record()],
  });

  assert.equal(result.get('card-2')?.kind, 'absent');
  assert.equal(result.size, 2);
});

test('owned is kept separate and proves physical presence', () => {
  const result = projectCollectionOwnership({ collectionId, cardCatalogId, records: [record()] });

  assert.equal(result.kind, 'snapshot');
  assert.equal(result.kind === 'snapshot' ? result.value.byStatus.owned.length : 0, 1);
  assert.equal(result.kind === 'snapshot' ? result.value.physicalPresence : undefined, 'present');
});

test('trade is kept separate and proves physical presence', () => {
  const result = projectCollectionOwnership({
    collectionId,
    cardCatalogId,
    records: [record({ status: 'trade' })],
  });

  assert.equal(result.kind, 'snapshot');
  assert.equal(result.kind === 'snapshot' ? result.value.byStatus.trade.length : 0, 1);
  assert.equal(result.kind === 'snapshot' ? result.value.physicalPresence : undefined, 'present');
});

test('wishlist is kept separate and never proves physical presence', () => {
  const result = projectCollectionOwnership({
    collectionId,
    cardCatalogId,
    records: [record({ status: 'wishlist' })],
  });

  assert.equal(result.kind, 'snapshot');
  assert.equal(result.kind === 'snapshot' ? result.value.byStatus.wishlist.length : 0, 1);
  assert.equal(result.kind === 'snapshot' ? result.value.physicalPresence : undefined, 'absent');
});

test('missing is kept separate and never proves physical presence', () => {
  const result = projectCollectionOwnership({
    collectionId,
    cardCatalogId,
    records: [record({ status: 'missing' })],
  });

  assert.equal(result.kind, 'snapshot');
  assert.equal(result.kind === 'snapshot' ? result.value.byStatus.missing.length : 0, 1);
  assert.equal(result.kind === 'snapshot' ? result.value.physicalPresence : undefined, 'absent');
});

test('combined statuses remain separate and physical presence only follows owned or trade', () => {
  const result = projectCollectionOwnership({
    collectionId,
    cardCatalogId,
    records: [
      record({ collectionCardId: 'owned-1', status: 'owned' }),
      record({ collectionCardId: 'trade-1', status: 'trade' }),
      record({ collectionCardId: 'wishlist-1', status: 'wishlist' }),
      record({ collectionCardId: 'missing-1', status: 'missing' }),
    ],
  });

  assert.equal(result.kind, 'snapshot');
  assert.deepEqual(
    result.kind === 'snapshot'
      ? Object.fromEntries(Object.entries(result.value.byStatus).map(([status, records]) => [status, records.length]))
      : {},
    { owned: 1, wishlist: 1, trade: 1, missing: 1 },
  );
  assert.equal(result.kind === 'snapshot' ? result.value.physicalPresence : undefined, 'present');
});

test('exactly one valid owned Near Mint row is manageable', () => {
  const result = projectCollectionOwnership({
    collectionId,
    cardCatalogId,
    records: [record({ condition: 'Near Mint', quantity: 3 })],
  });

  assert.equal(result.kind, 'snapshot');
  assert.deepEqual(
    result.kind === 'snapshot' ? result.value.manageableOwnedNearMintRecord : undefined,
    {
      collectionCardId: 'collection-card-1',
      collectionId,
      cardCatalogId,
      quantity: 3,
      condition: 'Near Mint',
      status: 'owned',
    },
  );
});

test('multiple otherwise manageable rows produce a safe conflict', () => {
  const result = projectCollectionOwnership({
    collectionId,
    cardCatalogId,
    records: [
      record({ collectionCardId: 'collection-card-1', condition: 'Near Mint' }),
      record({ collectionCardId: 'collection-card-2', condition: 'Near Mint' }),
    ],
  });

  assert.equal(result.kind, 'conflict');
  assert.equal(result.kind === 'conflict' ? result.value?.manageableOwnedNearMintRecord : undefined, undefined);
});

test('unknown and invalid rows produce safe conflicts instead of absence or management', async (t) => {
  await t.test('unknown status', () => {
    const result = projectCollectionOwnership({
      collectionId,
      cardCatalogId,
      records: [record({ status: 'loaned' })],
    });

    assert.equal(result.kind, 'conflict');
  });

  await t.test('invalid quantity beside a manageable row', () => {
    const result = projectCollectionOwnership({
      collectionId,
      cardCatalogId,
      records: [
        record({ collectionCardId: 'valid', condition: 'Near Mint' }),
        record({ collectionCardId: 'invalid', quantity: 0 }),
      ],
    });

    assert.equal(result.kind, 'conflict');
    assert.equal(result.kind === 'conflict' ? result.value?.manageableOwnedNearMintRecord : undefined, undefined);
  });

  await t.test('unassignable row makes every requested batch result a conflict', () => {
    const result = projectCollectionOwnershipBatch({
      collectionId,
      cardCatalogIds: [cardCatalogId, 'card-2'],
      records: [record({ cardCatalogId: null })],
    });

    assert.equal(result.get(cardCatalogId)?.kind, 'conflict');
    assert.equal(result.get('card-2')?.kind, 'conflict');
  });
});
