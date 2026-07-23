import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildRarityInsights, buildSetInsights, type DashboardCollectionCardRow } from '../src/features/dashboard/dashboardInsights.ts';

const rows: DashboardCollectionCardRow[] = [
  {
    collection_id: 'collection-1',
    quantity: 1,
    status: 'owned',
    cards_catalog: { id: 'owned-positive', set_code: 'test', rarity: 'Rare' },
  },
  {
    collection_id: 'collection-1',
    quantity: 0,
    status: 'owned',
    cards_catalog: { id: 'owned-zero', set_code: 'test', rarity: 'Common' },
  },
  {
    collection_id: 'collection-1',
    quantity: 1,
    status: 'wishlist',
    cards_catalog: { id: 'wishlist-card', set_code: 'wishlist-set', rarity: 'Wishlist Rare' },
  },
];

test('dashboard rarity insights include only positive owned rows', () => {
  assert.deepEqual(buildRarityInsights(rows), [
    { rarity: 'Rare', uniqueCards: 1, percent: 100 },
  ]);
});

test('dashboard set progress includes only positive owned rows', () => {
  const sets = [
    {
      set_code: 'test',
      name: 'Test Set',
      series: null,
      printed_total: 10,
      total: 10,
      release_date: null,
      symbol_url: null,
      logo_url: null,
    },
    {
      set_code: 'wishlist-set',
      name: 'Wishlist Set',
      series: null,
      printed_total: 10,
      total: 10,
      release_date: null,
      symbol_url: null,
      logo_url: null,
    },
  ];

  assert.deepEqual(buildSetInsights(rows, sets as never), [
    {
      setCode: 'test',
      setName: 'Test Set',
      ownedCount: 1,
      total: 10,
      missingCount: 9,
      progressPercent: 10,
    },
  ]);
});

test('dashboard query and collection filter RPC enforce the same ownership rule', async () => {
  const [dashboardSource, migrationSource] = await Promise.all([
    readFile(new URL('../src/features/dashboard/dashboardService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/20260723215500_fix_collection_filter_options_owned_rows.sql', import.meta.url), 'utf8'),
  ]);

  assert.match(dashboardSource, /row\.status === 'owned' && row\.quantity > 0/);
  assert.match(dashboardSource, /status\.eq\.wishlist,and\(status\.eq\.owned,quantity\.gt\.0\)/);
  assert.match(migrationSource, /cc\.status = 'owned'/);
  assert.match(migrationSource, /cc\.quantity > 0/);
});