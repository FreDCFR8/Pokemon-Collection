import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { isValidSetId } from './import-args.ts';

export const DIAGNOSTIC_SCHEMA_VERSION = 1;
export const FAILURE_CODES = ['missing_set_mapping', 'ambiguous_set_mapping', 'fallback_metadata_mismatch', 'ambiguous_fallback_candidate', 'external_reference_conflict', 'input_validation_failure', 'card_identity_conflict', 'unexpected_runner_failure'] as const;
export type FailureCode = (typeof FAILURE_CODES)[number];
export type SetMappingStatus = 'already_reliable' | 'exact_candidate' | 'ambiguous_candidate' | 'no_candidate' | 'conflicting_candidate';
export const MAX_CANDIDATES = 50;
export const MAX_EVIDENCE = 20;
export const MAX_EXAMPLES = 10;
export const MAX_CHANGED_FIELDS = 20;

export type DiagnosticExample = { external_id?: string; number?: string; card_catalog_id?: string; reason?: string; changed_fields?: string[] };
export type SetMappingCandidate = {
  set_code: string;
  name?: string;
  series?: string;
  source?: string | null;
  source_id?: string | null;
  evidenceCodes: string[];
  incomingCardCount: number;
  overlappingUniqueCardNumbers: number;
  coveragePercentage: number;
};
export type SetMappingProposal = { status: SetMappingStatus; reliableSetCode?: string; candidates: SetMappingCandidate[]; evidence: string[] };
export type SingleSetDiagnosticResult = {
  schemaVersion: number;
  setId: string;
  setName?: string;
  expectedCards?: number;
  receivedCards: number;
  status: 'PASS' | 'FAIL';
  setCode?: string;
  setMappingStatus: SetMappingStatus;
  setMapping: SetMappingProposal;
  externalReferenceMatches: number;
  fallbackCandidates: number;
  newCards: number;
  ambiguousItems: number;
  conflicts: number;
  unresolvedWithoutSetMapping: number;
  metadataUnchanged: number;
  metadataChanged: number;
  blockedItems: number;
  plannedDatabaseWrites: number;
  databaseWrites: number;
  failureReasons: FailureCode[];
  examples: Partial<Record<FailureCode, DiagnosticExample[]>>;
};

export function mappingFailureReasons(status: SetMappingStatus): FailureCode[] {
  if (status === 'already_reliable') return [];
  if (status === 'ambiguous_candidate' || status === 'conflicting_candidate') return ['ambiguous_set_mapping', 'missing_set_mapping'];
  return ['missing_set_mapping'];
}

export function addDiagnosticFailure(result: SingleSetDiagnosticResult, reason: FailureCode): SingleSetDiagnosticResult {
  const updated: SingleSetDiagnosticResult = { ...result, status: 'FAIL', failureReasons: [...new Set([...result.failureReasons, reason])] };
  assertValidDiagnosticResult(updated);
  return updated;
}

export type DiagnosticOutcome = 'content_pass' | 'content_blocked' | 'runner_failure';

export function classifyDiagnosticOutcome(result: Pick<SingleSetDiagnosticResult, 'status' | 'failureReasons'>): DiagnosticOutcome {
  if (result.failureReasons.includes('unexpected_runner_failure')) return 'runner_failure';
  return result.status === 'PASS' && result.failureReasons.length === 0 ? 'content_pass' : 'content_blocked';
}

