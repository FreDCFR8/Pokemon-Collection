import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { reportHash, SET_EXTERNAL_SOURCE } from './setmapping-validation.ts';
import { parseLocalCatalogManifestFromText, type LocalCatalogManifest } from './local-manifest.ts';
import { writeAtomicJson } from './checkpoint.ts';

export const SET_MAPPING_PLAN_SCHEMA_VERSION = 1;
export const EXPECTED_CANDIDATE_COUNT = 44;
export const EXPECTED_SAFE_COUNT = 41;
export const EXCLUDED_SET_CODES = ['sv9', 'swsh9', 'zsv10pt5'] as const;

export type SetMapping = {
  setCode: string;
  externalId: string;
  source: typeof SET_EXTERNAL_SOURCE;
  sourceUrl: string;
  legacySource?: string | null;
  legacySourceId?: string | null;
};

export type SetMappingPlan = {
  schemaVersion: number;
  phase: 'Phase 7B-2F9D-B';
  source: 'pokemon_tcg_data';
  datasetRepository: string;
  datasetVersion: string;
  manifestHash: string;
  pr139ReportHash: string;
  pr139SourceReportHash: string;
  mappingCount: number;
  databaseWritesTotal: 0;
  mappings: SetMapping[];
  planHash: string;
};

type Candidate = { set_code?: unknown; source?: unknown; source_id?: unknown };
type ReportCandidate = { setId?: unknown; candidate?: Candidate; validation?: { classification?: unknown }; mappingImplementationStatus?: unknown };
type ValidationReport = {
  schemaVersion?: unknown; phase?: unknown; mode?: unknown; source?: unknown; datasetRepository?: unknown; datasetVersion?: unknown;
  sourceReportHash?: unknown; candidateCount?: unknown; status?: unknown; databaseWritesTotal?: unknown;
  classifications?: Record<string, unknown>; operationalErrors?: unknown; candidates?: unknown; reportHash?: unknown;
};

export class SetMappingPlanError extends Error {}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SetMappingPlanError(`${label} moet een JSON-object zijn.`);
  return value as Record<string, unknown>;
}

function sha256(text: string): string { return createHash('sha256').update(text).digest('hex'); }
export function normalizeLineEndings(text: string): string { return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'); }
function stablePlanWithoutHash(plan: Omit<SetMappingPlan, 'planHash'>): string { return reportHash(plan); }

function parseReport(text: string): ValidationReport {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new SetMappingPlanError('PR139-rapport is geen geldige JSON.'); }
  const report = object(parsed, 'PR139-rapport') as ValidationReport;
  if (report.schemaVersion !== 2 || report.phase !== 'Phase 7B-2F9D-A' || report.mode !== 'read-only') throw new SetMappingPlanError('PR139-rapport heeft niet het verwachte schema of fase.');
  if (report.source !== 'pokemon_tcg_data' || report.datasetRepository !== 'PokemonTCG/pokemon-tcg-data') throw new SetMappingPlanError('PR139-rapport gebruikt een onverwachte datasetrepository.');
  if (typeof report.datasetVersion !== 'string' || !/^[0-9a-f]{40}$/.test(report.datasetVersion)) throw new SetMappingPlanError('PR139-rapport mist een geldige gepinde datasetversie.');
  if (report.status !== 'PASS' || report.candidateCount !== EXPECTED_CANDIDATE_COUNT || report.databaseWritesTotal !== 0) throw new SetMappingPlanError('PR139-rapport voldoet niet aan PASS, candidateCount=44 en databaseWritesTotal=0.');
  if (!Array.isArray(report.operationalErrors) || report.operationalErrors.length !== 0) throw new SetMappingPlanError('PR139-rapport bevat operationele fouten.');
  if (typeof report.sourceReportHash !== 'string' || !/^[0-9a-f]{64}$/.test(report.sourceReportHash)) throw new SetMappingPlanError('PR139-rapport mist een geldige bronrapport-hash.');
  if (!Array.isArray(report.candidates) || report.candidates.length !== EXPECTED_CANDIDATE_COUNT || !report.classifications || report.classifications.safe_for_mapping_review !== EXPECTED_SAFE_COUNT || report.classifications.needs_manual_review !== 1 || report.classifications.blocked !== 2) throw new SetMappingPlanError('PR139-rapport heeft onverwachte classificatietellingen.');
  if (typeof report.reportHash !== 'string' || !/^[0-9a-f]{64}$/.test(report.reportHash)) throw new SetMappingPlanError('PR139-rapport mist een geldige rapporthash.');
  const withoutHash = { ...report } as Record<string, unknown>; delete withoutHash.reportHash;
  if (reportHash(withoutHash) !== report.reportHash) throw new SetMappingPlanError('PR139-rapporthash is ongeldig.');
  return report;
}

