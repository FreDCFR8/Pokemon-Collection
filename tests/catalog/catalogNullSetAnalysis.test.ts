import assert from 'node:assert/strict';
import test from 'node:test';
import { classify } from '../../scripts/catalog/catalog-null-set-analysis.ts';

test('null-set analysis classifies only one exact local source target as a candidate', () => {
  const result = classify(
    [{ id: 'x', external_source: 'legacy', external_id: null, pokemon: 'P', set_name: 'S', set_code: null, number: '1' }],
    [{ card_catalog_id: 'x', source: 'pokemon_tcg_api', external_id: 'sv1-1' }],
    new Map([['sv1-1', 'sv1']]),
  );
  assert.equal(result[0].classification, 'exact_source_candidate');
  assert.equal(result[0].targetSetCode, 'sv1');
});