function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isNonNegativeInteger(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= 0; }
function isString(value: unknown, max = 200): value is string { return typeof value === 'string' && value.length <= max && !/[\r\n]/.test(value); }
function isFailureCode(value: unknown): value is FailureCode { return typeof value === 'string' && (FAILURE_CODES as readonly string[]).includes(value); }
function assertAllowed(value: Record<string, unknown>, allowed: readonly string[], label: string): void { if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error(`${label} bevat onbekende velden.`); }
function assertExamples(value: unknown): Partial<Record<FailureCode, DiagnosticExample[]>> {
  if (!isObject(value)) throw new Error('Ongeldige diagnostische examples.');
  assertAllowed(value, FAILURE_CODES, 'examples');
  const result: Partial<Record<FailureCode, DiagnosticExample[]>> = {};
  for (const [code, examples] of Object.entries(value)) {
    if (!isFailureCode(code) || !Array.isArray(examples) || examples.length > MAX_EXAMPLES) throw new Error('Ongeldige of te grote diagnostische examples.');
    result[code] = examples.map((item) => {
      if (!isObject(item)) throw new Error('Diagnostisch voorbeeld heeft een ongeldig formaat.');
      assertAllowed(item, ['external_id', 'number', 'card_catalog_id', 'reason', 'changed_fields'], 'diagnostisch voorbeeld');
      for (const key of ['external_id', 'number', 'card_catalog_id', 'reason'] as const) if (item[key] !== undefined && !isString(item[key], 200)) throw new Error('Diagnostisch voorbeeld bevat een ongeldige string.');
      if (item.reason && /(https?:\/\/|api[_-]?key|secret|stdout|stderr)/i.test(item.reason)) throw new Error('Diagnostisch voorbeeld bevat verboden payloadinformatie.');
      if (item.changed_fields !== undefined && (!Array.isArray(item.changed_fields) || item.changed_fields.length > MAX_CHANGED_FIELDS || item.changed_fields.some((field) => !isString(field, 80)))) throw new Error('Diagnostisch voorbeeld bevat ongeldige changed_fields.');
      return item as DiagnosticExample;
    });
  }
  return result;
}

function assertMapping(value: unknown, status: SetMappingStatus, setCode: string | undefined): SetMappingProposal {
  if (!isObject(value)) throw new Error('Diagnostiek mist setMapping.');
  assertAllowed(value, ['status', 'reliableSetCode', 'candidates', 'evidence'], 'setMapping');
  if (value.status !== status || !Array.isArray(value.candidates) || !Array.isArray(value.evidence)) throw new Error('Ongeldige setMappingstructuur.');
  if (value.candidates.length > MAX_CANDIDATES || value.evidence.length > MAX_EVIDENCE) throw new Error('Setmapping bevat te grote candidate/evidence-lijsten.');
  if (value.evidence.some((item) => !isString(item, 200))) throw new Error('Setmapping bevat ongeldige evidence.');
  if (status === 'already_reliable' && (!setCode || value.reliableSetCode !== setCode)) throw new Error('already_reliable vereist gelijke setCode en reliableSetCode.');
  if (status !== 'already_reliable' && (setCode !== undefined || value.reliableSetCode !== undefined)) throw new Error(`${status} mag geen betrouwbare setCode bevatten.`);
  if (value.reliableSetCode !== undefined && !isString(value.reliableSetCode, 32)) throw new Error('Ongeldige reliableSetCode.');
  const candidates = value.candidates.map((item) => {
    if (!isObject(item)) throw new Error('Setmappingkandidaat heeft een ongeldig formaat.');
    assertAllowed(item, ['set_code', 'name', 'series', 'source', 'source_id', 'evidenceCodes', 'incomingCardCount', 'overlappingUniqueCardNumbers', 'coveragePercentage'], 'setmappingkandidaat');
    if (!isString(item.set_code, 32) || (item.name !== undefined && !isString(item.name)) || (item.series !== undefined && !isString(item.series)) || (item.source !== undefined && item.source !== null && !isString(item.source, 80)) || (item.source_id !== undefined && item.source_id !== null && !isString(item.source_id, 80))) throw new Error('Setmappingkandidaat bevat ongeldige strings.');
    if (!Array.isArray(item.evidenceCodes) || item.evidenceCodes.length > MAX_EVIDENCE || item.evidenceCodes.some((code) => !isString(code, 80))) throw new Error('Setmappingkandidaat bevat ongeldige evidenceCodes.');
    if (!isNonNegativeInteger(item.incomingCardCount) || !isNonNegativeInteger(item.overlappingUniqueCardNumbers) || item.overlappingUniqueCardNumbers > item.incomingCardCount || typeof item.coveragePercentage !== 'number' || item.coveragePercentage < 0 || item.coveragePercentage > 100) throw new Error('Setmappingkandidaat bevat ongeldige dekking.');
    return item as SetMappingCandidate;
  });
  if (status === 'exact_candidate' && candidates.length !== 1) throw new Error('exact_candidate vereist exact één kandidaat.');
  if (status === 'ambiguous_candidate' && candidates.length < 2) throw new Error('ambiguous_candidate vereist minstens twee kandidaten.');
  if (status === 'no_candidate' && candidates.length !== 0) throw new Error('no_candidate mag geen kandidaten bevatten.');
  if (status === 'conflicting_candidate' && candidates.length < 2) throw new Error('conflicting_candidate vereist minstens twee kandidaten.');
  return { status, ...(value.reliableSetCode !== undefined ? { reliableSetCode: value.reliableSetCode as string } : {}), candidates, evidence: value.evidence as string[] };
}

