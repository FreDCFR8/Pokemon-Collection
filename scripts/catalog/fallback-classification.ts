export type FallbackCandidateInput = { id: string; changedFields: string[]; hasSourceReference: boolean };
export type FallbackCandidateDecision = 'safe' | 'metadata_mismatch' | 'existing_source_reference' | 'ambiguous' | 'none';

export function classifyFallbackCandidates(candidates: readonly FallbackCandidateInput[]): FallbackCandidateDecision {
  if (candidates.length === 0) return 'none';
  if (candidates.length > 1) return 'ambiguous';
  if (candidates[0].changedFields.length > 0) return 'metadata_mismatch';
  if (candidates[0].hasSourceReference) return 'existing_source_reference';
  return 'safe';
}
