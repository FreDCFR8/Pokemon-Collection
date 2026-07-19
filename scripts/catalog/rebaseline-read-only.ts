import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inventoryLocalDataset } from './generate-local-manifest.ts';
import { loadPokemonTcgDataJson, type LocalPokemonCard } from './local-json.ts';
import { POKEMON_TCG_DATA_REPOSITORY, PINNED_DATASET_VERSION } from './local-checkout.ts';
import { buildCanonicalSetAnalysis, matchCards, type CanonicalSetAnalysis, type MatchingReport, type SetCatalogRow } from './import-set.ts';
import { analysisHash, reportHash } from './catalog-report-identity.ts';
import { writeAtomicJson } from './checkpoint.ts';
import { localManifestIdentity } from './catalog-manifest-identity.ts';
import { createCatalogWritePlan } from './catalog-write-plan.ts';

export const PHASE = 'Phase 7B-2F9E-B';
export const REPORT_SCHEMA_VERSION = 1;
export const BATCHES = {
  'batch-1': ['bw9', 'cel25', 'me1', 'me2', 'me2pt5', 'me3', 'me4', 'pgo', 'rsv10pt5', 'sm1', 'sm12', 'sm2', 'sm35'],
  'batch-2': ['sm4', 'sm7', 'sm8', 'sv1', 'sv10', 'sv3', 'sv3pt5', 'sv4', 'sv4pt5', 'sv6pt5', 'sv8', 'sv8pt5', 'swsh1'],
  'batch-3': ['swsh10', 'swsh11', 'swsh12', 'swsh12pt5', 'swsh2', 'swsh3', 'swsh35', 'swsh4', 'swsh45', 'swsh5', 'swsh6', 'swsh7', 'xy11'],
} as const;
export const IMPORT_READY_SETS = [...BATCHES['batch-1'], ...BATCHES['batch-2'], ...BATCHES['batch-3']];
export const EXPECTED_SETS = 173;
export const EXPECTED_CARDS = 20324;
const CARD_SOURCE = 'pokemon_tcg_api';
const TABLES = ['cards_catalog', 'card_external_references', 'collection_cards', 'sets_catalog', 'set_external_references'] as const;
const PAGE_SIZE = 100;

type Classification = 'PASS' | 'BLOCKED' | 'NEEDS_MANUAL_REVIEW' | 'OPERATIONAL_ERROR';
type SetStatus = { setId: string; status: 'pending' | 'running' | 'completed' | 'failed'; result?: SetResult; error?: string };
type RunCheckpoint = { schemaVersion: number; phase: string; source: string; datasetRepository: string; datasetVersion: string; manifestHash: string; setIds: string[]; startedAt: string; updatedAt: string; sets: SetStatus[] };

export type SetResult = {
  setId: string;
  classification: Classification;
  reasonCodes: string[];
  expectedCards: number;
  receivedCards: number;
  existingCatalogCards: number;
  existingExternalReferences: number;
  theoreticalNewCatalogCards: number;
  theoreticalNewCardReferences: number;
  theoreticalWrites: number;
  identityConflicts: number;
  metadataConflicts: number;
  setsCatalogRecordExists: boolean;
  importReady: boolean;
  setMappingStatus: string;
  diagnostic: {
    matchedByExternalReference: number;
    safeFallbackCandidates: number;
    fallbackCandidatesQueried: number;
    ambiguous: number;
    conflicts: number;
    unresolvedWithoutSetMapping: number;
    metadataUnchanged: number;
    metadataChanged: number;
  };
};

