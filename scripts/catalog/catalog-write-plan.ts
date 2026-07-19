import { analysisHash, canonicalAnalysisJson } from './catalog-report-identity.ts';
import type { CanonicalSetAnalysis } from './import-set.ts';

export const CATALOG_WRITE_PLAN_SCHEMA_VERSION = 1;

export type CatalogWritePlan = {
  schemaVersion: number;
  phase: 'Phase 7B-2F9E-B';
  source: 'pokemon_tcg_data';
  datasetRepository: string;
  datasetVersion: string;
  datasetCommit: string;
  manifestHash: string;
  batch: string;
  sets: string[];
  expectedCardsTotal: number;
  existingCardsTotal: number;
  plannedCatalogInserts: number;
  plannedReferenceInserts: number;
  conflicts: unknown[];
  blockedItems: unknown[];
  perSet: CanonicalSetAnalysis[];
  analysisHash: string;
  finalStatus: 'PASS' | 'BLOCKED';
};

export function createCatalogWritePlan(params: Omit<CatalogWritePlan, 'schemaVersion' | 'phase' | 'analysisHash' | 'finalStatus'>): CatalogWritePlan {
  const base = { schemaVersion: CATALOG_WRITE_PLAN_SCHEMA_VERSION, phase: 'Phase 7B-2F9E-B' as const, ...params };
  const finalStatus = params.conflicts.length === 0 && params.blockedItems.length === 0 && params.perSet.every((set) => set.receivedCards === set.expectedCards && set.conflicts === 0 && set.blockedItems === 0) ? 'PASS' as const : 'BLOCKED' as const;
  const withStatus = { ...base, finalStatus };
  return { ...withStatus, analysisHash: analysisHash(withStatus) };
}

export function validateCatalogWritePlan(value: unknown, expected: { datasetVersion: string; datasetCommit: string; manifestHash: string; sets: readonly string[] }): CatalogWritePlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Writeplan heeft een ongeldig formaat.');
  const plan = value as CatalogWritePlan;
  if (plan.schemaVersion !== CATALOG_WRITE_PLAN_SCHEMA_VERSION || plan.phase !== 'Phase 7B-2F9E-B' || plan.source !== 'pokemon_tcg_data') throw new Error('Writeplan-schema of bron is ongeldig.');
  if (plan.datasetVersion !== expected.datasetVersion || plan.datasetCommit !== expected.datasetCommit) throw new Error('Datasetcommit van het writeplan komt niet overeen.');
  if (plan.manifestHash !== expected.manifestHash) throw new Error('manifestHash van het writeplan komt niet overeen.');
  if (JSON.stringify(plan.sets) !== JSON.stringify(expected.sets)) throw new Error('Exacte setlijst van het writeplan komt niet overeen.');
  if (plan.finalStatus !== 'PASS') throw new Error('Writeplan is niet PASS.');
  if (!Array.isArray(plan.conflicts) || plan.conflicts.length !== 0) throw new Error('Writeplan bevat conflicten.');
  if (!Array.isArray(plan.blockedItems) || plan.blockedItems.length !== 0) throw new Error('Writeplan bevat geblokkeerde items.');
  const withoutHash = { ...plan } as Record<string, unknown>;
  delete withoutHash.analysisHash;
  if (typeof plan.analysisHash !== 'string' || analysisHash(withoutHash) !== plan.analysisHash) throw new Error('analysisHash van het writeplan komt niet overeen.');
  if (plan.expectedCardsTotal !== plan.perSet.reduce((sum, set) => sum + set.expectedCards, 0) || plan.perSet.some((set) => set.receivedCards !== set.expectedCards)) throw new Error('Expected/received kaarttotalen van het writeplan kloppen niet.');
  return plan;
}

export function writePlanIdentity(plan: CatalogWritePlan): string { return canonicalAnalysisJson(plan); }
