import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOG_SEARCH_PAGE_SIZE } from '../../src/features/catalogSearch/catalogSearchTypes.ts';
import { getCatalogSearchRange, isCatalogSearchTermValid, normalizeCatalogSearchTerm, shouldApplyCatalogSearchResponse } from '../../src/features/catalogSearch/catalogSearchHelpers.ts';
import { toCatalogSearchCardDetailCard } from '../../src/features/catalogSearch/catalogSearchCardDetailAdapter.ts';

test('normalizes search input and strips PostgREST filter controls', () => {
  assert.equal(normalizeCatalogSearchTerm('  Pikachu, set.name % _ (x)  '), 'Pikachu set name x');
  assert.equal(normalizeCatalogSearchTerm('a'.repeat(100)).length, 80);
});

test('validates the two-to-eighty character search contract', () => {
  assert.equal(isCatalogSearchTermValid('a'), false);
  assert.equal(isCatalogSearchTermValid('ab'), true);
  assert.equal(isCatalogSearchTermValid('a'.repeat(80)), true);
  assert.equal(isCatalogSearchTermValid('a'.repeat(81)), true);
});

test('calculates bounded 24-card ranges', () => {
  assert.deepEqual(getCatalogSearchRange(1), { page: 1, from: 0, to: 23 });
  assert.deepEqual(getCatalogSearchRange(3), { page: 3, from: 48, to: 71 });
  assert.equal(CATALOG_SEARCH_PAGE_SIZE, 24);
});

test('ignores stale search responses', () => {
  assert.equal(shouldApplyCatalogSearchResponse(2, 1), false);
  assert.equal(shouldApplyCatalogSearchResponse(2, 2), true);
});

test('maps catalog metadata to the shared Card Detail contract', () => {
  assert.deepEqual(toCatalogSearchCardDetailCard({ id: '1', pokemon: 'Pikachu', setName: 'Base Set', setCode: 'base1', number: '25', rarity: 'Rare', imageSmall: 's', imageLarge: 'l' }), {
    cardCatalogId: '1', name: 'Pikachu', number: '25', set: { setCode: 'base1', name: 'Base Set' }, rarity: 'Rare', images: { small: 's', large: 'l' },
  });
});
