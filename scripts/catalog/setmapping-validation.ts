import { createHash } from 'node:crypto';

export const SETMAPPING_VALIDATION_SCHEMA_VERSION = 2;
export const MIN_CARD_NUMBER_COVERAGE_PERCENTAGE = 80;
export const SET_EXTERNAL_SOURCE = 'pokemon_tcg_api';
export const CARD_EXTERNAL_SOURCE = 'pokemon_tcg_api';

export type SetMappingClassification = 'safe_for_mapping_review' | 'needs_manual_review' | 'blocked';
export type SetMappingReasonCode =
  | 'exact_candidate_single' | 'set_name_match' | 'set_series_match' | 'card_number_coverage_complete' | 'card_number_coverage_partial'
  | 'no_catalog_overlap' | 'catalog_set_present' | 'catalog_set_missing' | 'catalog_provenance_present' | 'catalog_provenance_missing'
  | 'external_card_references_present' | 'external_card_references_missing' | 'set_name_conflict' | 'set_series_conflict'
  | 'external_source_identity_other_set' | 'proposed_set_conflicting_source_identity' | 'missing_external_provenance' | 'multiple_source_identity_matches'
  | 'multiple_card_references' | 'card_reference_wrong_set' | 'card_reference_wrong_number' | 'dangling_card_reference'
  | 'card_reference_conflict' | 'missing_required_candidate_data' | 'duplicate_incoming_card_numbers' | 'database_read_error'
  | 'source_report_set_id_mismatch' | 'source_report_set_name_mismatch' | 'source_report_expected_cards_mismatch' | 'received_cards_mismatch';

export type SetMappingCandidateInput = {
  externalSetId: string; externalSetName: string; externalSeries: string; proposedSetCode: string;
  candidateSource?: string | null; candidateSourceId?: string | null; candidateCount: number;
  catalogSet?: { set_code: string; name: string | null; series: string | null; source: string | null; source_id: string | null } | null;
  catalogSetRowCount?: number; catalogSourceIdentityMatchCount?: number; catalogSourceIdentityOtherSetCount?: number;
  proposedSetHasConflictingSourceIdentity?: boolean; missingExternalProvenance?: boolean;
  incomingCardCount: number; uniqueIncomingCardNumbers: number; overlappingUniqueCardNumbers: number;
  existingExternalCardReferences: number; conflictingExternalCardReferences: number; duplicateIncomingCardNumbers?: number;
  preflightReasonCodes?: SetMappingReasonCode[]; readError?: boolean;
};

export type SetMappingValidationResult = {
  classification: SetMappingClassification; reasonCodes: SetMappingReasonCode[];
  metrics: { incomingCardCount: number; uniqueIncomingCardNumbers: number; overlappingUniqueCardNumbers: number; coveragePercentage: number; existingExternalCardReferences: number; conflictingExternalCardReferences: number };
};

function normalized(value: string | null | undefined): string { return (value ?? '').trim().toLocaleLowerCase('en-US'); }
function addReason(reasons: SetMappingReasonCode[], reason: SetMappingReasonCode): void { if (!reasons.includes(reason)) reasons.push(reason); }

export function validateSetMappingCandidate(input: SetMappingCandidateInput): SetMappingValidationResult {
  const reasons: SetMappingReasonCode[] = [...(input.preflightReasonCodes ?? [])];
  const coverage = input.uniqueIncomingCardNumbers === 0 ? 0 : Number(((input.overlappingUniqueCardNumbers / input.uniqueIncomingCardNumbers) * 100).toFixed(2));
  const metrics = { incomingCardCount: input.incomingCardCount, uniqueIncomingCardNumbers: input.uniqueIncomingCardNumbers, overlappingUniqueCardNumbers: input.overlappingUniqueCardNumbers, coveragePercentage: coverage, existingExternalCardReferences: input.existingExternalCardReferences, conflictingExternalCardReferences: input.conflictingExternalCardReferences };
  if (input.readError) addReason(reasons, 'database_read_error');
  if (!input.externalSetId || !input.externalSetName || !input.externalSeries || !input.proposedSetCode || input.candidateCount !== 1) addReason(reasons, 'missing_required_candidate_data');
  else addReason(reasons, 'exact_candidate_single');
  if ((input.duplicateIncomingCardNumbers ?? 0) > 0) addReason(reasons, 'duplicate_incoming_card_numbers');

  if (!input.catalogSet) addReason(reasons, input.catalogSetRowCount && input.catalogSetRowCount > 1 ? 'proposed_set_conflicting_source_identity' : 'catalog_set_missing');
  else {
    addReason(reasons, 'catalog_set_present');
    addReason(reasons, normalized(input.catalogSet.name) === normalized(input.externalSetName) ? 'set_name_match' : 'set_name_conflict');
    addReason(reasons, normalized(input.catalogSet.series) === normalized(input.externalSeries) ? 'set_series_match' : 'set_series_conflict');
    if (input.catalogSet.source && input.catalogSet.source_id) addReason(reasons, 'catalog_provenance_present'); else addReason(reasons, 'catalog_provenance_missing');
  }
  if ((input.catalogSourceIdentityMatchCount ?? 0) > 1) addReason(reasons, 'multiple_source_identity_matches');
  if ((input.catalogSourceIdentityOtherSetCount ?? 0) > 0) addReason(reasons, 'external_source_identity_other_set');
  if (input.proposedSetHasConflictingSourceIdentity) addReason(reasons, 'proposed_set_conflicting_source_identity');
  if (input.missingExternalProvenance) addReason(reasons, 'missing_external_provenance');
  if (input.uniqueIncomingCardNumbers > 0 && input.overlappingUniqueCardNumbers === input.uniqueIncomingCardNumbers) addReason(reasons, 'card_number_coverage_complete');
  else if (input.overlappingUniqueCardNumbers >= input.uniqueIncomingCardNumbers * MIN_CARD_NUMBER_COVERAGE_PERCENTAGE / 100) addReason(reasons, 'card_number_coverage_partial');
  else addReason(reasons, input.overlappingUniqueCardNumbers === 0 ? 'no_catalog_overlap' : 'card_number_coverage_partial');
  addReason(reasons, input.existingExternalCardReferences > 0 ? 'external_card_references_present' : 'external_card_references_missing');
  if (input.conflictingExternalCardReferences > 0) addReason(reasons, 'card_reference_conflict');

  const hardBlockReasons: SetMappingReasonCode[] = ['database_read_error', 'missing_required_candidate_data', 'set_name_conflict', 'set_series_conflict', 'external_source_identity_other_set', 'proposed_set_conflicting_source_identity', 'missing_external_provenance', 'multiple_source_identity_matches', 'card_reference_conflict', 'no_catalog_overlap', 'source_report_set_id_mismatch', 'source_report_set_name_mismatch', 'source_report_expected_cards_mismatch', 'received_cards_mismatch'];
  const hardBlock = reasons.some((reason) => hardBlockReasons.includes(reason)) || input.overlappingUniqueCardNumbers < input.uniqueIncomingCardNumbers * MIN_CARD_NUMBER_COVERAGE_PERCENTAGE / 100;
  const safe = !hardBlock && reasons.includes('catalog_set_present') && reasons.includes('set_name_match') && reasons.includes('set_series_match') && reasons.includes('card_number_coverage_complete') && reasons.includes('catalog_provenance_present');
  return { classification: hardBlock ? 'blocked' : safe ? 'safe_for_mapping_review' : 'needs_manual_review', reasonCodes: [...new Set(reasons)].sort(), metrics };
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function reportHash(value: unknown): string { return createHash('sha256').update(stableJson(value)).digest('hex'); }
