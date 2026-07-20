import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildMetadataDryRunPlan } from '../../scripts/catalog/catalog-set-metadata-dry-run.ts';

const source = readFileSync('scripts/catalog/catalog-set-metadata-dry-run.ts', 'utf8');
const manifest = [{ setId: 'sv4pt5', expectedCards: 245, enabled: true }];
const sourceSets = new Map([['sv4pt5', {
  setCode: 'sv4pt5', name: 'Paldean Fates', series: 'Scarlet & Violet', printedTotal: 91, total: 245,
  releaseDate: '2024/01/26', symbolUrl: 'symbol', logoUrl: 'logo',
}]]);

test('metadata dry-run accepts only exact code or exact legacy pokemon_tcg_api source_id', () => {
  const plan = buildMetadataDryRunPlan(manifest, sourceSets, [
    { id: 'alias', set_code: 'sv45', name: 'Paldean Fates', source: 'pokemon_tcg_api', source_id: 'sv4pt5', series: null, release_date: null, printed_total: null, total: null, symbol_url: null, logo_url: null },
    { id: 'blocked', set_code: 'unknown', name: 'Unknown', source: 'pokemon_tcg_api', source_id: 'sv4pt5', series: null, release_date: null, printed_total: null, total: null, symbol_url: null, logo_url: null },
  ]);
  assert.equal(plan[0].identity, 'exact_legacy_source_id');
  assert.equal(plan[0].action, 'update_metadata');
  assert.deepEqual(plan[0].changedFields, { series: 'Scarlet & Violet', releaseDate: '2024/01/26', printedTotal: 91, total: 245, symbolUrl: 'symbol', logoUrl: 'logo' });
  assert.equal(plan[1].action, 'blocked');
  assert.equal(plan[1].blockReason, 'name_conflict');
});

test('metadata dry-run never changes identity fields and recognizes equivalent date storage', () => {
  const plan = buildMetadataDryRunPlan(manifest, sourceSets, [{
    id: 'exact', set_code: 'sv4pt5', name: 'Paldean Fates', source: 'pokemon_tcg_api', source_id: 'sv4pt5', series: 'Scarlet & Violet',
    release_date: '2024-01-26', printed_total: 91, total: 245, symbol_url: 'symbol', logo_url: 'logo',
  }]);
  assert.equal(plan[0].action, 'already_exact');
  assert.deepEqual(plan[0].changedFields, {});
  assert.doesNotMatch(source, /\.(insert|update|upsert|delete|rpc)\s*\(/);
  assert.match(source, /databaseWritesTotal: 0/);
});