type Counts = Record<(typeof TABLES)[number], number>;
type RegisteredReference = { external_id: string; set_catalog_id: string };
type SetCatalogWithId = SetCatalogRow & { id: string };
type Report = {
  schemaVersion: number; phase: string; source: 'pokemon_tcg_data'; datasetRepository: string; datasetVersion: string; manifestHash: string;
  startedAt: string; finishedAt: string; setsPlanned: number; setsProcessed: number; setsPassed: number; setsBlocked: number; setsNeedsManualReview: number;
  expectedCardsTotal: number; receivedCardsTotal: number; theoreticalWrites: { cardsCatalog: number; cardExternalReferences: number; total: number };
  actualWrites: number; conflicts: { identity: number; metadata: number; total: number }; operationalErrors: string[]; postcheckErrors: string[]; databaseWritesTotal: 0;
  precheckCounts?: Counts; postcheckCounts?: Counts; importReadySets: string[]; blockedSets: string[]; reasonCodesBySet: Record<string, string[]>; results: SetResult[];
  checkpoint?: { path: string; resumed: boolean; skippedCompletedSets: number }; finalStatus: 'PASS' | 'BLOCKED' | 'FAIL'; reportHash?: string; analysisHash?: string;
};

export type BatchName = keyof typeof BATCHES;
export function validateBatchLists(): void {
  const batches = Object.values(BATCHES);
  if (batches.some((batch) => batch.length !== 13) || new Set(IMPORT_READY_SETS).size !== 39 || IMPORT_READY_SETS.length !== 39) throw new RebaselineError('Batchlijsten moeten exact 3 x 13 unieke sets bevatten.');
  if (IMPORT_READY_SETS.some((setId) => !setId || setId === 'sv9' || setId === 'swsh9' || setId === 'zsv10pt5')) throw new RebaselineError('Batchlijst bevat een geblokkeerde of NEEDS_MANUAL_REVIEW-set.');
}
export function selectBatch(manifest: NonNullable<ReturnType<typeof inventoryLocalDataset>['manifest']>, batch: BatchName): NonNullable<ReturnType<typeof inventoryLocalDataset>['manifest']> {
  validateBatchLists();
  const expected = BATCHES[batch]; const byId = new Map(manifest.sets.map((set) => [set.setId, set]));
  if (expected.some((setId) => !byId.has(setId))) throw new RebaselineError(`${batch} bevat een set die ontbreekt in de lokale dataset.`);
  return { ...manifest, sets: expected.map((setId) => byId.get(setId)!) };
}

export class RebaselineError extends Error {}

export function assertDatasetProfile(profile: { setsIndexed: number; setsValid: number; receivedCardsTotal: number }): void {
  if (profile.setsIndexed !== EXPECTED_SETS || profile.setsValid !== EXPECTED_SETS || profile.receivedCardsTotal !== EXPECTED_CARDS) throw new RebaselineError(`Datasetprofiel wijkt af: sets=${profile.setsIndexed}, valid=${profile.setsValid}, cards=${profile.receivedCardsTotal}.`);
}

function gitForDataset(inputRoot: string, args: string[]): string {
  return execFileSync('git', ['-c', `safe.directory=${inputRoot}`, '-C', inputRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function sanitise(message: string): string {
  let value = message;
  for (const secret of [process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY]) if (secret) value = value.split(secret).join('[REDACTED]');
  return value.replace(/(?:[A-Za-z]:)?[\\/][^\s]+/g, '[REDACTED_PATH]').replace(/(api[_-]?key|token|secret|password)=([^\s]+)/gi, '$1=[REDACTED]');
}

function chunks<T>(values: T[], size = PAGE_SIZE): T[][] { const result: T[][] = []; for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size)); return result; }
function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  return query.then(({ data, error }) => { if (error) throw new RebaselineError(`Supabase SELECT mislukt (${label}): ${sanitise(error.message)}`); return data ?? []; });
}

