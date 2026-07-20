import { createHash } from 'node:crypto';
import { analysisHash, canonicalReportJson, reportHash } from './catalog-report-identity.ts';
import { isValidPostgresUuid } from './import-set.ts';
import { PINNED_DATASET_VERSION, POKEMON_TCG_DATA_REPOSITORY } from './local-checkout.ts';

export const REMAINING_PHASE = 'Phase 7B-2F9E-C-REMAINING' as const;
export const REMAINING_BATCH = 'remaining-134' as const;
export const REMAINING_SET_COUNT = 134;
export const EXPECTED_MANIFEST_SETS = 173;
export const EXPECTED_MANIFEST_CARDS = 20_324;
export const MANUAL_REVIEW_SETS = ['cel25c', 'sv9', 'swsh9', 'zsv10pt5'] as const;

export type MappingClassification = 'reliable_candidate' | 'ambiguous_candidate' | 'missing_mapping' | 'metadata_conflict' | 'manual_review';
export type MappingEvidence = {
  incomingSetId: string;
  name: string;
  series: string;
  cardNumbers: string[];
  reliableMappings: Array<{ setCatalogId: string; setCode: string; externalId: string; name?: string | null; series?: string | null }>;
  candidates: Array<{ setCatalogId: string; setCode: string; name?: string | null; series?: string | null; cardNumbers: string[] }>;
};
export type MappingAnalysis = MappingEvidence & { classification: MappingClassification; reasonCodes: string[]; selected?: { setCatalogId: string; setCode: string } };

const normalized = (value: string | null | undefined): string => (value ?? '').trim().toLocaleLowerCase('en-US');
const sameNumbers = (left: readonly string[], right: readonly string[]): boolean => {
  const a = [...new Set(left.map(normalized))].sort(); const b = [...new Set(right.map(normalized))].sort();
  return a.length > 0 && JSON.stringify(a) === JSON.stringify(b);
};

/** Fail-closed classification: a name by itself is deliberately never evidence. */
export function classifyRemainingMapping(input: MappingEvidence): MappingAnalysis {
  const base = { ...input, cardNumbers: [...input.cardNumbers].sort(), candidates: [...input.candidates].sort((a, b) => a.setCode.localeCompare(b.setCode)), reliableMappings: [...input.reliableMappings].sort((a, b) => a.setCode.localeCompare(b.setCode)) };
  if ((MANUAL_REVIEW_SETS as readonly string[]).includes(input.incomingSetId)) return { ...base, classification: 'manual_review', reasonCodes: ['explicit_manual_review'] };
  const exactReliable = base.reliableMappings.filter((item) => item.externalId === input.incomingSetId);
  if (exactReliable.length > 1) return { ...base, classification: 'ambiguous_candidate', reasonCodes: ['multiple_reliable_mappings'] };
  if (exactReliable.length === 1) {
    const mapping = exactReliable[0];
    if ((mapping.name != null && normalized(mapping.name) !== normalized(input.name)) || (mapping.series != null && normalized(mapping.series) !== normalized(input.series))) return { ...base, classification: 'metadata_conflict', reasonCodes: ['reliable_mapping_metadata_conflict'] };
    return { ...base, classification: 'reliable_candidate', reasonCodes: ['exact_existing_reliable_mapping'], selected: { setCatalogId: mapping.setCatalogId, setCode: mapping.setCode } };
  }
  const exact = base.candidates.filter((candidate) => normalized(candidate.name) === normalized(input.name) && (candidate.series == null || normalized(candidate.series) === normalized(input.series)) && sameNumbers(candidate.cardNumbers, input.cardNumbers));
  if (exact.length > 1) return { ...base, classification: 'ambiguous_candidate', reasonCodes: ['multiple_exact_candidates'] };
  if (exact.length === 1) return { ...base, classification: 'missing_mapping', reasonCodes: ['exact_unregistered_mapping_requires_separate_approval'] };
  const conflicting = base.candidates.some((candidate) => candidate.setCode === input.incomingSetId && (normalized(candidate.name) !== normalized(input.name) || (candidate.series != null && normalized(candidate.series) !== normalized(input.series))));
  return { ...base, classification: conflicting ? 'metadata_conflict' : 'missing_mapping', reasonCodes: [conflicting ? 'candidate_metadata_conflict' : 'no_exact_mapping_evidence'] };
}

