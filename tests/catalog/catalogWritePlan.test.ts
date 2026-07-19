import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogWritePlan, validateCatalogWritePlan } from '../../scripts/catalog/catalog-write-plan.ts';

const set = { setId: 'bw9', setCode: 'bw9', setCatalogId: 'set-catalog-bw9', expectedCards: 1, receivedCards: 1, actions: [], plannedCatalogInserts: 0, plannedReferenceInserts: 0, blockedItems: 0, conflicts: 0 };

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
