import assert from 'node:assert/strict';
import test from 'node:test';

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

test('Expansions clear-all inputs restore every set', () => {
  const cleared = { searchTerm: '', series: '', progress: '' as const };
  assert.equal(filterExpansions(sets, progress, cleared).length, 3);
});
