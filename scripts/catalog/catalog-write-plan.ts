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
  sourceReportHash: string;
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

export function createCatalogWritePlan(params: Omit<CatalogWritePlan, 'schemaVersion' | 'phase' | 'source' | 'analysisHash' | 'finalStatus'>): CatalogWritePlan {
  const base = { schemaVersion: CATALOG_WRITE_PLAN_SCHEMA_VERSION, phase: 'Phase 7B-2F9E-B' as const, source: 'pokemon_tcg_data' as const, ...params };
  const finalStatus = params.conflicts.length === 0 && params.blockedItems.length === 0 && params.perSet.every((set) => set.receivedCards === set.expectedCards && set.conflicts === 0 && set.blockedItems === 0) ? 'PASS' as const : 'BLOCKED' as const;
  const withStatus = { ...base, finalStatus };
  return { ...withStatus, analysisHash: analysisHash(withStatus) };
}

export function validateCatalogWritePlan(value: unknown, expected: { datasetVersion: string; datasetCommit: string; manifestHash: string; sourceReportHash: string; sets: readonly string[] }): CatalogWritePlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Writeplan heeft een ongeldig formaat.');
  const plan = value as CatalogWritePlan;
  if (!Object.prototype.hasOwnProperty.call(plan, 'source') || typeof plan.source !== 'string' || plan.source !== 'pokemon_tcg_data') throw new Error('Writeplan-source ontbreekt of is ongeldig.');
  if (plan.schemaVersion !== CATALOG_WRITE_PLAN_SCHEMA_VERSION || plan.phase !== 'Phase 7B-2F9E-B') throw new Error('Writeplan-schema is ongeldig.');
  if (plan.datasetVersion !== expected.datasetVersion || plan.datasetCommit !== expected.datasetCommit) throw new Error('Datasetcommit van het writeplan komt niet overeen.');
  if (plan.manifestHash !== expected.manifestHash) throw new Error('manifestHash van het writeplan komt niet overeen.');
  if (typeof plan.sourceReportHash !== 'string' || !/^[0-9a-f]{64}$/.test(plan.sourceReportHash)) throw new Error('Writeplan mist een geldige sourceReportHash.');
  if (plan.sourceReportHash !== expected.sourceReportHash) throw new Error('sourceReportHash van het writeplan komt niet overeen met het goedgekeurde dry-runrapport.');
  if (JSON.stringify(plan.sets) !== JSON.stringify(expected.sets)) throw new Error('Exacte setlijst van het writeplan komt niet overeen.');
  if (plan.finalStatus !== 'PASS') throw new Error('Writeplan is niet PASS.');
  if (!Array.isArray(plan.conflicts) || plan.conflicts.length !== 0) throw new Error('Writeplan bevat conflicten.');
  if (!Array.isArray(plan.blockedItems) || plan.blockedItems.length !== 0) throw new Error('Writeplan bevat geblokkeerde items.');
  const withoutHash = { ...plan } as Record<string, unknown>;
  delete withoutHash.analysisHash;
  if (typeof plan.analysisHash !== 'string' || analysisHash(withoutHash) !== plan.analysisHash) throw new Error('analysisHash van het writeplan komt niet overeen.');
  if (plan.expectedCardsTotal !== plan.perSet.reduce((sum, set) => sum + set.expectedCards, 0) || plan.perSet.some((set) => set.receivedCards !== set.expectedCards)) throw new Error('Expected/received kaarttotalen van het writeplan kloppen niet.');
  if (plan.perSet.some((set) => set.actions.length !== set.receivedCards)) throw new Error('Writeplan bevat niet exact één actie per ontvangen kaart.');
  if (plan.plannedCatalogInserts !== plan.perSet.reduce((sum, set) => sum + set.plannedCatalogInserts, 0) || plan.plannedReferenceInserts !== plan.perSet.reduce((sum, set) => sum + set.plannedReferenceInserts, 0)) throw new Error('Writeplan-totalen komen niet overeen met de per-setacties.');
  for (const set of plan.perSet) {
    for (const action of set.actions) {
      if (!['existingIdentical', 'insertReference', 'insertCardAndReference', 'blocked', 'conflict'].includes(action.action)) throw new Error('Writeplan bevat een onbekende kaartactie.');
      if (action.setId !== set.setId || action.externalSource !== 'pokemon_tcg_api' || !action.externalId || !action.cardNumber) throw new Error('Kaartactie bevat ongeldige bron- of kaartidentiteit.');
      if (action.action === 'blocked' || action.action === 'conflict') throw new Error('Writeplan bevat een blocked/conflict-kaartactie.');
      if (!set.setCatalogId || !set.setCode || action.setCatalogId !== set.setCatalogId || ('setCode' in action && action.setCode !== set.setCode)) throw new Error('Writeplan mist setCatalogId of setCode voor een uitvoerbare kaartactie.');
      if (action.action === 'existingIdentical' && !action.cardCatalogId) throw new Error('existingIdentical mist cardCatalogId.');
      if (action.action === 'insertReference' && !action.referenceInsert.card_catalog_id) throw new Error('insertReference mist reference-data.');
      if (action.action === 'insertCardAndReference' && (!action.catalogInsert || !action.referenceInsert || action.referenceInsert.card_catalog_id !== action.catalogInsert.id)) throw new Error('insertCardAndReference mist gekoppelde catalogus- en reference-data.');
    }
  }
  return plan;
}

export function writePlanIdentity(plan: CatalogWritePlan): string { return canonicalAnalysisJson(plan); }