export function parseArgs(argv: readonly string[]): { dataset: string; report: string; batch: BatchName; checkpoint?: string; writePlan?: string; resume: boolean; help: boolean } {
  if (argv.some((arg) => ['--write', '--insert', '--update', '--upsert', '--delete', '--rpc', '--migrate', '--migration'].includes(arg) || arg.startsWith('--write='))) throw new RebaselineError('Deze runner is strikt read-only en weigert schrijfopties.');
  const values = new Map<string, string>(); let resume = false; let help = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { help = true; continue; }
    if (arg === '--resume') { if (resume) throw new RebaselineError('--resume mag slechts eenmaal worden opgegeven.'); resume = true; continue; }
    const match = arg.match(/^--(dataset|report|batch|checkpoint|write-plan)(?:=(.*))?$/);
    if (!match) throw new RebaselineError(`Onbekend argument: ${arg}`);
    const value = match[2] ?? argv[++i]; if (!value || value.startsWith('--')) throw new RebaselineError(`Ontbrekende waarde voor --${match[1]}.`);
    if (values.has(match[1])) throw new RebaselineError(`--${match[1]} mag slechts eenmaal worden opgegeven.`); values.set(match[1], value);
  }
  if (help) return { dataset: values.get('dataset') ?? '', report: values.get('report') ?? '', batch: (values.get('batch') ?? 'batch-1') as BatchName, ...(values.has('checkpoint') ? { checkpoint: values.get('checkpoint') } : {}), resume, help };
  if (!values.has('dataset') || !values.has('report') || !values.has('batch')) throw new RebaselineError('--dataset, --batch en --report zijn verplicht.');
  if (!(values.get('batch')! in BATCHES)) throw new RebaselineError('--batch moet batch-1, batch-2 of batch-3 zijn.');
  if (resume && !values.has('checkpoint')) throw new RebaselineError('--resume vereist --checkpoint.');
  return { dataset: resolve(values.get('dataset')!), report: resolve(values.get('report')!), batch: values.get('batch') as BatchName, ...(values.has('checkpoint') ? { checkpoint: resolve(values.get('checkpoint')!) } : {}), ...(values.has('write-plan') ? { writePlan: resolve(values.get('write-plan')!) } : {}), resume, help };
}

export function preflightDataset(dataset: string): { manifest: NonNullable<ReturnType<typeof inventoryLocalDataset>['manifest']>; manifestHash: string; warnings: unknown[] } {
  const root = resolve(dataset);
  if (!existsSync(root) || !existsSync(join(root, '.git'))) throw new RebaselineError('Datasetmap of .git ontbreekt.');
  const result = inventoryLocalDataset(root, join(root, 'unused-manifest.json'), gitForDataset);
  if (!result.manifest || result.report.status !== 'PASS') throw new RebaselineError(`Datasetpreflight mislukt: ${(result.report.errors ?? []).map((error) => error.reason).join('; ')}`);
  assertDatasetProfile(result.report);
  return { manifest: result.manifest, manifestHash: localManifestIdentity(result.manifest).manifestHash, warnings: result.report.warnings ?? [] };
}

async function countTables(supabase: SupabaseClient): Promise<Counts> {
  const counts = {} as Counts;
  for (const table of TABLES) {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
    if (error || count === null) throw new RebaselineError(`Supabase SELECT count mislukt (${table}): ${sanitise(error?.message ?? 'count ontbreekt')}`);
    counts[table] = count;
  }
  return counts;
}

async function registeredMappings(supabase: SupabaseClient): Promise<Map<string, SetCatalogRow>> {
  const references = await rows<RegisteredReference>(supabase.from('set_external_references').select('external_id,set_catalog_id').eq('source', CARD_SOURCE), 'set_external_references');
  const ids = [...new Set(references.map((row) => row.set_catalog_id))]; const catalog = new Map<string, SetCatalogRow>();
  for (const batch of chunks(ids)) for (const row of await rows<SetCatalogWithId>(supabase.from('sets_catalog').select('id,set_code,source,source_id,name,series').in('id', batch), 'sets_catalog for set_external_references')) catalog.set(row.id, row);
  const result = new Map<string, SetCatalogRow>();
  for (const reference of references) { const row = catalog.get(reference.set_catalog_id); if (!row) throw new RebaselineError(`Dangling set_external_references-record voor ${reference.external_id}.`); if (result.has(reference.external_id)) throw new RebaselineError(`Dubbele set_external_references-identiteit voor ${reference.external_id}.`); result.set(reference.external_id, row); }
  return result;
}

