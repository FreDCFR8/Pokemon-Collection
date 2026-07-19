import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { classifyFallbackCandidates } from '../../scripts/catalog/fallback-classification.ts';
import { classifyDiagnosticOutcome, failureCodesForConflictReasons, FAILURE_CODES, mappingFailureReasons, parseDiagnosticResultText, writeDiagnosticResult, type SingleSetDiagnosticResult } from '../../scripts/catalog/diagnostic-result.ts';

function fixture(overrides: Partial<SingleSetDiagnosticResult> = {}): SingleSetDiagnosticResult {
  return {
    schemaVersion: 1,
    setId: 'sv10',
    expectedCards: 216,
    receivedCards: 216,
    status: 'FAIL',
    setMappingStatus: 'no_candidate',
    setMapping: { status: 'no_candidate', candidates: [], evidence: [] },
    externalReferenceMatches: 0,
    fallbackCandidatesQueried: 0,
    safeFallbackCandidates: 0,
    newCards: 0,
    ambiguousItems: 0,
    conflicts: 0,
    unresolvedWithoutSetMapping: 216,
    metadataUnchanged: 0,
    metadataChanged: 0,
    blockedItems: 216,
    plannedDatabaseWrites: 0,
    databaseWrites: 0,
    failureReasons: ['missing_set_mapping'],
    examples: { missing_set_mapping: [{ external_id: 'sv10-1', number: '1' }] },
    ...overrides,
  };
}

test('parses every stable failure code and preserves simultaneous reasons', () => {
  const result = parseDiagnosticResultText(JSON.stringify(fixture({ failureReasons: [...FAILURE_CODES] })));
  assert.deepEqual(result.failureReasons, FAILURE_CODES);
});

test('malformed or incomplete subprocess results fail closed', () => {
  assert.throws(() => parseDiagnosticResultText('not-json'), /geldige JSON/);
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...fixture(), databaseWrites: -1 })), /databaseWrites/);
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...fixture(), status: 'PASS', failureReasons: ['not-a-code'] })), /failureReasons/);
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...fixture(), extra: true })), /onbekende velden/);
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...fixture(), status: 'PASS', failureReasons: ['missing_set_mapping'] })), /PASS/);
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...fixture(), failureReasons: [] })), /FAIL vereist/);
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...fixture(), setMapping: { ...fixture().setMapping, evidence: Array.from({ length: 21 }, () => 'evidence') } })), /te grote/);
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...fixture(), setMapping: { ...fixture().setMapping, candidates: [{ set_code: 'sv10', evidenceCodes: [], incomingCardCount: 1, overlappingUniqueCardNumbers: 1, coveragePercentage: 100, extra: true }] } })), /onbekende velden/);
});

test('mapping statuses have fail-closed semantics', () => {
  const candidate = { set_code: 'sv10', name: 'Destined Rivals', series: 'Scarlet & Violet', source: 'manual_review', source_id: null, evidenceCodes: ['exact_set_code'], incomingCardCount: 216, overlappingUniqueCardNumbers: 216, coveragePercentage: 100 };
  const exact = fixture({ setName: 'Destined Rivals', status: 'FAIL', setMappingStatus: 'exact_candidate', setMapping: { status: 'exact_candidate', candidates: [candidate], evidence: ['candidate_evidence_only'] }, failureReasons: mappingFailureReasons('exact_candidate') });
  assert.equal(exact.setId, 'sv10');
  assert.equal(exact.setMapping.candidates[0].source, 'manual_review');
  assert.deepEqual(exact.failureReasons, ['missing_set_mapping']);
  assert.doesNotThrow(() => parseDiagnosticResultText(JSON.stringify(exact)));
  assert.equal(classifyDiagnosticOutcome(exact), 'content_blocked');
  assert.equal(classifyDiagnosticOutcome({ status: 'FAIL', failureReasons: ['unexpected_runner_failure'] }), 'runner_failure');
  assert.deepEqual(mappingFailureReasons('ambiguous_candidate'), ['ambiguous_set_mapping', 'missing_set_mapping']);
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...exact, setMapping: { ...exact.setMapping, reliableSetCode: 'sv10' } })), /geen betrouwbare setCode/);
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...fixture(), setMappingStatus: 'no_candidate', setMapping: { status: 'no_candidate', candidates: [candidate], evidence: [] } })), /no_candidate/);
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...exact, setMappingStatus: 'ambiguous_candidate', setMapping: { ...exact.setMapping, status: 'ambiguous_candidate', candidates: [candidate] }, failureReasons: mappingFailureReasons('ambiguous_candidate') })), /ambiguous_candidate/);
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...fixture({ status: 'PASS', failureReasons: [], setMappingStatus: 'already_reliable', setCode: 'sv10', setMapping: { status: 'already_reliable', reliableSetCode: 'other', candidates: [], evidence: [] } }) })), /gelijke setCode/);
});

test('fallback conflict reasons map to semantically separate public codes', () => {
  assert.deepEqual(failureCodesForConflictReasons(['fallback_metadata_mismatch']), ['card_identity_conflict', 'fallback_metadata_mismatch']);
  assert.deepEqual(failureCodesForConflictReasons(['multiple_external_references']), ['external_reference_conflict']);
  assert.deepEqual(failureCodesForConflictReasons(['dangling_card_catalog_id']), ['external_reference_conflict']);
  assert.deepEqual(failureCodesForConflictReasons(['fallback_candidate_already_has_source_reference']), ['external_reference_conflict']);
  assert.deepEqual(failureCodesForConflictReasons(['fallback_metadata_mismatch', 'multiple_external_references']), ['card_identity_conflict', 'external_reference_conflict', 'fallback_metadata_mismatch']);
});

test('fallback candidate decisions separate safe, mismatch, reference, and ambiguity', () => {
  const base = { id: 'card-1', changedFields: [], hasSourceReference: false };
  assert.equal(classifyFallbackCandidates([base]), 'safe');
  assert.equal(classifyFallbackCandidates([{ ...base, changedFields: ['name'] }]), 'metadata_mismatch');
  assert.equal(classifyFallbackCandidates([{ ...base, hasSourceReference: true }]), 'existing_source_reference');
  assert.equal(classifyFallbackCandidates([base, { ...base, id: 'card-2' }]), 'ambiguous');
  assert.equal(classifyFallbackCandidates([]), 'none');
});

test('new fallback counters are required, non-negative, and bounded', () => {
  const valid = fixture({ fallbackCandidatesQueried: 1, safeFallbackCandidates: 0 });
  assert.doesNotThrow(() => parseDiagnosticResultText(JSON.stringify(valid)));
  for (const field of ['fallbackCandidatesQueried', 'safeFallbackCandidates'] as const) {
    assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...valid, [field]: undefined })), new RegExp(field));
    assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...valid, [field]: -1 })), new RegExp(field));
    assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...valid, [field]: '1' })), new RegExp(field));
  }
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...valid, safeFallbackCandidates: 2 })), /safeFallbackCandidates/);
  assert.throws(() => parseDiagnosticResultText(JSON.stringify({ ...valid, fallbackCandidates: 1 })), /onbekende velden/);
});

test('diagnostic output is atomic and contains no console payload', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pokemon-diagnostic-'));
  const path = join(directory, 'result.json');
  writeDiagnosticResult(path, fixture());
  assert.equal(existsSync(path), true);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), fixture());
  assert.equal(existsSync(`${path}.tmp`), false);
});

test('console wording is outside the typed classification contract', () => {
  const result = parseDiagnosticResultText(JSON.stringify(fixture({ status: 'PASS', failureReasons: [] })));
  assert.equal(result.status, 'PASS');
});
