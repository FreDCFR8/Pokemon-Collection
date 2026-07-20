import assert from 'node:assert/strict';
import test from 'node:test';
import { analysisHash, reportHash } from '../../scripts/catalog/catalog-report-identity.ts';
import { deterministicCatalogCardUuid, validateExistingIdenticalRecord } from '../../scripts/catalog/import-set.ts';
import { PINNED_DATASET_VERSION, POKEMON_TCG_DATA_REPOSITORY } from '../../scripts/catalog/local-checkout.ts';
import { assertDatasetIdentity, assertIdempotent, assertNoUnexpectedWrites, classifyRemainingMapping, resumeChunks, sealWriteplan, validateApprovedArtifacts, writeplanHash, REMAINING_BATCH, REMAINING_PHASE } from '../../scripts/catalog/remaining-bulk-core.ts';

const evidence = (overrides: Record<string, unknown> = {}) => ({ incomingSetId: 'xy1', name: 'XY', series: 'XY', cardNumbers: ['1', '2'], reliableMappings: [], candidates: [], ...overrides } as any);
test('centrale mapping gebruikt alleen een exacte bestaande betrouwbare mapping', () => assert.deepEqual(classifyRemainingMapping(evidence({ reliableMappings: [{ setCatalogId: 'set-1', setCode: 'xy1', externalId: 'xy1', name: 'XY', series: 'XY' }] })).classification, 'reliable_candidate'));
test('meerdere mappings zijn ambigu', () => assert.equal(classifyRemainingMapping(evidence({ reliableMappings: [{ setCatalogId: '1', setCode: 'a', externalId: 'xy1' }, { setCatalogId: '2', setCode: 'b', externalId: 'xy1' }] })).classification, 'ambiguous_candidate'));
test('ontbrekende mapping zonder exact bewijs blijft geblokkeerd', () => assert.equal(classifyRemainingMapping(evidence()).classification, 'missing_mapping'));
test('metadata-conflict wordt fail-closed geclassificeerd', () => assert.equal(classifyRemainingMapping(evidence({ reliableMappings: [{ setCatalogId: '1', setCode: 'xy1', externalId: 'xy1', name: 'anders' }] })).classification, 'metadata_conflict'));
test('vaste reviewset blijft manual_review', () => assert.equal(classifyRemainingMapping(evidence({ incomingSetId: 'sv9' })).classification, 'manual_review'));

test('datasetidentiteit vereist repository, commit, schoon status en 173/20324', () => {
  assert.doesNotThrow(() => assertDatasetIdentity({ repository: POKEMON_TCG_DATA_REPOSITORY, commit: PINNED_DATASET_VERSION, clean: true, manifestSets: 173, manifestCards: 20_324 }));
  assert.throws(() => assertDatasetIdentity({ repository: POKEMON_TCG_DATA_REPOSITORY, commit: '0'.repeat(40), clean: true, manifestSets: 173, manifestCards: 20_324 }), /dataset_commit_mismatch/);
});

const incoming: any = { id: 'xy1-1', name: 'Venusaur', number: '1', rarity: 'Rare', images: { small: 's', large: 'l' }, details: { hp: '100' } };
const catalogId = deterministicCatalogCardUuid('pokemon_tcg_api', incoming.id);
const catalog: any = { id: catalogId, external_source: 'legacy_public_cards', external_id: null, set_code: 'xy1', set_name: 'XY', number: '1', pokemon: 'Venusaur', rarity: 'Rare', image_small: 's', image_large: 'l', card_details: null };
const reference: any = { id: deterministicCatalogCardUuid('ref', incoming.id), source: 'pokemon_tcg_api', external_id: incoming.id, card_catalog_id: catalogId };
test('legacykaart zonder card_details is geldig met exact één correcte API-reference', () => assert.deepEqual(validateExistingIdenticalRecord({ catalog, incoming, expectedCatalogId: catalogId, setCode: 'xy1', setName: 'XY', references: [reference] }), ['existing_catalog_details_missing']));
test('legacykaart met foutieve set_name blokkeert', () => assert.throws(() => validateExistingIdenticalRecord({ catalog: { ...catalog, set_name: 'Wrong' }, incoming, expectedCatalogId: catalogId, setCode: 'xy1', setName: 'XY', references: [reference] }), /set_name/));
test('legacykaart met foutieve kernmetadata blokkeert', () => assert.throws(() => validateExistingIdenticalRecord({ catalog: { ...catalog, pokemon: 'Wrong' }, incoming, expectedCatalogId: catalogId, setCode: 'xy1', setName: 'XY', references: [reference] }), /pokemon/));
test('foutieve reference blokkeert', () => assert.throws(() => validateExistingIdenticalRecord({ catalog, incoming, expectedCatalogId: catalogId, setCode: 'xy1', setName: 'XY', references: [{ ...reference, external_id: 'wrong' }] }), /exact één/));

