import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { filterExpansions } from '../../src/components/catalogPage/catalogPageHelpers.ts';

const sets = [
  { id: 'a', set_code: 'base1', name: 'Base Set', series: 'Base', generation: null, release_date: null, printed_total: 102, total: 102, symbol_url: null, logo_url: null, source: null, source_id: null },
  { id: 'b', set_code: 'neo1', name: 'Neo Genesis', series: 'Neo', generation: null, release_date: null, printed_total: 111, total: 111, symbol_url: null, logo_url: null, source: null, source_id: null },
  { id: 'c', set_code: 'sv1', name: 'Scarlet & Violet', series: 'Scarlet & Violet', generation: null, release_date: null, printed_total: 198, total: 198, symbol_url: null, logo_url: null, source: null, source_id: null },
];

const progress = new Map([
  ['neo1', { setCode: 'neo1', ownedCount: 4, total: 111, printedTotal: 111, progressPercent: 4 }],
  ['sv1', { setCode: 'sv1', ownedCount: 198, total: 198, printedTotal: 198, progressPercent: 100 }],
]);

test('Expansions search includes set code and series', () => {
  assert.deepEqual(filterExpansions(sets, progress, { searchTerm: 'neo1', series: '', progress: '' }).map((set) => set.id), ['b']);
  assert.deepEqual(filterExpansions(sets, progress, { searchTerm: 'scarlet', series: '', progress: '' }).map((set) => set.id), ['c']);
});

test('Expansions progress filters distinguish not started, started and complete', () => {
  assert.deepEqual(filterExpansions(sets, progress, { searchTerm: '', series: '', progress: 'not-started' }).map((set) => set.id), ['a']);
  assert.deepEqual(filterExpansions(sets, progress, { searchTerm: '', series: '', progress: 'started' }).map((set) => set.id), ['b']);
  assert.deepEqual(filterExpansions(sets, progress, { searchTerm: '', series: '', progress: 'complete' }).map((set) => set.id), ['c']);
});

test('Expansions combine series and progress filters', () => {
  assert.deepEqual(
    filterExpansions(sets, progress, { searchTerm: '', series: 'Neo', progress: 'started' }).map((set) => set.id),
    ['b'],
  );
});

test('Expansions with an unknown or zero total are never complete', () => {
  const incompleteSets = [
    { ...sets[0], id: 'unknown-total', set_code: 'unknown-total', total: null, printed_total: null },
    { ...sets[0], id: 'zero-total', set_code: 'zero-total', total: 0, printed_total: 0 },
  ];
  const completeProgress = new Map(incompleteSets.map((set) => [set.set_code, { ownedCount: 999 }]));

  assert.deepEqual(
    filterExpansions(incompleteSets, completeProgress, { searchTerm: '', series: '', progress: 'complete' }),
    [],
  );
});

test('Expansions clear-all inputs restore every set', () => {
  const cleared = { searchTerm: '', series: '', progress: '' as const };
  assert.equal(filterExpansions(sets, progress, cleared).length, 3);
});

test('catalog pages use only the shared header and filter controls', async () => {
  const [collection, wishlist, expansions] = await Promise.all([
    readFile('src/features/collectionPage/CollectionPage.tsx', 'utf8'),
    readFile('src/features/wishlistPage/WishlistPage.tsx', 'utf8'),
    readFile('src/features/setsPage/SetsPage.tsx', 'utf8'),
  ]);

  for (const source of [collection, wishlist, expansions]) {
    assert.match(source, /CatalogPageHeader/);
    assert.match(source, /CatalogFilterSelect/);
    assert.doesNotMatch(source, /CollectionHeader|CollectionToolbar|WishlistToolbar/);
    assert.doesNotMatch(source, /\{\/\*[\s\S]*?(?:header|toolbar)[\s\S]*?\*\/\}/i);
  }
});