export function buildSetMappingPlan(reportText: string, manifestText: string): SetMappingPlan {
  const report = parseReport(reportText);
  const manifest: LocalCatalogManifest = parseLocalCatalogManifestFromText(manifestText);
  if (manifest.datasetRepository !== report.datasetRepository || manifest.datasetVersion !== report.datasetVersion) throw new SetMappingPlanError('Manifest en PR139-rapport hebben niet exact dezelfde datasetidentiteit.');
  const candidates = report.candidates as ReportCandidate[];
  const manifestSets = new Map(manifest.sets.map((set) => [set.setId, set]));
  const mappings: SetMapping[] = [];
  const seenSetCodes = new Set<string>(); const seenExternalIds = new Set<string>();
  for (const raw of candidates) {
    const candidate = object(raw, 'PR139-kandidaat') as ReportCandidate;
    const setCode = typeof candidate.setId === 'string' ? candidate.setId : '';
    const mapped = object(candidate.candidate, 'PR139-kandidaat.candidate') as Candidate;
    if (candidate.validation?.classification !== 'safe_for_mapping_review' || candidate.mappingImplementationStatus !== 'requires_set_external_references') continue;
    if (!setCode || typeof mapped.set_code !== 'string' || mapped.set_code !== setCode) throw new SetMappingPlanError(`Ongeldige veilige mapping voor ${setCode || '<onbekend>'}.`);
    const manifestSet = manifestSets.get(setCode);
    if (!manifestSet || !manifestSet.enabled || manifestSet.setId !== setCode) throw new SetMappingPlanError(`Veilige mapping ${setCode} ontbreekt in het gepinde enabled manifest.`);
    if ((EXCLUDED_SET_CODES as readonly string[]).includes(setCode)) throw new SetMappingPlanError(`Uitgesloten set ${setCode} werd geselecteerd.`);
    if (seenSetCodes.has(setCode)) throw new SetMappingPlanError(`Dubbele interne setcode: ${setCode}.`);
    if (seenExternalIds.has(setCode)) throw new SetMappingPlanError(`Dubbel extern ID: ${setCode}.`);
    seenSetCodes.add(setCode); seenExternalIds.add(setCode);
    mappings.push({ setCode, externalId: setCode, source: SET_EXTERNAL_SOURCE, sourceUrl: `https://api.pokemontcg.io/v2/sets/${setCode}`, legacySource: typeof mapped.source === 'string' ? mapped.source : null, legacySourceId: typeof mapped.source_id === 'string' ? mapped.source_id : null });
  }
  mappings.sort((a, b) => a.setCode.localeCompare(b.setCode));
  if (mappings.length !== EXPECTED_SAFE_COUNT) throw new SetMappingPlanError(`Exact 41 veilige setmappings vereist, ontvangen: ${mappings.length}.`);
  const base: Omit<SetMappingPlan, 'planHash'> = { schemaVersion: SET_MAPPING_PLAN_SCHEMA_VERSION, phase: 'Phase 7B-2F9D-B', source: 'pokemon_tcg_data', datasetRepository: manifest.datasetRepository, datasetVersion: manifest.datasetVersion, manifestHash: sha256(normalizeLineEndings(manifestText)), pr139ReportHash: report.reportHash!, pr139SourceReportHash: String(report.sourceReportHash), mappingCount: mappings.length, databaseWritesTotal: 0, mappings };
  return { ...base, planHash: stablePlanWithoutHash(base) };
}