export function assertDatasetIdentity(value: { repository: string; commit: string; clean: boolean; manifestSets: number; manifestCards: number }): void {
  if (value.repository !== POKEMON_TCG_DATA_REPOSITORY) throw new Error('dataset_repository_mismatch');
  if (value.commit !== PINNED_DATASET_VERSION) throw new Error('dataset_commit_mismatch');
  if (!value.clean) throw new Error('dataset_worktree_dirty');
  if (value.manifestSets !== EXPECTED_MANIFEST_SETS || value.manifestCards !== EXPECTED_MANIFEST_CARDS) throw new Error('manifest_totals_mismatch');
}

export type RemainingWritePlan = {
  schemaVersion: 1; phase: typeof REMAINING_PHASE; source: 'pokemon_tcg_data'; datasetRepository: string; datasetVersion: string; datasetCommit: string;
  manifestHash: string; analysisHash: string; batch: typeof REMAINING_BATCH; sets: string[]; perSet: Array<{ setId: string; expectedCards: number; actions: unknown[] }>;
  blockedItems: unknown[]; conflicts: unknown[]; totals: { expectedCards: number; catalogInserts: number; referenceInserts: number }; sourceReportHash: string; finalStatus: 'PASS' | 'BLOCKED'; writeplanHash?: string;
};

export function writeplanHash(plan: RemainingWritePlan): string {
  const copy = { ...plan }; delete copy.writeplanHash;
  return createHash('sha256').update(canonicalReportJson(copy), 'utf8').digest('hex');
}

export function sealWriteplan(plan: Omit<RemainingWritePlan, 'writeplanHash'>): RemainingWritePlan { const result: RemainingWritePlan = { ...plan }; return { ...result, writeplanHash: writeplanHash(result) }; }

export function validateApprovedArtifacts(params: { report: any; plan: RemainingWritePlan; manifestHash: string; datasetCommit: string }): void {
  const { report, plan } = params;
  if (report.reportHash !== reportHash(report)) throw new Error('report_hash_mismatch');
  if (report.analysisHash !== analysisHash(report.analysis)) throw new Error('analysis_hash_mismatch');
  if (report.manifestHash !== params.manifestHash || plan.manifestHash !== params.manifestHash) throw new Error('manifest_hash_mismatch');
  if (report.datasetCommit !== params.datasetCommit || plan.datasetCommit !== params.datasetCommit || params.datasetCommit !== PINNED_DATASET_VERSION) throw new Error('dataset_commit_mismatch');
  if (plan.writeplanHash !== writeplanHash(plan)) throw new Error('writeplan_hash_mismatch');
  if (plan.sourceReportHash !== report.reportHash) throw new Error('source_report_hash_mismatch');
  if (report.databaseWritesTotal !== 0) throw new Error('approved_dry_run_contains_writes');
  if (report.finalStatus !== 'PASS' || plan.finalStatus !== 'PASS') throw new Error('artifact_not_pass');
  if (plan.sets.some((set) => (MANUAL_REVIEW_SETS as readonly string[]).includes(set))) throw new Error('manual_review_write_blocked');
  for (const set of plan.perSet) for (const action of set.actions as any[]) {
    const catalogId = action.catalogInsert?.id ?? action.cardCatalogId ?? action.referenceInsert?.card_catalog_id;
    if (!catalogId || !isValidPostgresUuid(catalogId)) throw new Error('invalid_catalog_uuid');
    if (action.referenceInsert && (action.referenceInsert.source !== 'pokemon_tcg_api' || action.referenceInsert.external_id !== action.externalId || action.referenceInsert.card_catalog_id !== catalogId)) throw new Error('invalid_reference');
  }
}

export type ResumeCheckpoint = { identity: string; completedChunks: number[]; writes: number };
export function resumeChunks(total: number, checkpoint: ResumeCheckpoint, identity: string): number[] {
  if (checkpoint.identity !== identity || checkpoint.writes < 0) throw new Error('checkpoint_identity_mismatch');
  const completed = new Set(checkpoint.completedChunks);
  if ([...completed].some((index) => !Number.isInteger(index) || index < 0 || index >= total)) throw new Error('checkpoint_chunk_invalid');
  return Array.from({ length: total }, (_, index) => index).filter((index) => !completed.has(index));
}

export function assertNoUnexpectedWrites(planned: number, actual: number): void { if (actual !== planned) throw new Error('unexpected_extra_writes'); }
export function assertIdempotent(plannedWrites: number): void { if (plannedWrites !== 0) throw new Error('idempotency_planned_writes_nonzero'); }
