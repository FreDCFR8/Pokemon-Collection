import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildQualityResults, parseManifest, parseSourceSets } from '../../scripts/catalog/catalog-quality-audit.ts';

const manifest = JSON.parse(readFileSync('config/catalog/local-pokemon-tcg-data-manifest.json', 'utf8'));
const source = readFileSync('scripts/catalog/catalog-quality-audit.ts', 'utf8');

const sourceSet = { id: 'base1', name: 'Base', series: 'Base', printedTotal: 102, total: 102, releaseDate: '1999/01/09', images: { symbol: 'symbol', logo: 'logo' } };

test('catalog quality audit validates the exact pinned manifest profile', () => {
  const sets = parseManifest(manifest);
  assert.equal(sets.length, 173);
  assert.equal(sets.reduce((total, set) => total + set.expectedCards, 0), 20324);
  assert.throws(() => parseManifest({ ...manifest, datasetVersion: 'changed' }), /Manifestidentiteit/);
});

test('catalog quality audit rejects incomplete source set metadata', () => {
  const scope = [{ setId: 'base1', expectedCards: 102, enabled: true }];
  assert.throws(() => parseSourceSets([{ ...sourceSet, images: { symbol: 'symbol' } }], scope), /onvolledig/);
});

test('catalog quality audit classifies missing metadata, details, and logical duplicates without calling it clean', () => {
  const scope = [{ setId: 'base1', expectedCards: 2, enabled: true }];
  const sourceSets = new Map([['base1', { setCode: 'base1', name: 'Base', series: 'Base', printedTotal: 2, total: 2, releaseDate: '1999/01/09', symbolUrl: 'symbol', logoUrl: 'logo' }]]);
  const results = buildQualityResults(scope, sourceSets, [{ id: 'set-1', set_code: 'base1', name: 'Base', series: null, release_date: null, printed_total: null, total: null, symbol_url: null, logo_url: null }], [
    { id: 'one', set_code: 'base1', number: '1', pokemon: 'Alakazam', card_details: {} },
    { id: 'two', set_code: 'base1', number: '1', pokemon: 'Alakazam', card_details: { hp: '80' } },
  ]);
  assert.deepEqual(results[0].issues, ['missing_series', 'missing_release_date', 'missing_printed_total', 'missing_total', 'missing_symbol_url', 'missing_logo_url', 'set_metadata_conflict', 'missing_card_details', 'duplicate_logical_card']);
  assert.equal(results[0].duplicateLogicalCards, 1);
  assert.equal(results[0].missingCardDetails, 1);
});

test('catalog quality audit compares source and PostgreSQL release dates semantically', () => {
  const scope = [{ setId: 'base1', expectedCards: 0, enabled: true }];
  const sourceSets = new Map([['base1', { setCode: 'base1', name: 'Base', series: 'Base', printedTotal: 0, total: 0, releaseDate: '1999/01/09', symbolUrl: 'symbol', logoUrl: 'logo' }]]);
  const results = buildQualityResults(scope, sourceSets, [{ id: 'set-1', set_code: 'base1', name: 'Base', series: 'Base', release_date: '1999-01-09', printed_total: 0, total: 0, symbol_url: 'symbol', logo_url: 'logo' }], []);
  assert.deepEqual(results[0].issues, []);
});

test('catalog quality audit is read-only and rejects write-shaped invocation', () => {
  assert.match(source, /databaseWritesTotal: 0/);
  assert.match(source, /status: issueSets\.length === 0 \? 'CLEAN' : 'ACTION_REQUIRED'/);
  assert.doesNotMatch(source, /\.(insert|update|upsert|delete|rpc)\s*\(/);
  assert.doesNotMatch(source, /confirm-write|approved-report|--mode/);
});