export function parseSetMappingPlanText(text: string): SetMappingPlan {
  let parsed: unknown; try { parsed = JSON.parse(text); } catch { throw new SetMappingPlanError('Mappingplan is geen geldige JSON.'); }
  const plan = object(parsed, 'Mappingplan') as SetMappingPlan;
  if (plan.schemaVersion !== SET_MAPPING_PLAN_SCHEMA_VERSION || plan.phase !== 'Phase 7B-2F9D-B' || plan.mappingCount !== EXPECTED_SAFE_COUNT || plan.databaseWritesTotal !== 0 || !Array.isArray(plan.mappings)) throw new SetMappingPlanError('Mappingplan heeft een ongeldig schema.');
  if (!/^[0-9a-f]{64}$/.test(plan.planHash ?? '')) throw new SetMappingPlanError('Mappingplan mist een geldige planhash.');
  const { planHash, ...base } = plan; if (stablePlanWithoutHash(base) !== planHash) throw new SetMappingPlanError('Mappingplanhash is ongeldig.');
  if (plan.datasetRepository !== 'PokemonTCG/pokemon-tcg-data' || !/^[0-9a-f]{40}$/.test(plan.datasetVersion ?? '') || !/^[0-9a-f]{64}$/.test(plan.manifestHash ?? '') || !/^[0-9a-f]{64}$/.test(plan.pr139ReportHash ?? '') || !/^[0-9a-f]{64}$/.test(plan.pr139SourceReportHash ?? '')) throw new SetMappingPlanError('Mappingplan bevat een ongeldige dataset- of rapportidentiteit.');
  if (plan.mappings.length !== EXPECTED_SAFE_COUNT || plan.mappings.some((item) => !item.setCode || item.source !== SET_EXTERNAL_SOURCE || item.externalId !== item.setCode || typeof item.sourceUrl !== 'string' || !/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(item.sourceUrl) || (item.legacySource !== undefined && item.legacySource !== null && typeof item.legacySource !== 'string') || (item.legacySourceId !== undefined && item.legacySourceId !== null && typeof item.legacySourceId !== 'string'))) throw new SetMappingPlanError('Mappingplan bevat ongeldige mappings.');
  if (new Set(plan.mappings.map((item) => item.setCode)).size !== EXPECTED_SAFE_COUNT) throw new SetMappingPlanError('Mappingplan bevat dubbele setcodes.');
  if (new Set(plan.mappings.map((item) => `${item.source}:${item.externalId}`)).size !== EXPECTED_SAFE_COUNT || plan.mappings.some((item) => (EXCLUDED_SET_CODES as readonly string[]).includes(item.setCode))) throw new SetMappingPlanError('Mappingplan bevat dubbele of uitgesloten mappings.');
  return plan;
}

export function writeSetMappingPlan(path: string, plan: SetMappingPlan): void { writeAtomicJson(path, plan); }
export function readSetMappingPlan(path: string): SetMappingPlan { return parseSetMappingPlanText(readFileSync(path, 'utf8')); }

if (process.argv[1]?.endsWith('set-mapping-plan.ts')) {
  try {
    const args = process.argv.slice(2); const value = (flag: string) => { const index = args.indexOf(flag); if (index < 0 || !args[index + 1]) throw new SetMappingPlanError(`${flag} is verplicht.`); return args[index + 1]; };
    const plan = buildSetMappingPlan(readFileSync(value('--pr139-report'), 'utf8'), readFileSync(value('--manifest'), 'utf8')); writeSetMappingPlan(value('--output'), plan); console.log(`Plan PASS: ${plan.mappingCount} mappings; planHash ${plan.planHash}; databaseWritesTotal 0`);
  } catch (error) { console.error(`Setmappingplan geblokkeerd: ${error instanceof Error ? error.message : 'onbekende fout'}`); process.exitCode = 1; }
}
