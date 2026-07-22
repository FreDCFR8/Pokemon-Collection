import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRarityInsights, buildRecentSets, buildSetInsights } from '../src/features/dashboard/dashboardInsights.ts';

const row = (cardId: string, setCode: string, rarity: string, status = 'owned') => ({
  id: `collection-${cardId}`,
  collection_id: 'collection-1',
  quantity: 1,
  status,
  added_at: '2026-07-22',
  created_at: '2026-07-22',
  cards_catalog: { id: cardId, pokemon: 'Test Pokémon', set_name: 'Test set', set_code: setCode, number: '1', rarity, image_small: null },
});

test('dashboard insights keep wishlist out of owned set progress and use unique cards', () => {
  const rows = [row('one', 'sv1', 'Rare'), row('one', 'sv1', 'Rare'), row('wish', 'sv1', 'Common', 'wishlist')];
  const sets = [{ id: 'set-1', set_code: 'sv1', name: 'Test set', series: null, generation: null, release_date: '2026-01-01', printed_total: 10, total: 10, symbol_url: null, logo_url: null, source: null, source_id: null }];
  assert.deepEqual(buildSetInsights(rows.filter((entry) => entry.status === 'owned') as never, sets), [{ setCode: 'sv1', setName: 'Test set', ownedCount: 1, total: 10, missingCount: 9, progressPercent: 10 }]);
});

test('rarity insights expose exact unique counts and percentages', () => {
  const insights = buildRarityInsights([row('one', 'sv1', 'Rare'), row('two', 'sv1', 'Common'), row('two', 'sv1', 'Common')] as never);
  assert.deepEqual(insights, [{ rarity: 'Common', uniqueCards: 1, percent: 50 }, { rarity: 'Rare', uniqueCards: 1, percent: 50 }]);
});

test('recent set summaries preserve bounded deterministic catalog order and missing artwork', () => {
  const sets = [
    { id: 'set-2', set_code: 'sv2', name: 'Nieuwste', series: null, generation: null, release_date: '2026-02-01', printed_total: 20, total: 20, symbol_url: null, logo_url: null, source: null, source_id: null },
    { id: 'set-1', set_code: 'sv1', name: 'Ouder', series: null, generation: null, release_date: '2026-01-01', printed_total: 10, total: 10, symbol_url: 'symbol.png', logo_url: null, source: null, source_id: null },
  ];
  const summaries = buildRecentSets(sets, [{ setCode: 'sv1', setName: 'Ouder', ownedCount: 2, total: 10, missingCount: 8, progressPercent: 20 }]);
  assert.deepEqual(summaries.map((set) => [set.setCode, set.logoUrl, set.symbolUrl, set.ownedCount, set.progressPercent]), [['sv2', null, null, null, null], ['sv1', null, 'symbol.png', 2, 20]]);
});