function reasonCodes(matching: MatchingReport, cards: LocalPokemonCard[]): string[] {
  const reasons = new Set<string>();
  if (matching.setMappingStatus === 'no_candidate') reasons.add('missing_set_mapping');
  if (matching.setMappingStatus === 'conflicting_candidate') reasons.add('multiple_set_mappings');
  if (matching.setMappingStatus === 'exact_candidate' || matching.setMappingStatus === 'ambiguous_candidate') reasons.add('unregistered_set_mapping');
  if (matching.unresolvedWithoutSetMapping > 0) reasons.add('missing_set_mapping');
  if (matching.ambiguous > 0) reasons.add('ambiguous_fallback_candidate');
  if (matching.conflicts > 0) { reasons.add('card_identity_conflict'); reasons.add('external_reference_conflict'); }
  if (matching.metadataChanged > 0) reasons.add('metadata_conflict');
  if (new Set(cards.map((card) => card.number)).size !== cards.length) reasons.add('duplicate_incoming_card_numbers');
  return [...reasons].sort();
}

function classify(matching: MatchingReport, cards: LocalPokemonCard[]): Classification {
  const reasons = reasonCodes(matching, cards);
  if (matching.conflicts > 0 || matching.metadataChanged > 0) return 'BLOCKED';
  if (matching.ambiguous > 0 || matching.setMappingStatus === 'exact_candidate' || matching.setMappingStatus === 'ambiguous_candidate' || reasons.includes('duplicate_incoming_card_numbers')) return 'NEEDS_MANUAL_REVIEW';
  if (matching.unresolvedWithoutSetMapping > 0 || matching.errors.length > 0 || matching.setMappingStatus === 'no_candidate' || matching.setMappingStatus === 'conflicting_candidate') return 'BLOCKED';
  return 'PASS';
}

function setResult(setId: string, expected: number, cards: LocalPokemonCard[], matching: MatchingReport): SetResult {
  const classification = classify(matching, cards); const reasons = reasonCodes(matching, cards); const theoreticalNewCatalogCards = matching.newCards; const theoreticalNewCardReferences = matching.newCards + matching.safeFallbackCandidates;
  return { setId, classification, reasonCodes: reasons, expectedCards: expected, receivedCards: cards.length, existingCatalogCards: matching.catalogCardsQueried, existingExternalReferences: matching.externalReferencesQueried, theoreticalNewCatalogCards, theoreticalNewCardReferences, theoreticalWrites: theoreticalNewCatalogCards + theoreticalNewCardReferences, identityConflicts: matching.conflicts, metadataConflicts: matching.metadataChanged, setsCatalogRecordExists: Boolean(matching.setCode), importReady: classification === 'PASS', setMappingStatus: matching.setMappingStatus, diagnostic: { matchedByExternalReference: matching.matchedByExternalReference, safeFallbackCandidates: matching.safeFallbackCandidates, fallbackCandidatesQueried: matching.fallbackCandidatesQueried, ambiguous: matching.ambiguous, conflicts: matching.conflicts, unresolvedWithoutSetMapping: matching.unresolvedWithoutSetMapping, metadataUnchanged: matching.metadataUnchanged, metadataChanged: matching.metadataChanged } };
}

