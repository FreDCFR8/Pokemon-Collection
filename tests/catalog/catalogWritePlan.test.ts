import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogWritePlan, validateCatalogWritePlan } from '../../scripts/catalog/catalog-write-plan.ts';
import { buildCanonicalSetAnalysis } from '../../scripts/catalog/import-set.ts';

const set = { setId: 'bw9', setCode: 'bw9', setCatalogId: 'set-catalog-bw9', expectedCards: 1, receivedCards: 1, actions: [{ action: 'existingIdentical' as const, externalSource: 'pokemon_tcg_api', externalId: 'bw9-1', setId: 'bw9', setCode: 'bw9', setCatalogId: 'set-catalog-bw9', cardCatalogId: 'card-bw9-1', cardNumber: '1', name: 'Fixture', rarity: null, image_small: null, image_large: null }], plannedCatalogInserts: 0, plannedReferenceInserts: 0, blockedItems: 0, conflicts: 0 };

function plan() {
  return createCatalogWritePlan({
    source: 'pokemon_tcg_data', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), batch: 'batch-1', sets: ['bw9'], expectedCardsTotal: 1, existingCardsTotal: 1, plannedCatalogInserts: 0, plannedReferenceInserts: 0, conflicts: [], blockedItems: [], perSet: [set],
  });
}

test('writeplan is deterministic, round-trippable and PASS only for zero blockers', () => {
  const value = plan();
  assert.equal(value.finalStatus, 'PASS');
  assert.equal(validateCatalogWritePlan(JSON.parse(JSON.stringify(value)), { datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sets: ['bw9'] }).analysisHash, value.analysisHash);
});

test('writeplan tampering is fail-closed', () => {
  const value = plan();
  const changed = { ...value, plannedCatalogInserts: 1 };
  assert.throws(() => validateCatalogWritePlan(changed, { datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sets: ['bw9'] }), /analysisHash/);
  assert.throws(() => validateCatalogWritePlan(value, { datasetVersion: 'c'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sets: ['bw9'] }), /Datasetcommit/);
});

test('missing set identity becomes blocked and never existingIdentical', () => {
  const analysis = buildCanonicalSetAnalysis({ setId: 'bw9', setName: 'Fixture', expectedCards: 1, matching: {
    classifications: [{ kind: 'existing', externalCard: { id: 'bw9-1', name: 'Fixture', number: '1', details: {} }, catalogCard: { id: 'card-1', set_code: 'bw9', number: '1', pokemon: 'Fixture', rarity: null, image_small: null, image_large: null } }],
    setCode: undefined, setCatalogId: undefined, conflicts: 0, ambiguous: 0, unresolvedWithoutSetMapping: 0, ambiguousExamples: [], conflictExamples: [], unresolvedWithoutSetMappingExamples: [],
  } as any });
  assert.equal(analysis.actions[0].action, 'blocked');
  assert.equal(analysis.actions[0].reason, 'missing_set_catalog_identity');
  assert.equal(analysis.blockedItems, 1);
});

test('blocked plans with missing set identity cannot be approved', () => {
  const blocked = createCatalogWritePlan({
    source: 'pokemon_tcg_data', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), batch: 'batch-1', sets: ['bw9'], expectedCardsTotal: 1, existingCardsTotal: 0, plannedCatalogInserts: 0, plannedReferenceInserts: 0, conflicts: [], blockedItems: [{ externalId: 'bw9-1', reason: 'missing_set_catalog_identity' }], perSet: [{ ...set, setCode: undefined, setCatalogId: undefined, actions: [{ action: 'blocked' as const, externalSource: 'pokemon_tcg_api', externalId: 'bw9-1', setId: 'bw9', cardNumber: '1', reason: 'missing_set_catalog_identity' }], blockedItems: 1 }],
  });
  assert.equal(blocked.finalStatus, 'BLOCKED');
  assert.throws(() => validateCatalogWritePlan(blocked, { datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sets: ['bw9'] }), /niet PASS|blocked/i);
});
