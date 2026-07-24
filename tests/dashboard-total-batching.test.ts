import assert from 'node:assert/strict';
import test from 'node:test';

import { __dashboardServiceTestUtils } from '../src/features/dashboard/dashboardService.ts';

function createRow(index: number, status: 'owned' | 'wishlist', quantity = 1) {
  return {
    id: `row-${index.toString().padStart(4, '0')}`,
    collection_id: 'collection-lars',
    quantity,
    status,
    added_at: '2026-07-24',
    created_at: `2026-07-24T10:${String(index % 60).padStart(2, '0')}:00.000Z`,
    cards_catalog: {
      id: `card-${index}`,
      pokemon: `Pokemon ${index}`,
      set_name: 'Test Set',
      set_code: 'test',
      number: String(index),
      rarity: 'Common',
      image_small: null,
      image_large: null,
      card_details: null,
    },
  };
}

test('dashboard summary counts every owned quantity beyond the first 1000 rows', () => {
  const rows = [
    ...Array.from({ length: 1100 }, (_, index) => createRow(index, 'owned')),
    ...Array.from({ length: 4 }, (_, index) => createRow(2000 + index, 'wishlist')),
  ];

  const summary = __dashboardServiceTestUtils.toSummary(
    { id: 'profile-lars', display_name: 'Lars' },
    { id: 'collection-lars', profile_id: 'profile-lars' },
    rows,
    [],
  );

  assert.equal(summary.totalQuantity, 1100);
  assert.equal(summary.wishlistCards, 4);
});

test('wishlist rows never change cards in collection', () => {
  const ownedRows = [createRow(1, 'owned'), createRow(2, 'owned', 3)];
  const before = __dashboardServiceTestUtils.toSummary(
    { id: 'profile-lars', display_name: 'Lars' },
    { id: 'collection-lars', profile_id: 'profile-lars' },
    ownedRows,
    [],
  );
  const after = __dashboardServiceTestUtils.toSummary(
    { id: 'profile-lars', display_name: 'Lars' },
    { id: 'collection-lars', profile_id: 'profile-lars' },
    [...ownedRows, createRow(3, 'wishlist')],
    [],
  );

  assert.equal(before.totalQuantity, 4);
  assert.equal(after.totalQuantity, 4);
  assert.equal(after.wishlistCards, 1);
});

test('dashboard row reads use bounded batches', () => {
  assert.equal(__dashboardServiceTestUtils.DASHBOARD_COLLECTION_ROWS_BATCH_SIZE, 500);
});