export function validateCheckpoint(value: unknown, manifest: { datasetRepository: string; datasetVersion: string; sets: Array<{ setId: string; expectedCards: number }> }, hash: string): RunCheckpoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RebaselineError('Checkpoint heeft een ongeldig formaat.');
  const checkpoint = value as RunCheckpoint; const expectedIds = manifest.sets.map((set) => set.setId); const keys = Object.keys(checkpoint).sort(); const allowed = ['datasetRepository', 'datasetVersion', 'manifestHash', 'phase', 'schemaVersion', 'setIds', 'sets', 'source', 'startedAt', 'updatedAt'];
  if (JSON.stringify(keys) !== JSON.stringify(allowed.sort())) throw new RebaselineError('Checkpoint bevat onbekende of ontbrekende velden.');
  if (checkpoint.schemaVersion !== REPORT_SCHEMA_VERSION || checkpoint.phase !== PHASE || checkpoint.source !== 'pokemon_tcg_data' || checkpoint.datasetRepository !== manifest.datasetRepository || checkpoint.datasetVersion !== manifest.datasetVersion || checkpoint.manifestHash !== hash || JSON.stringify(checkpoint.setIds) !== JSON.stringify(expectedIds)) throw new RebaselineError('Checkpoint-identiteit komt niet overeen met de actuele dataset.');
  if (!Array.isArray(checkpoint.sets) || checkpoint.sets.length !== expectedIds.length) throw new RebaselineError('Checkpoint moet exact 173 sets bevatten.');
  for (let i = 0; i < checkpoint.sets.length; i += 1) { const set = checkpoint.sets[i]; if (set.setId !== expectedIds[i] || !['pending', 'running', 'completed', 'failed'].includes(set.status)) throw new RebaselineError(`Checkpoint-set ${set.setId} is ongeldig.`); if (set.status === 'completed' && !set.result) throw new RebaselineError(`Checkpoint completed-set ${set.setId} mist een volledig resultaat.`); if ((set.status === 'pending' || set.status === 'running') && set.result) throw new RebaselineError(`Checkpoint ${set.status}-set ${set.setId} bevat gedeeltelijk resultaat.`); }
  return checkpoint;
}

export function checkpointIdentity(manifest: { datasetRepository: string; datasetVersion: string; sets: Array<{ setId: string; expectedCards: number }> }, hash: string, startedAt: string): RunCheckpoint { return { schemaVersion: REPORT_SCHEMA_VERSION, phase: PHASE, source: 'pokemon_tcg_data', datasetRepository: manifest.datasetRepository, datasetVersion: manifest.datasetVersion, manifestHash: hash, setIds: manifest.sets.map((set) => set.setId), startedAt, updatedAt: startedAt, sets: manifest.sets.map((set) => ({ setId: set.setId, status: 'pending' })) }; }
export function finalizeReport(report: Report): Report & { reportHash: string; analysisHash: string } {
  const withAnalysisHash = { ...report, analysisHash: analysisHash(report) };
  return { ...withAnalysisHash, reportHash: reportHash(withAnalysisHash) };
}
function saveCheckpoint(path: string, checkpoint: RunCheckpoint): void { writeAtomicJson(path, { ...checkpoint, updatedAt: new Date().toISOString() }); }
function equalCounts(a: Counts, b: Counts): boolean { return TABLES.every((table) => a[table] === b[table]); }
function help(): void { console.log('Gebruik: npm.cmd run catalog:rebaseline:read-only -- --dataset <pad> --batch batch-1|batch-2|batch-3 --report <pad> --write-plan <pad> [--checkpoint <pad>] [--resume]'); }

function failureReport(message: string, reportPath: string | undefined): number {
  const now = new Date().toISOString(); const report: Report = { schemaVersion: REPORT_SCHEMA_VERSION, phase: PHASE, source: 'pokemon_tcg_data', datasetRepository: POKEMON_TCG_DATA_REPOSITORY, datasetVersion: PINNED_DATASET_VERSION, manifestHash: '', startedAt: now, finishedAt: now, setsPlanned: EXPECTED_SETS, setsProcessed: 0, setsPassed: 0, setsBlocked: EXPECTED_SETS, setsNeedsManualReview: 0, expectedCardsTotal: EXPECTED_CARDS, receivedCardsTotal: 0, theoreticalWrites: { cardsCatalog: 0, cardExternalReferences: 0, total: 0 }, actualWrites: 0, conflicts: { identity: 0, metadata: 0, total: 0 }, operationalErrors: [sanitise(message)], postcheckErrors: [], databaseWritesTotal: 0, importReadySets: [], blockedSets: [], reasonCodesBySet: {}, results: [], finalStatus: 'BLOCKED' }; if (reportPath) writeAtomicJson(reportPath, finalizeReport(report)); console.error(`Phase 7B-2F9E-B geblokkeerd: ${sanitise(message)}`); return 1;
}

