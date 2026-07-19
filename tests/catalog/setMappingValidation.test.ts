import test from 'node:test';
import assert from 'node:assert/strict';
import { reportHash, stableJson, validateSetMappingCandidate } from '../../scripts/catalog/setmapping-validation.ts';

function input(overrides: Partial<Parameters<typeof validateSetMappingCandidate>[0]> = {}) {
  return {
    externalSetId: 'sv10', externalSetName: 'Destined Rivals', externalSeries: 'Scarlet & Violet', proposedSetCode: 'sv10',
    candidateSource: 'pokemon_tcg_api', candidateSourceId: 'sv10', candidateCount: 1,
    catalogSet: { set_code: 'sv10', name: 'Destined Rivals', series: 'Scarlet & Violet', source: 'pokemon_tcg_api', source_id: 'sv10' },
    incomingCardCount: 10, uniqueIncomingCardNumbers: 10, overlappingUniqueCardNumbers: 10,
    existingExternalCardReferences: 10, conflictingExternalCardReferences: 0, ...overrides,
  };
}

test('classifies a safe exact candidate', () => {
  const result = validateSetMappingCandidate(input());
  assert.equal(result.classification, 'safe_for_mapping_review');
  assert.ok(result.reasonCodes.includes('card_number_coverage_complete'));
});

test('blocks a set name conflict', () => {
  const result = validateSetMappingCandidate(input({ catalogSet: { ...input().catalogSet, name: 'Wrong Name' } }));
  assert.equal(result.classification, 'blocked');
  assert.ok(result.reasonCodes.includes('set_name_conflict'));
});

test('blocks a set series conflict', () => {
  const result = validateSetMappingCandidate(input({ catalogSet: { ...input().catalogSet, series: 'Sword & Shield' } }));
  assert.equal(result.classification, 'blocked');
  assert.ok(result.reasonCodes.includes('set_series_conflict'));
});

test('blocks a source-ID conflict', () => {
  const result = validateSetMappingCandidate(input({ catalogSet: { ...input().catalogSet, source_id: 'other' } }));
  assert.equal(result.classification, 'blocked');
  assert.ok(result.reasonCodes.includes('source_id_conflict'));
});

test('blocks insufficient card-number overlap', () => {
  const result = validateSetMappingCandidate(input({ uniqueIncomingCardNumbers: 10, overlappingUniqueCardNumbers: 2 }));
  assert.equal(result.classification, 'blocked');
  assert.ok(result.reasonCodes.includes('card_number_coverage_partial'));
});

test('serializes and hashes reports deterministically', () => {
  const value = { b: 2, a: [{ z: true, y: null }] };
  assert.equal(stableJson(value), '{"a":[{"y":null,"z":true}],"b":2}');
  assert.equal(reportHash(value), reportHash({ a: [{ y: null, z: true }], b: 2 }));
});

test('validation contract has no write operation', () => {
  const source = stableJson(Object.keys(validateSetMappingCandidate(input())));
  assert.equal(source.includes('insert'), false);
  assert.equal(source.includes('update'), false);
  assert.equal(source.includes('delete'), false);
});
