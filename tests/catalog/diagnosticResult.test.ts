import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FAILURE_CODES, parseDiagnosticResultText, writeDiagnosticResult, type SingleSetDiagnosticResult } from '../../scripts/catalog/diagnostic-result.ts';

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
    fallbackCandidates: 0,
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