export async function run(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  let options: ReturnType<typeof parseArgs> | undefined; let reportPath: string | undefined;
  try {
    options = parseArgs(argv); reportPath = options.report || undefined; if (options.help) { help(); return 0; }
    const startedAt = new Date().toISOString(); const preflight = preflightDataset(options.dataset); const manifest = selectBatch(preflight.manifest, options.batch); const expectedCards = manifest.sets.reduce((sum, set) => sum + set.expectedCards, 0);
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new RebaselineError('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist voor read-only SELECT-controles.');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY); const before = await countTables(supabase);
    let checkpoint: RunCheckpoint; let resumed = false; let skipped = 0;
    if (options.checkpoint && options.resume) { checkpoint = validateCheckpoint(JSON.parse(readFileSync(options.checkpoint, 'utf8')), manifest, preflight.manifestHash); resumed = true; }
    else { checkpoint = checkpointIdentity(manifest, preflight.manifestHash, startedAt); if (options.checkpoint) saveCheckpoint(options.checkpoint, checkpoint); }
    const results: SetResult[] = checkpoint.sets.filter((set) => set.status === 'completed' && set.result).map((set) => set.result!); skipped = results.length; let operationalErrors: string[] = []; const analyses: CanonicalSetAnalysis[] = [];
    for (const manifestSet of manifest.sets) {
      const state = checkpoint.sets.find((set) => set.setId === manifestSet.setId)!; if (state.status === 'completed') continue;
      state.status = 'running'; if (options.checkpoint) saveCheckpoint(options.checkpoint, checkpoint);
      try {
        const cards = loadPokemonTcgDataJson(resolve(options.dataset, manifestSet.jsonPath), manifestSet.setId).cards; const matching = await matchCards(supabase, { id: manifestSet.setId, name: manifestSet.name, series: manifestSet.series, total: cards.length, printedTotal: cards.length, releaseDate: '', updatedAt: '' } as never, cards as never); const result = setResult(manifestSet.setId, manifestSet.expectedCards, cards, matching); analyses.push(buildCanonicalSetAnalysis({ setId: manifestSet.setId, setName: manifestSet.name, expectedCards: manifestSet.expectedCards, matching })); results.push(result); state.status = 'completed'; state.result = result; delete state.error; if (options.checkpoint) saveCheckpoint(options.checkpoint, checkpoint);
      } catch (error) { const message = sanitise(error instanceof Error ? error.message : 'Onbekende operationele fout.'); state.status = 'failed'; state.error = message; operationalErrors.push(`${manifestSet.setId}: ${message}`); if (options.checkpoint) saveCheckpoint(options.checkpoint, checkpoint); break; }
    }
    let after: Counts | undefined; const postcheckErrors: string[] = [];
    if (operationalErrors.length === 0) { try { after = await countTables(supabase); if (!equalCounts(before, after)) postcheckErrors.push('Read-only postcheck: beschermde tabeltellingen zijn gewijzigd.'); } catch (error) { postcheckErrors.push(sanitise(error instanceof Error ? error.message : 'Postcheck mislukt.')); } }
    const complete = operationalErrors.length === 0 && postcheckErrors.length === 0 && results.length === manifest.sets.length;
    const finalResults = results.sort((a, b) => a.setId.localeCompare(b.setId)); const contentPass = complete && finalResults.every((result) => result.classification === 'PASS' && result.expectedCards === result.receivedCards); const reasonCodesBySet = Object.fromEntries(finalResults.filter((result) => result.classification !== 'PASS').map((result) => [result.setId, result.reasonCodes])); const importReadySets = finalResults.filter((result) => result.importReady).map((result) => result.setId); const blockedSets = finalResults.filter((result) => result.classification === 'BLOCKED').map((result) => result.setId); const totals = finalResults.reduce((sum, result) => ({ cardsCatalog: sum.cardsCatalog + result.theoreticalNewCatalogCards, cardExternalReferences: sum.cardExternalReferences + result.theoreticalNewCardReferences, total: sum.total + result.theoreticalWrites }), { cardsCatalog: 0, cardExternalReferences: 0, total: 0 });
    const report: Report = { schemaVersion: REPORT_SCHEMA_VERSION, phase: PHASE, source: 'pokemon_tcg_data', datasetRepository: manifest.datasetRepository, datasetVersion: manifest.datasetVersion, manifestHash: preflight.manifestHash, startedAt: checkpoint.startedAt, finishedAt: new Date().toISOString(), setsPlanned: manifest.sets.length, setsProcessed: finalResults.length, setsPassed: finalResults.filter((result) => result.classification === 'PASS').length, setsBlocked: finalResults.filter((result) => result.classification === 'BLOCKED').length, setsNeedsManualReview: finalResults.filter((result) => result.classification === 'NEEDS_MANUAL_REVIEW').length, expectedCardsTotal: expectedCards, receivedCardsTotal: finalResults.reduce((sum, result) => sum + result.receivedCards, 0), theoreticalWrites: totals, actualWrites: 0, conflicts: { identity: finalResults.reduce((sum, result) => sum + result.identityConflicts, 0), metadata: finalResults.reduce((sum, result) => sum + result.metadataConflicts, 0), total: finalResults.reduce((sum, result) => sum + result.identityConflicts + result.metadataConflicts, 0) }, operationalErrors, postcheckErrors, databaseWritesTotal: 0, precheckCounts: before, ...(after ? { postcheckCounts: after } : {}), importReadySets, blockedSets, reasonCodesBySet, results: finalResults, checkpoint: options.checkpoint ? { path: options.checkpoint, resumed, skippedCompletedSets: skipped } : undefined, finalStatus: contentPass ? 'PASS' : operationalErrors.length || postcheckErrors.length ? 'BLOCKED' : 'FAIL' };
    writeAtomicJson(options.report, finalizeReport(report));
    if (options.writePlan && operationalErrors.length === 0 && analyses.length === manifest.sets.length) {
      const plan = createCatalogWritePlan({ datasetRepository: manifest.datasetRepository, datasetVersion: manifest.datasetVersion, datasetCommit: manifest.datasetVersion, manifestHash: preflight.manifestHash, batch: options.batch, sets: manifest.sets.map((set) => set.setId), expectedCardsTotal: analyses.reduce((sum, set) => sum + set.expectedCards, 0), existingCardsTotal: analyses.reduce((sum, set) => sum + set.actions.filter((action) => action.action === 'existingIdentical').length, 0), plannedCatalogInserts: analyses.reduce((sum, set) => sum + set.plannedCatalogInserts, 0), plannedReferenceInserts: analyses.reduce((sum, set) => sum + set.plannedReferenceInserts, 0), conflicts: analyses.flatMap((set) => set.actions.filter((action) => action.action === 'conflict')), blockedItems: analyses.flatMap((set) => set.actions.filter((action) => action.action === 'blocked')), perSet: analyses });
      writeAtomicJson(options.writePlan, plan);
    }
    console.log(`Phase 7B-2F9E-B: ${report.finalStatus}; sets=${report.setsProcessed}/${report.setsPlanned}; cards=${report.receivedCardsTotal}/${report.expectedCardsTotal}; databaseWritesTotal=0`); return report.finalStatus === 'PASS' ? 0 : 1;
  } catch (error) { return failureReport(error instanceof Error ? error.message : 'Onbekende runnerfout.', reportPath); }
}

if (process.argv[1]?.endsWith('rebaseline-read-only.ts')) run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
