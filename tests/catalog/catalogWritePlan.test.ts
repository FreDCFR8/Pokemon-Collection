import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogWritePlan, validateCatalogWritePlan } from '../../scripts/catalog/catalog-write-plan.ts';
import { buildCanonicalSetAnalysis } from '../../scripts/catalog/import-set.ts';
import { BATCH_1_SET_IDS } from '../../scripts/catalog/import-batch-args.ts';

const set = { setId: 'bw9', setCode: 'bw9', setCatalogId: 'set-catalog-bw9', expectedCards: 1, receivedCards: 1, actions: [{ action: 'existingIdentical' as const, externalSource: 'pokemon_tcg_api', externalId: 'bw9-1', setId: 'bw9', setCode: 'bw9', setCatalogId: 'set-catalog-bw9', cardCatalogId: 'card-bw9-1', cardNumber: '1', name: 'Fixture', rarity: null, image_small: null, image_large: null }], plannedCatalogInserts: 0, plannedReferenceInserts: 0, blockedItems: 0, conflicts: 0 };

function matchingForCards(ids: string[], setCatalogId?: string, setCode?: string, kind: 'existing' | 'new' = 'existing') {
  return {
    setCode, setCatalogId, conflicts: 0, ambiguous: 0, unresolvedWithoutSetMapping: 0, ambiguousExamples: [], conflictExamples: [], unresolvedWithoutSetMappingExamples: [],
    classifications: ids.map((id, index) => kind === 'existing'
      ? { kind: 'existing' as const, externalCard: { id, name: `Fixture ${index + 1}`, number: String(index + 1), details: {} }, catalogCard: { id: `card-${id}`, set_code: setCode ?? null, number: String(index + 1), pokemon: `Fixture ${index + 1}`, rarity: null, image_small: null, image_large: null } }
      : { kind: 'new' as const, externalCard: { id, name: `Fixture ${index + 1}`, number: String(index + 1), details: {} } }),
  } as any;
}

function plan() {
  return createCatalogWritePlan({
    source: 'pokemon_tcg_data', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'c'.repeat(64), batch: 'batch-1', sets: ['bw9'], expectedCardsTotal: 1, existingCardsTotal: 1, plannedCatalogInserts: 0, plannedReferenceInserts: 0, conflicts: [], blockedItems: [], perSet: [set],
  });
}

test('writeplan is deterministic, round-trippable and PASS only for zero blockers', () => {
  const value = plan();
  assert.equal(value.source, 'pokemon_tcg_data');
  assert.equal(value.finalStatus, 'PASS');
  assert.equal(validateCatalogWritePlan(JSON.parse(JSON.stringify(value)), { datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'c'.repeat(64), sets: ['bw9'] }).analysisHash, value.analysisHash);
});

test('writeplan source is required and exact', () => {
  const value = plan();
  assert.throws(() => validateCatalogWritePlan({ ...value, source: undefined }, { datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'c'.repeat(64), sets: ['bw9'] }), /schema|bron/i);
  assert.throws(() => validateCatalogWritePlan({ ...value, source: 'pokemon_tcg_api' }, { datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'c'.repeat(64), sets: ['bw9'] }), /schema|bron/i);
});

test('writeplan tampering is fail-closed', () => {
  const value = plan();
  const changed = { ...value, plannedCatalogInserts: 1 };
  assert.throws(() => validateCatalogWritePlan(changed, { datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'c'.repeat(64), sets: ['bw9'] }), /analysisHash/);
  assert.throws(() => validateCatalogWritePlan(value, { datasetVersion: 'c'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'c'.repeat(64), sets: ['bw9'] }), /Datasetcommit/);
});

test('rapport en writeplan moeten exact dezelfde sourceReportHash gebruiken', () => {
  const value = plan();
  assert.doesNotThrow(() => validateCatalogWritePlan(value, { datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'c'.repeat(64), sets: ['bw9'] }));
  assert.throws(() => validateCatalogWritePlan(value, { datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'd'.repeat(64), sets: ['bw9'] }), /sourceReportHash/);
  assert.throws(() => validateCatalogWritePlan({ ...value, sourceReportHash: undefined }, { datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'c'.repeat(64), sets: ['bw9'] }), /sourceReportHash/);
  assert.throws(() => validateCatalogWritePlan({ ...value, sourceReportHash: 'd'.repeat(64) }, { datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'c'.repeat(64), sets: ['bw9'] }), /analysisHash|sourceReportHash/);
});

test('missing set identity becomes blocked and never existingIdentical', () => {
  for (const matching of [matchingForCards(['bw9-1']), matchingForCards(['bw9-1'], 'set-catalog-bw9'), matchingForCards(['bw9-1'], undefined, 'bw9')]) {
    const analysis = buildCanonicalSetAnalysis({ setId: 'bw9', setName: 'Fixture', expectedCards: 1, matching });
    assert.equal(analysis.actions.length, 1);
    assert.equal(analysis.actions[0].action, 'blocked');
    assert.equal(analysis.actions[0].reason, 'missing_set_catalog_identity');
    assert.equal(analysis.blockedItems, 1);
    assert.equal(Object.values(analysis.actions[0]).some((value) => value === undefined), false);
  }
});

