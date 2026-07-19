import { readFileSync } from 'node:fs';
import { writeAtomicJson } from './checkpoint.ts';

export const DIAGNOSTIC_SCHEMA_VERSION = 1;
export const FAILURE_CODES = [
  'missing_set_mapping',
  'ambiguous_set_mapping',
  'fallback_metadata_mismatch',
  'ambiguous_fallback_candidate',
  'external_reference_conflict',
  'input_validation_failure',
  'card_identity_conflict',
  'unexpected_runner_failure',
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];
export type SetMappingStatus = 'already_reliable' | 'exact_candidate' | 'ambiguous_candidate' | 'no_candidate' | 'conflicting_candidate';

export type DiagnosticExample = {
  external_id?: string;
  number?: string;
  card_catalog_id?: string;
  reason?: string;
  changed_fields?: string[];
};

export type SetMappingProposal = {
  status: SetMappingStatus;
  reliableSetCode?: string;
  candidates: Array<{ set_code: string; name?: string; series?: string; source?: string | null; source_id?: string | null }>;
  evidence: string[];
};

export type SingleSetDiagnosticResult = {
  schemaVersion: number;
  setId: string;
  setName?: string;
  expectedCards?: number;
  receivedCards: number;
  status: 'PASS' | 'FAIL';
  setCode?: string;
  setMappingStatus: SetMappingStatus;
  setMapping?: SetMappingProposal;
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isFailureCode(value: unknown): value is FailureCode {
  return typeof value === 'string' && (FAILURE_CODES as readonly string[]).includes(value);
}

export function writeDiagnosticResult(path: string | undefined, result: SingleSetDiagnosticResult): void {
  if (path) writeAtomicJson(path, result);
}

export function parseDiagnosticResultText(text: string): SingleSetDiagnosticResult {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Subprocessresultaat is geen geldige JSON.'); }
  if (!isObject(value)) throw new Error('Subprocessresultaat moet een JSON-object zijn.');
  const requiredStrings = ['setId', 'status', 'setMappingStatus'];
  for (const key of requiredStrings) if (typeof value[key] !== 'string') throw new Error(`Subprocessresultaat mist ${key}.`);
  if (value.schemaVersion !== DIAGNOSTIC_SCHEMA_VERSION) throw new Error('Onbekende diagnostische schemaVersion.');
  if (value.status !== 'PASS' && value.status !== 'FAIL') throw new Error('Ongeldige diagnostische status.');
  if (!['already_reliable', 'exact_candidate', 'ambiguous_candidate', 'no_candidate', 'conflicting_candidate'].includes(String(value.setMappingStatus))) throw new Error('Ongeldige setmappingstatus.');
  for (const key of ['receivedCards', 'externalReferenceMatches', 'fallbackCandidates', 'newCards', 'ambiguousItems', 'conflicts', 'unresolvedWithoutSetMapping', 'metadataUnchanged', 'metadataChanged', 'blockedItems', 'plannedDatabaseWrites', 'databaseWrites']) {
    if (!isNonNegativeInteger(value[key])) throw new Error(`Ongeldige diagnostische teller: ${key}.`);
  }
  if (value.expectedCards !== undefined && !isNonNegativeInteger(value.expectedCards)) throw new Error('Ongeldige expectedCards.');
  if (!Array.isArray(value.failureReasons) || value.failureReasons.some((code) => !isFailureCode(code))) throw new Error('Ongeldige failureReasons.');
  if (!isObject(value.examples)) throw new Error('Ongeldige diagnostische examples.');
  return value as unknown as SingleSetDiagnosticResult;
}

export function readDiagnosticResult(path: string): SingleSetDiagnosticResult {
  return parseDiagnosticResultText(readFileSync(path, 'utf8'));
}
