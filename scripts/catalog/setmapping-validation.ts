import { createHash } from 'node:crypto';

export const SETMAPPING_VALIDATION_SCHEMA_VERSION = 2;
export const SET_EXTERNAL_SOURCE = 'pokemon_tcg_api';
export const CARD_EXTERNAL_SOURCE = 'pokemon_tcg_api';

export type SetMappingClassification = 'safe_for_mapping_review' | 'needs_manual_review' | 'blocked';
export type SetMappingReasonCode =
  | 'exact_candidate_single' | 'set_code_match' | 'set_code_conflict' | 'set_name_match' | 'set_series_match' | 'catalog_series_missing' | 'card_number_coverage_complete' | 'card_number_coverage_partial'
  | 'card_number_overlap_present' | 'card_number_overlap_missing' | 'card_number_identity_match' | 'card_number_identity_conflict' | 'ambiguous_card_number_overlap'
  | 'no_catalog_overlap' | 'catalog_set_present' | 'catalog_set_missing' | 'catalog_provenance_present' | 'catalog_provenance_missing'
  | 'legacy_catalog_provenance_present' | 'external_set_reference_missing' | 'requires_set_external_reference_model'
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
  cardNumberIdentityMatches?: number; cardNumberIdentityConflicts?: number; ambiguousCardNumberOverlaps?: number;
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
  if (normalized(input.proposedSetCode) === normalized(input.externalSetId)) addReason(reasons, 'set_code_match');
  else addReason(reasons, 'set_code_conflict');
  if ((input.duplicateIncomingCardNumbers ?? 0) > 0) addReason(reasons, 'duplicate_incoming_card_numbers');

  if (!input.catalogSet) addReason(reasons, input.catalogSetRowCount && input.catalogSetRowCount > 1 ? 'proposed_set_conflicting_source_identity' : 'catalog_set_missing');
  else {
    addReason(reasons, 'catalog_set_present');
    addReason(reasons, normalized(input.catalogSet.name) === normalized(input.externalSetName) ? 'set_name_match' : 'set_name_conflict');
    if (normalized(input.catalogSet.series) === '') addReason(reasons, 'catalog_series_missing');
    else addReason(reasons, normalized(input.catalogSet.series) === normalized(input.externalSeries) ? 'set_series_match' : 'set_series_conflict');
    if (input.catalogSet.source && input.catalogSet.source_id) addReason(reasons, 'catalog_provenance_present');
    else if (input.catalogSet.source) { addReason(reasons, 'legacy_catalog_provenance_present'); addReason(reasons, 'external_set_reference_missing'); addReason(reasons, 'requires_set_external_reference_model'); }
    else addReason(reasons, 'catalog_provenance_missing');
  }
  if ((input.catalogSourceIdentityMatchCount ?? 0) > 1) addReason(reasons, 'multiple_source_identity_matches');
  if ((input.catalogSourceIdentityOtherSetCount ?? 0) > 0) addReason(reasons, 'external_source_identity_other_set');
  if (input.proposedSetHasConflictingSourceIdentity) addReason(reasons, 'proposed_set_conflicting_source_identity');
  if (input.missingExternalProvenance) { addReason(reasons, 'missing_external_provenance'); addReason(reasons, 'external_set_reference_missing'); addReason(reasons, 'requires_set_external_reference_model'); }
  if (input.uniqueIncomingCardNumbers > 0 && input.overlappingUniqueCardNumbers === input.uniqueIncomingCardNumbers) addReason(reasons, 'card_number_coverage_complete');
  else if (input.overlappingUniqueCardNumbers > 0) addReason(reasons, 'card_number_coverage_partial');
  else addReason(reasons, input.overlappingUniqueCardNumbers === 0 ? 'no_catalog_overlap' : 'card_number_coverage_partial');
  addReason(reasons, input.overlappingUniqueCardNumbers > 0 ? 'card_number_overlap_present' : 'card_number_overlap_missing');
  if ((input.cardNumberIdentityMatches ?? 0) > 0) addReason(reasons, 'card_number_identity_match');
  if ((input.cardNumberIdentityConflicts ?? 0) > 0) addReason(reasons, 'card_number_identity_conflict');
  if ((input.ambiguousCardNumberOverlaps ?? 0) > 0) addReason(reasons, 'ambiguous_card_number_overlap');
  addReason(reasons, input.existingExternalCardReferences > 0 ? 'external_card_references_present' : 'external_card_references_missing');
  if (input.conflictingExternalCardReferences > 0) addReason(reasons, 'card_reference_conflict');

  const hardBlockReasons: SetMappingReasonCode[] = ['database_read_error', 'missing_required_candidate_data', 'set_code_conflict', 'set_name_conflict', 'set_series_conflict', 'external_source_identity_other_set', 'proposed_set_conflicting_source_identity', 'multiple_source_identity_matches', 'card_reference_conflict', 'card_number_identity_conflict', 'source_report_set_id_mismatch', 'source_report_set_name_mismatch', 'source_report_expected_cards_mismatch', 'received_cards_mismatch'];
  const hardBlock = reasons.some((reason) => hardBlockReasons.includes(reason));
  const needsManual = !hardBlock && (input.overlappingUniqueCardNumbers === 0 || (input.duplicateIncomingCardNumbers ?? 0) > 0 || (input.ambiguousCardNumberOverlaps ?? 0) > 0 || (input.cardNumberIdentityMatches ?? 0) === 0);
  const safe = !hardBlock && !needsManual && reasons.includes('catalog_set_present') && reasons.includes('set_code_match') && reasons.includes('set_name_match') && (reasons.includes('set_series_match') || reasons.includes('catalog_series_missing')) && reasons.includes('card_number_identity_match');
  return { classification: hardBlock ? 'blocked' : safe ? 'safe_for_mapping_review' : 'needs_manual_review', reasonCodes: [...new Set(reasons)].sort(), metrics };
}

export function stableJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue).filter((key) => objectValue[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableJson(objectValue[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
export function reportHash(value: unknown): string { return createHash('sha256').update(stableJson(value)).digest('hex'); }