test('two cards without set identity receive exactly one blocked action each', () => {
  const analysis = buildCanonicalSetAnalysis({ setId: 'bw9', setName: 'Fixture', expectedCards: 2, matching: matchingForCards(['bw9-1', 'bw9-2']) });
  assert.equal(analysis.actions.length, 2);
  assert.deepEqual(analysis.actions.map((action) => action.action), ['blocked', 'blocked']);
  assert.equal(analysis.blockedItems, 2);
  assert.deepEqual(analysis.actions.map((action) => action.reason), ['missing_set_catalog_identity', 'missing_set_catalog_identity']);
});

test('valid set identity preserves existing and insertCardAndReference actions', () => {
  const existing = buildCanonicalSetAnalysis({ setId: 'bw9', setName: 'Fixture', expectedCards: 1, matching: matchingForCards(['bw9-1'], 'set-catalog-bw9', 'bw9', 'existing') });
  const inserted = buildCanonicalSetAnalysis({ setId: 'bw9', setName: 'Fixture', expectedCards: 1, matching: matchingForCards(['bw9-2'], 'set-catalog-bw9', 'bw9', 'new') });
  assert.equal(existing.actions[0].action, 'existingIdentical');
  assert.equal(inserted.actions[0].action, 'insertCardAndReference');
  assert.equal(existing.blockedItems + inserted.blockedItems, 0);
});

test('blocked plans with missing set identity cannot be approved', () => {
  const blocked = createCatalogWritePlan({
    source: 'pokemon_tcg_data', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'c'.repeat(64), batch: 'batch-1', sets: ['bw9'], expectedCardsTotal: 1, existingCardsTotal: 0, plannedCatalogInserts: 0, plannedReferenceInserts: 0, conflicts: [], blockedItems: [{ externalId: 'bw9-1', reason: 'missing_set_catalog_identity' }], perSet: [{ ...set, setCode: undefined, setCatalogId: undefined, actions: [{ action: 'blocked' as const, externalSource: 'pokemon_tcg_api', externalId: 'bw9-1', setId: 'bw9', cardNumber: '1', reason: 'missing_set_catalog_identity' }], blockedItems: 1 }],
  });
  assert.equal(blocked.finalStatus, 'BLOCKED');
  assert.throws(() => validateCatalogWritePlan(blocked, { datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'c'.repeat(64), sets: ['bw9'] }), /niet PASS|blocked/i);
});

test('Batch 1-plan behoudt de volledige goedgekeurde totalen', () => {
  const counts = [122, 70, 88, 95, 91, 165, 186, 78, 196, 102, 132, 193, 455];
  let cardIndex = 0;
  let insertIndex = 0;
  const perSet = BATCH_1_SET_IDS.map((setId, setIndex) => {
    const actions = Array.from({ length: counts[setIndex] }, (_, index) => {
      const externalId = `${setId}-${index + 1}`;
      const common = { externalSource: 'pokemon_tcg_api', externalId, setId, setCode: setId, setCatalogId: `catalog-${setId}`, cardNumber: String(index + 1) };
      cardIndex += 1;
      if (cardIndex <= 165) return { action: 'existingIdentical' as const, ...common, cardCatalogId: `card-${externalId}`, name: `Card ${externalId}`, rarity: null, image_small: null, image_large: null };
      insertIndex += 1;
      const id = `00000000-0000-4000-8000-${String(insertIndex).padStart(12, '0')}`;
      return { action: 'insertCardAndReference' as const, ...common, catalogInsert: { id, external_source: 'pokemon_tcg_api', external_id: externalId, pokemon: `Card ${externalId}`, set_name: setId, number: String(index + 1), rarity: null, image_small: null, image_large: null, card_details: {}, set_code: setId }, referenceInsert: { card_catalog_id: id, source: 'pokemon_tcg_api', external_id: externalId, source_url: null, last_seen_at: '1970-01-01T00:00:00.000Z' } };
    });
    return { setId, setCode: setId, setCatalogId: `catalog-${setId}`, expectedCards: counts[setIndex], receivedCards: counts[setIndex], actions, plannedCatalogInserts: actions.filter((action) => action.action === 'insertCardAndReference').length, plannedReferenceInserts: actions.filter((action) => action.action === 'insertCardAndReference').length, blockedItems: 0, conflicts: 0 };
  });
  const value = createCatalogWritePlan({ source: 'pokemon_tcg_data', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion: 'a'.repeat(40), datasetCommit: 'a'.repeat(40), manifestHash: 'b'.repeat(64), sourceReportHash: 'c'.repeat(64), batch: 'batch-1', sets: [...BATCH_1_SET_IDS], expectedCardsTotal: 1973, existingCardsTotal: 165, plannedCatalogInserts: 1808, plannedReferenceInserts: 1808, conflicts: [], blockedItems: [], perSet });
  assert.equal(value.finalStatus, 'PASS');
  assert.equal(value.sets.length, 13);
  assert.equal(value.expectedCardsTotal, 1973);
  assert.equal(value.plannedCatalogInserts, 1808);
  assert.equal(value.plannedReferenceInserts, 1808);
  assert.equal(value.plannedCatalogInserts + value.plannedReferenceInserts, 3616);
});
