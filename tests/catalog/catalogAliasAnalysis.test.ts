import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeAliases } from '../../scripts/catalog/catalog-alias-analysis.ts';

const source = readFileSync('scripts/catalog/catalog-alias-analysis.ts', 'utf8');
const manifest = [
  { setId: 'sv4pt5', expectedCards: 245, enabled: true },
  { setId: 'base1', expectedCards: 102, enabled: true },
];

test('alias analysis resolves a legacy set code only through its exact external identity', () => {
  const result = analyzeAliases(manifest, [{ id: 'set-1', set_code: 'sv45', name: 'Paldean Fates', source: 'pokemon_tcg_api', source_id: 'sv4pt5' }], [
    { set_catalog_id: 'set-1', source: 'pokemon_tcg_api', external_id: 'sv4pt5' },
  ], [{ id: 'card-1', set_code: 'sv45' }]);
  assert.deepEqual(result.offProfile[0], {
    setCode: 'sv45', cardCount: 1, setCatalog: { id: 'set-1', name: 'Paldean Fates', source: 'pokemon_tcg_api', source_id: 'sv4pt5' },
    pokemonTcgApiExternalIds: ['sv4pt5'], classification: 'alias_candidate', targetSetCode: 'sv4pt5',
  });
  assert.deepEqual(result.missingExpectedSets, [
    { setCode: 'sv4pt5', expectedCards: 245, resolution: 'resolved_by_alias_candidate', aliasSetCode: 'sv45' },
    { setCode: 'base1', expectedCards: 102, resolution: 'no_alias_candidate', aliasSetCode: null },
  ]);
});

test('alias analysis keeps unknown off-profile set codes blocked', () => {
  const result = analyzeAliases(manifest, [], [], [{ id: 'card-1', set_code: 'unknown' }]);
  assert.equal(result.offProfile[0].classification, 'unmapped_off_profile');
  assert.equal(result.offProfile[0].targetSetCode, null);
});

test('alias analysis is read-only', () => {
  assert.match(source, /databaseWritesTotal: 0/);
  assert.doesNotMatch(source, /\.(insert|update|upsert|delete|rpc)\s*\(/);
  assert.doesNotMatch(source, /confirm-write|approved-report|--mode/);
});