export function assertValidDiagnosticResult(value: unknown): asserts value is SingleSetDiagnosticResult {
  if (!isObject(value)) throw new Error('Subprocessresultaat moet een JSON-object zijn.');
  assertAllowed(value, ['schemaVersion', 'setId', 'setName', 'expectedCards', 'receivedCards', 'status', 'setCode', 'setMappingStatus', 'setMapping', 'externalReferenceMatches', 'fallbackCandidates', 'newCards', 'ambiguousItems', 'conflicts', 'unresolvedWithoutSetMapping', 'metadataUnchanged', 'metadataChanged', 'blockedItems', 'plannedDatabaseWrites', 'databaseWrites', 'failureReasons', 'examples'], 'subprocessresultaat');
  if (value.schemaVersion !== DIAGNOSTIC_SCHEMA_VERSION || typeof value.setId !== 'string' || !isValidSetId(value.setId) || (value.setName !== undefined && !isString(value.setName)) || (value.setCode !== undefined && (!isString(value.setCode, 32) || !isValidSetId(value.setCode))) || (value.status !== 'PASS' && value.status !== 'FAIL') || !['already_reliable', 'exact_candidate', 'ambiguous_candidate', 'no_candidate', 'conflicting_candidate'].includes(String(value.setMappingStatus))) throw new Error('Subprocessresultaat bevat ongeldige identiteit of status.');
  for (const key of ['receivedCards', 'externalReferenceMatches', 'fallbackCandidates', 'newCards', 'ambiguousItems', 'conflicts', 'unresolvedWithoutSetMapping', 'metadataUnchanged', 'metadataChanged', 'blockedItems', 'plannedDatabaseWrites', 'databaseWrites']) if (!isNonNegativeInteger(value[key])) throw new Error(`Ongeldige diagnostische teller: ${key}.`);
  if (value.expectedCards !== undefined && !isNonNegativeInteger(value.expectedCards)) throw new Error('Ongeldige expectedCards.');
  if (!Array.isArray(value.failureReasons) || value.failureReasons.length > FAILURE_CODES.length || value.failureReasons.some((code) => !isFailureCode(code)) || new Set(value.failureReasons).size !== value.failureReasons.length) throw new Error('Ongeldige failureReasons.');
  if (value.status === 'PASS' && value.failureReasons.length !== 0) throw new Error('PASS mag geen failureReasons bevatten.');
  if (value.status === 'FAIL' && value.failureReasons.length === 0) throw new Error('FAIL vereist minstens één failureReason.');
  const setMappingStatus = value.setMappingStatus as SetMappingStatus;
  const mapping = assertMapping(value.setMapping, setMappingStatus, value.setCode as string | undefined);
  assertExamples(value.examples);
  value.setMapping = mapping;
}

export function parseDiagnosticResultText(text: string): SingleSetDiagnosticResult {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Subprocessresultaat is geen geldige JSON.'); }
  assertValidDiagnosticResult(value);
  return value;
}

export function writeDiagnosticResult(path: string | undefined, result: SingleSetDiagnosticResult): void {
  if (!path) return;
  assertValidDiagnosticResult(result);
  const tempPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  try { writeFileSync(tempPath, `${JSON.stringify(result)}\n`, 'utf8'); renameSync(tempPath, path); } finally { try { unlinkSync(tempPath); } catch {} }
}

export function readDiagnosticResult(path: string): SingleSetDiagnosticResult { return parseDiagnosticResultText(readFileSync(path, 'utf8')); }
