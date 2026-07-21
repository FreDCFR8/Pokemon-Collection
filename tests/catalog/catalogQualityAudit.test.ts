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

test('catalog quality audit resolves sv4pt5 only through one exact legacy Pokémon TCG API source_id', () => {
  const scope = [{ setId: 'sv4pt5', expectedCards: 2, enabled: true }];
  const sourceSets = new Map([['sv4pt5', { setCode: 'sv4pt5', name: 'Paldean Fates', series: 'Scarlet & Violet', printedTotal: 2, total: 2, releaseDate: '2024/01/26', symbolUrl: 'symbol', logoUrl: 'logo' }]]);
  const databaseSets = [{ id: 'set-45', set_code: 'sv45', name: 'Paldean Fates', series: 'Scarlet & Violet', release_date: '2024-01-26', printed_total: 2, total: 2, symbol_url: 'symbol', logo_url: 'logo', source: 'pokemon_tcg_api', source_id: 'sv4pt5' }];
  const cards = [
    { id: 'one', set_code: 'sv45', number: '1', pokemon: 'Mew', card_details: { hp: '60' } },
    { id: 'two', set_code: 'sv45', number: '2', pokemon: 'Pikachu', card_details: { hp: '70' } },
  ];
  const results = buildQualityResults(scope, sourceSets, databaseSets, cards);
  assert.equal(results[0].catalogSetCode, 'sv45');
  assert.equal(results[0].resolution, 'external_reference_alias');
  assert.equal(results[0].catalogCards, 2);
  assert.deepEqual(results[0].issues, []);
});

test('catalog quality audit fails closed when a legacy Pokémon TCG API source_id alias is ambiguous', () => {
  const scope = [{ setId: 'sv4pt5', expectedCards: 0, enabled: true }];
  const sourceSets = new Map([['sv4pt5', { setCode: 'sv4pt5', name: 'Paldean Fates', series: 'Scarlet & Violet', printedTotal: 0, total: 0, releaseDate: '2024/01/26', symbolUrl: 'symbol', logoUrl: 'logo' }]]);
  const databaseSets = [
    { id: 'set-a', set_code: 'sv45', name: 'Paldean Fates', series: 'Scarlet & Violet', release_date: '2024-01-26', printed_total: 0, total: 0, symbol_url: 'symbol', logo_url: 'logo', source: 'pokemon_tcg_api', source_id: 'sv4pt5' },
    { id: 'set-b', set_code: 'unexpected', name: 'Paldean Fates', series: 'Scarlet & Violet', release_date: '2024-01-26', printed_total: 0, total: 0, symbol_url: 'symbol', logo_url: 'logo', source: 'pokemon_tcg_api', source_id: 'sv4pt5' },
  ];
  const results = buildQualityResults(scope, sourceSets, databaseSets, []);
  assert.equal(results[0].resolution, 'missing');
  assert.equal(results[0].catalogSetCode, null);
  assert.ok(results[0].issues.includes('missing_set_row'));
});

test('catalog quality audit is read-only and rejects write-shaped invocation', () => {
  assert.match(source, /databaseWritesTotal: 0/);
  assert.match(source, /status: issueSets\.length === 0 \? 'CLEAN' : 'ACTION_REQUIRED'/);
  assert.doesNotMatch(source, /\.(insert|update|upsert|delete|rpc)\s*\(/);
  assert.doesNotMatch(source, /confirm-write|approved-report|--mode/);
});