function artifacts() {
  const analysis = { mappings: [] }; const aHash = analysisHash(analysis); const report: any = { finalStatus: 'PASS', analysis, analysisHash: aHash, manifestHash: 'a'.repeat(64), datasetCommit: PINNED_DATASET_VERSION, databaseWritesTotal: 0 }; report.reportHash = reportHash(report);
  const plan = sealWriteplan({ schemaVersion: 1, phase: REMAINING_PHASE, source: 'pokemon_tcg_data', datasetRepository: POKEMON_TCG_DATA_REPOSITORY, datasetVersion: PINNED_DATASET_VERSION, datasetCommit: PINNED_DATASET_VERSION, manifestHash: report.manifestHash, analysisHash: aHash, batch: REMAINING_BATCH, sets: [], perSet: [], blockedItems: [], conflicts: [], totals: { expectedCards: 0, catalogInserts: 0, referenceInserts: 0 }, sourceReportHash: report.reportHash, finalStatus: 'PASS' }); return { report, plan };
}
test('analysisHash en writeplanHash zijn canoniek', () => { const { report, plan } = artifacts(); assert.equal(report.analysisHash, analysisHash({ mappings: [] })); assert.equal(plan.writeplanHash, writeplanHash(JSON.parse(JSON.stringify(plan)))); });
test('reportHash mismatch blokkeert', () => { const { report, plan } = artifacts(); report.reportHash = '0'.repeat(64); assert.throws(() => validateApprovedArtifacts({ report, plan, manifestHash: 'a'.repeat(64), datasetCommit: PINNED_DATASET_VERSION }), /report_hash_mismatch/); });
test('manifestHash mismatch blokkeert', () => { const { report, plan } = artifacts(); assert.throws(() => validateApprovedArtifacts({ report, plan, manifestHash: 'b'.repeat(64), datasetCommit: PINNED_DATASET_VERSION }), /manifest_hash_mismatch/); });
test('dry-run met writes blokkeert', () => { const { report, plan } = artifacts(); report.databaseWritesTotal = 1; report.reportHash = reportHash(report); plan.sourceReportHash = report.reportHash; plan.writeplanHash = writeplanHash(plan); assert.throws(() => validateApprovedArtifacts({ report, plan, manifestHash: 'a'.repeat(64), datasetCommit: PINNED_DATASET_VERSION }), /approved_dry_run_contains_writes/); });
test('checkpoint/resume slaat voltooide chunks over', () => assert.deepEqual(resumeChunks(4, { identity: 'x', completedChunks: [0, 2], writes: 3 }, 'x'), [1, 3]));
test('idempotency en onverwachte writes zijn fail-closed', () => { assert.doesNotThrow(() => assertIdempotent(0)); assert.throws(() => assertIdempotent(1)); assert.throws(() => assertNoUnexpectedWrites(2, 3), /unexpected_extra_writes/); });
test('manual-reviewsets kunnen nooit in een goedgekeurd writeplan staan', () => { const { report, plan } = artifacts(); plan.sets = ['sv9']; plan.writeplanHash = writeplanHash(plan); assert.throws(() => validateApprovedArtifacts({ report, plan, manifestHash: 'a'.repeat(64), datasetCommit: PINNED_DATASET_VERSION }), /manual_review_write_blocked/); });
test('ongeldige UUID in een actie blokkeert', () => { const { report, plan } = artifacts(); plan.sets = ['xy1']; plan.perSet = [{ setId: 'xy1', expectedCards: 1, actions: [{ action: 'existingIdentical', externalId: 'xy1-1', cardCatalogId: 'bad' }] }]; plan.writeplanHash = writeplanHash(plan); assert.throws(() => validateApprovedArtifacts({ report, plan, manifestHash: 'a'.repeat(64), datasetCommit: PINNED_DATASET_VERSION }), /invalid_catalog_uuid/); });
