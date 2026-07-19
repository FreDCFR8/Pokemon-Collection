import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadPokemonTcgDataJson, type LocalPokemonCard } from './local-json.ts';
import { parseLocalCatalogManifestFromText, type LocalCatalogManifest, type LocalCatalogManifestSet } from './local-manifest.ts';
import { validateLocalDatasetCheckout } from './local-checkout.ts';
import { writeAtomicJson } from './checkpoint.ts';
import { CARD_EXTERNAL_SOURCE, reportHash, SET_EXTERNAL_SOURCE, SETMAPPING_VALIDATION_SCHEMA_VERSION, validateSetMappingCandidate, type SetMappingCandidateInput, type SetMappingReasonCode, type SetMappingValidationResult } from './setmapping-validation.ts';

type Candidate = { set_code: string; name?: string; series?: string; source?: string | null; source_id?: string | null };
export type CandidateRecord = { setId: string; sourceReportSetName?: string; sourceReportExpectedCards?: number; sourceReportReceivedCards?: number; candidate: Candidate };
type CatalogSet = { set_code: string; name: string | null; series: string | null; source: string | null; source_id: string | null };
type Reference = { id: string; source: string; external_id: string; card_catalog_id: string | null };
type CatalogCard = { id: string; set_code: string | null; number: string | null };
type CardReferenceExample = { external_id: string; card_catalog_id: string | null; expected_number: string; actual_number?: string | null; actual_set_code?: string | null; reason: SetMappingReasonCode };

type ValidationRecord = {
  setId: string; manifestSetName: string; manifestSeries: string; manifestExpectedCards: number; manifestJsonPath: string;
  sourceReportSetName?: string; sourceReportExpectedCards?: number; sourceReportReceivedCards?: number;
  candidate: Candidate; existingCatalogSet: CatalogSet | null; sourceIdentityMatches: CatalogSet[]; receivedCards: number;
  incomingCardCount: number; uniqueCardNumbers: number; overlappingUniqueCardNumbers: number;
  existingExternalCardReferences: number; conflictingExternalCardReferences: number; duplicateIncomingCardNumbers: number;
  cardReferenceExamples: CardReferenceExample[]; validation: SetMappingValidationResult; operationalError?: string;
};

type ValidationReport = {
  schemaVersion: number; phase: 'Phase 7B-2F9D-A'; mode: 'read-only'; source: 'pokemon_tcg_data';
  datasetRepository: string; datasetVersion: string; manifestPath: string; sourceReportHash: string; candidateCount: number;
  status: 'PASS' | 'FAIL';
  databaseWritesTotal: 0; classifications: Record<string, number>; reasonCodes: Record<string, number>; reasonCodeExamples: Record<string, string[]>;
  operationalErrors: string[]; architectureRecommendation: 'introduce_set_external_references_later'; architectureBasis: string[];
  candidates: ValidationRecord[]; reportHash: string;
};

function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Bronrapport bevat een ongeldig object.'); return value as Record<string, unknown>; }
function requiredString(value: unknown, label: string): string { if (typeof value !== 'string' || value.trim() === '') throw new Error(`Bronrapport mist ${label}.`); return value; }
function optionalString(value: unknown): string | undefined { return typeof value === 'string' && value.trim() !== '' ? value : undefined; }
function optionalNonNegativeInteger(value: unknown): number | undefined { return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined; }

export function readExactCandidates(text: string): CandidateRecord[] {
  const root = object(JSON.parse(text));
  if (root.source !== 'pokemon_tcg_data' || !Array.isArray(root.results)) throw new Error('Bronrapport moet source pokemon_tcg_data en results bevatten.');
  const candidates: CandidateRecord[] = [];
  for (const raw of root.results) {
    const result = object(raw);
    const diagnostic = object(result.diagnostic);
    if (diagnostic.setMappingStatus !== 'exact_candidate') continue;
    const mapping = object(diagnostic.setMapping);
    if (!Array.isArray(mapping.candidates) || mapping.candidates.length !== 1) throw new Error('exact_candidate zonder exact één kandidaat is geblokkeerd.');
    const rawCandidate = object(mapping.candidates[0]);
    candidates.push({
      setId: requiredString(result.setId, 'setId'),
      sourceReportSetName: optionalString(diagnostic.setName),
      sourceReportExpectedCards: optionalNonNegativeInteger(result.expectedCards),
      sourceReportReceivedCards: optionalNonNegativeInteger(diagnostic.receivedCards),
      candidate: {
        set_code: requiredString(rawCandidate.set_code, 'candidate.set_code'),
        name: optionalString(rawCandidate.name), series: optionalString(rawCandidate.series),
        source: rawCandidate.source === null || typeof rawCandidate.source === 'string' ? rawCandidate.source as string | null | undefined : undefined,
        source_id: rawCandidate.source_id === null || typeof rawCandidate.source_id === 'string' ? rawCandidate.source_id as string | null | undefined : undefined,
      },
    });
  }
  return candidates.sort((a, b) => a.setId.localeCompare(b.setId));
}

function resolveManifestInputPath(inputRoot: string, jsonPath: string): string {
  if (isAbsolute(jsonPath) || jsonPath.split(/[\\/]+/).includes('..')) throw new Error(`Manifestpad ontsnapt buiten input-root: ${jsonPath}`);
  const root = resolve(inputRoot); const path = resolve(root, jsonPath); const escaped = relative(root, path);
  if (escaped === '..' || escaped.startsWith(`..${'\\'}`) || isAbsolute(escaped)) throw new Error(`Manifestpad ontsnapt buiten input-root: ${jsonPath}`);
  return path;
}

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const response = await query;
  if (response.error) throw new Error(`Read-only Supabase-query mislukt (${label}): ${response.error.message}`);
  return response.data ?? [];
}

function baseValidationRecord(manifestSet: LocalCatalogManifestSet, candidate: CandidateRecord, validation: SetMappingValidationResult, receivedCards = 0, operationalError?: string): ValidationRecord {
  return { setId: manifestSet.setId, manifestSetName: manifestSet.name, manifestSeries: manifestSet.series, manifestExpectedCards: manifestSet.expectedCards, manifestJsonPath: manifestSet.jsonPath, sourceReportSetName: candidate.sourceReportSetName, sourceReportExpectedCards: candidate.sourceReportExpectedCards, sourceReportReceivedCards: candidate.sourceReportReceivedCards, candidate: candidate.candidate, existingCatalogSet: null, sourceIdentityMatches: [], receivedCards, incomingCardCount: receivedCards, uniqueCardNumbers: 0, overlappingUniqueCardNumbers: 0, existingExternalCardReferences: 0, conflictingExternalCardReferences: 0, duplicateIncomingCardNumbers: 0, cardReferenceExamples: [], validation, ...(operationalError ? { operationalError } : {}) };
}

async function validateOne(supabase: SupabaseClient, manifestSet: LocalCatalogManifestSet, candidate: CandidateRecord, inputRoot: string, preflightReasonCodes: SetMappingReasonCode[] = []): Promise<ValidationRecord> {
  const cards: LocalPokemonCard[] = loadPokemonTcgDataJson(resolveManifestInputPath(inputRoot, manifestSet.jsonPath), manifestSet.setId).cards;
  const numbers = cards.map((card) => card.number.trim()).filter(Boolean); const uniqueNumbers = [...new Set(numbers)].sort(); const setCode = candidate.candidate.set_code;
  const proposedRows = await rows<CatalogSet>(supabase.from('sets_catalog').select('set_code,name,series,source,source_id').eq('set_code', setCode), 'sets_catalog proposed set');
  const sourceRows = await rows<CatalogSet>(supabase.from('sets_catalog').select('set_code,name,series,source,source_id').eq('source', SET_EXTERNAL_SOURCE).eq('source_id', manifestSet.setId), 'sets_catalog external set identity');
  const catalogCards = await rows<CatalogCard>(supabase.from('cards_catalog').select('id,set_code,number').eq('set_code', setCode), 'cards_catalog proposed set');
  const catalogNumbers = new Set(catalogCards.map((card) => card.number?.trim()).filter((value): value is string => Boolean(value)));
  const externalIds = cards.map((card) => card.id); const references = await rows<Reference>(supabase.from('card_external_references').select('id,source,external_id,card_catalog_id').eq('source', CARD_EXTERNAL_SOURCE).in('external_id', externalIds), 'card_external_references intended source');
  const linkedIds = [...new Set(references.map((ref) => ref.card_catalog_id).filter((id): id is string => Boolean(id)))];
  const linkedCards = linkedIds.length === 0 ? [] : await rows<CatalogCard>(supabase.from('cards_catalog').select('id,set_code,number').in('id', linkedIds), 'cards_catalog referenced cards');
  const cardsById = new Map(linkedCards.map((card) => [card.id, card])); const refsByExternalId = new Map<string, Reference[]>();
  for (const ref of references) refsByExternalId.set(ref.external_id, [...(refsByExternalId.get(ref.external_id) ?? []), ref]);
  const cardReferenceExamples: CardReferenceExample[] = []; let conflicts = 0;
  for (const [externalId, refs] of [...refsByExternalId.entries()].sort()) {
    const expected = cards.find((card) => card.id === externalId)!;
    if (refs.length > 1) { conflicts += 1; const linked = refs[0].card_catalog_id ? cardsById.get(refs[0].card_catalog_id) : undefined; cardReferenceExamples.push({ external_id: externalId, card_catalog_id: refs[0].card_catalog_id, expected_number: expected.number, actual_number: linked?.number, actual_set_code: linked?.set_code, reason: 'multiple_card_references' }); continue; }
    const ref = refs[0]; const linked = ref.card_catalog_id ? cardsById.get(ref.card_catalog_id) : undefined;
    if (!ref.card_catalog_id || !linked) { conflicts += 1; cardReferenceExamples.push({ external_id: externalId, card_catalog_id: ref.card_catalog_id, expected_number: expected.number, reason: 'dangling_card_reference' }); continue; }
    if (linked.set_code !== setCode) { conflicts += 1; cardReferenceExamples.push({ external_id: externalId, card_catalog_id: linked.id, expected_number: expected.number, actual_number: linked.number, actual_set_code: linked.set_code, reason: 'card_reference_wrong_set' }); continue; }
    if ((linked.number ?? '').trim() !== expected.number.trim()) { conflicts += 1; cardReferenceExamples.push({ external_id: externalId, card_catalog_id: linked.id, expected_number: expected.number, actual_number: linked.number, actual_set_code: linked.set_code, reason: 'card_reference_wrong_number' }); }
  }
  const existingCatalogSet = proposedRows.length === 1 ? proposedRows[0] : null;
  const proposedConflict = proposedRows.some((row) => row.source !== SET_EXTERNAL_SOURCE || row.source_id !== manifestSet.setId);
  const input: SetMappingCandidateInput = {
    externalSetId: manifestSet.setId, externalSetName: manifestSet.name, externalSeries: manifestSet.series, proposedSetCode: setCode,
    candidateSource: SET_EXTERNAL_SOURCE, candidateSourceId: manifestSet.setId, candidateCount: 1, catalogSet: existingCatalogSet, catalogSetRowCount: proposedRows.length,
    catalogSourceIdentityMatchCount: sourceRows.length, catalogSourceIdentityOtherSetCount: sourceRows.filter((row) => row.set_code !== setCode).length,
    proposedSetHasConflictingSourceIdentity: proposedConflict, missingExternalProvenance: proposedRows.length === 0 || proposedRows.some((row) => !row.source || !row.source_id),
    incomingCardCount: cards.length, uniqueIncomingCardNumbers: uniqueNumbers.length, overlappingUniqueCardNumbers: uniqueNumbers.filter((number) => catalogNumbers.has(number)).length,
    existingExternalCardReferences: references.length, conflictingExternalCardReferences: conflicts, duplicateIncomingCardNumbers: numbers.length - uniqueNumbers.length, preflightReasonCodes: [...preflightReasonCodes, ...cardReferenceExamples.map((example) => example.reason)],
  };
  const validation = validateSetMappingCandidate(input);
  return { ...baseValidationRecord(manifestSet, candidate, validation, cards.length), existingCatalogSet, sourceIdentityMatches: sourceRows, receivedCards: cards.length, incomingCardCount: cards.length, uniqueCardNumbers: uniqueNumbers.length, overlappingUniqueCardNumbers: input.overlappingUniqueCardNumbers, existingExternalCardReferences: references.length, conflictingExternalCardReferences: conflicts, duplicateIncomingCardNumbers: input.duplicateIncomingCardNumbers ?? 0, cardReferenceExamples };
}

function errorRecord(manifestSet: LocalCatalogManifestSet, candidate: CandidateRecord, reason: SetMappingReasonCode, error: string): ValidationRecord {
  return baseValidationRecord(manifestSet, candidate, validateSetMappingCandidate({ externalSetId: manifestSet.setId, externalSetName: manifestSet.name, externalSeries: manifestSet.series, proposedSetCode: candidate.candidate.set_code, candidateCount: 1, incomingCardCount: 0, uniqueIncomingCardNumbers: 0, overlappingUniqueCardNumbers: 0, existingExternalCardReferences: 0, conflictingExternalCardReferences: 0, preflightReasonCodes: [reason], readError: reason === 'database_read_error' }), 0, error);
}

export async function runValidation(params: { manifestPath: string; inputRoot: string; sourceReportPath: string; reportPath: string; supabase: SupabaseClient; expectedCandidateCount?: number }): Promise<ValidationReport> {
  const manifest: LocalCatalogManifest = parseLocalCatalogManifestFromText(readFileSync(params.manifestPath, 'utf8')); const sourceReportText = readFileSync(params.sourceReportPath, 'utf8'); const candidates = readExactCandidates(sourceReportText);
  const manifestSets = new Map(manifest.sets.map((set) => [set.setId, set])); const expectedCount = params.expectedCandidateCount ?? 44; if (candidates.length !== expectedCount) throw new Error(`Verwacht ${expectedCount} exact_candidate-sets, ontvangen ${candidates.length}.`);
  const records: ValidationRecord[] = []; const operationalErrors: string[] = [];
  for (const candidate of candidates) {
    const manifestSet = manifestSets.get(candidate.setId);
    if (!manifestSet) { const error = `Bronrapport set-ID ${candidate.setId} ontbreekt in het gepinde manifest.`; operationalErrors.push(error); records.push(errorRecord({ setId: candidate.setId, name: '', series: '', expectedCards: 0, jsonPath: '', enabled: true }, candidate, 'source_report_set_id_mismatch', error)); continue; }
    const preflight: SetMappingReasonCode[] = [];
    if (candidate.sourceReportSetName !== undefined && candidate.sourceReportSetName !== manifestSet.name) preflight.push('source_report_set_name_mismatch');
    if (candidate.sourceReportExpectedCards !== undefined && candidate.sourceReportExpectedCards !== manifestSet.expectedCards) preflight.push('source_report_expected_cards_mismatch');
    if (candidate.sourceReportReceivedCards !== undefined && candidate.sourceReportReceivedCards !== manifestSet.expectedCards) preflight.push('received_cards_mismatch');
    try {
      const record = await validateOne(params.supabase, manifestSet, candidate, params.inputRoot, preflight);
      if (record.receivedCards !== manifestSet.expectedCards) record.validation = validateSetMappingCandidate({ externalSetId: manifestSet.setId, externalSetName: manifestSet.name, externalSeries: manifestSet.series, proposedSetCode: candidate.candidate.set_code, candidateCount: 1, catalogSet: record.existingCatalogSet, catalogSetRowCount: record.existingCatalogSet ? 1 : 0, catalogSourceIdentityMatchCount: record.sourceIdentityMatches.length, catalogSourceIdentityOtherSetCount: record.sourceIdentityMatches.filter((row) => row.set_code !== candidate.candidate.set_code).length, incomingCardCount: record.incomingCardCount, uniqueIncomingCardNumbers: record.uniqueCardNumbers, overlappingUniqueCardNumbers: record.overlappingUniqueCardNumbers, existingExternalCardReferences: record.existingExternalCardReferences, conflictingExternalCardReferences: record.conflictingExternalCardReferences, duplicateIncomingCardNumbers: record.duplicateIncomingCardNumbers, preflightReasonCodes: [...preflight, 'received_cards_mismatch', ...record.cardReferenceExamples.map((example) => example.reason)] });
      records.push(record);
    } catch (error) { const message = error instanceof Error ? error.message : 'Onbekende operationele validatiefout.'; const stableMessage = message.split(resolve(params.inputRoot)).join('<input-root>'); operationalErrors.push(`${candidate.setId}: ${stableMessage}`); records.push(errorRecord(manifestSet, candidate, 'database_read_error', stableMessage)); }
  }
  const classifications: Record<string, number> = {}; const reasonCodes: Record<string, number> = {};
  for (const record of records) { classifications[record.validation.classification] = (classifications[record.validation.classification] ?? 0) + 1; for (const reason of record.validation.reasonCodes) reasonCodes[reason] = (reasonCodes[reason] ?? 0) + 1; }
  const reportWithoutHash = { schemaVersion: SETMAPPING_VALIDATION_SCHEMA_VERSION, phase: 'Phase 7B-2F9D-A' as const, mode: 'read-only' as const, source: 'pokemon_tcg_data' as const, datasetRepository: manifest.datasetRepository, datasetVersion: manifest.datasetVersion, manifestPath: 'config/catalog/local-pokemon-tcg-data-manifest.json', sourceReportHash: createHash('sha256').update(sourceReportText).digest('hex'), candidateCount: records.length, status: operationalErrors.length === 0 ? 'PASS' as const : 'FAIL' as const, databaseWritesTotal: 0 as const, classifications, reasonCodes, reasonCodeExamples: Object.fromEntries(Object.keys(reasonCodes).sort().map((reason) => [reason, records.filter((record) => record.validation.reasonCodes.includes(reason as SetMappingReasonCode)).map((record) => record.setId).sort().slice(0, 3)])), operationalErrors: operationalErrors.sort(), architectureRecommendation: 'introduce_set_external_references_later' as const, architectureBasis: ['sets_catalog is canonical metadata and currently stores one source/source_id provenance pair per row.', 'card_external_references already models multiple source identities without replacing internal card IDs.', 'reusing sets_catalog.source/source_id for parallel sources would overwrite provenance and cannot represent both identities.'], candidates: records };
  return { ...reportWithoutHash, reportHash: reportHash(reportWithoutHash) };
}

function parseArgs(argv: readonly string[]): { manifestPath: string; inputRoot: string; sourceReportPath: string; reportPath: string } {
  if (argv.includes('--write') || argv.some((value) => value.startsWith('--write='))) throw new Error('Deze analyse ondersteunt geen --write.'); const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) { const key = argv[index]; const value = argv[index + 1]; if (!['--manifest', '--input-root', '--source-report', '--report'].includes(key) || !value || value.startsWith('--')) throw new Error(`Ongeldige argumenten rond ${key}.`); values.set(key, value); }
  for (const key of ['--manifest', '--input-root', '--source-report', '--report']) if (!values.has(key)) throw new Error(`${key} is verplicht.`);
  return { manifestPath: values.get('--manifest')!, inputRoot: values.get('--input-root')!, sourceReportPath: values.get('--source-report')!, reportPath: values.get('--report')! };
}

function reportPathFromArgs(argv: readonly string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--report' && argv[index + 1] && !argv[index + 1].startsWith('--')) return argv[index + 1];
    if (argv[index].startsWith('--report=') && argv[index].slice('--report='.length)) return argv[index].slice('--report='.length);
  }
  return undefined;
}

function sanitizeOperationalError(message: string, env: NodeJS.ProcessEnv): string {
  let sanitized = message;
  for (const value of [env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY].filter((value): value is string => Boolean(value))) sanitized = sanitized.split(value).join('[REDACTED]');
  return sanitized.replace(/(?:[A-Za-z]:)?[\\/][^\s]+/g, '[REDACTED_PATH]').replace(/(api[_-]?key|token|secret|password)=([^\s]+)/gi, '$1=[REDACTED]');
}

function preflightFailureReport(message: string, manifest: LocalCatalogManifest | undefined, env: NodeJS.ProcessEnv): ValidationReport {
  const base = { schemaVersion: SETMAPPING_VALIDATION_SCHEMA_VERSION, phase: 'Phase 7B-2F9D-A' as const, mode: 'read-only' as const, source: 'pokemon_tcg_data' as const, ...(manifest ? { datasetRepository: manifest.datasetRepository, datasetVersion: manifest.datasetVersion } : {}), manifestPath: 'config/catalog/local-pokemon-tcg-data-manifest.json', sourceReportHash: '', candidateCount: 0, status: 'FAIL' as const, databaseWritesTotal: 0 as const, classifications: {}, reasonCodes: {}, reasonCodeExamples: {}, operationalErrors: [sanitizeOperationalError(message, env)], architectureRecommendation: 'introduce_set_external_references_later' as const, architectureBasis: [], candidates: [] };
  return { ...base, reportHash: reportHash(base) } as ValidationReport;
}

function summarize(report: ValidationReport): void { console.log('\nPhase 7B-2F9D-A read-only setmapping validation'); console.log(`Candidates: ${report.candidateCount}`); for (const classification of ['safe_for_mapping_review', 'needs_manual_review', 'blocked']) console.log(`${classification}: ${report.classifications[classification] ?? 0}`); console.log(`Operational errors: ${report.operationalErrors.length}`); console.log(`Result: ${report.status}`); console.log('Database writes: 0'); console.log('Reason-code examples:'); for (const [reason, examples] of Object.entries(report.reasonCodeExamples).sort()) console.log(`- ${reason}: ${examples.join(', ')}`); }

type CliDependencies = {
  createSupabaseClient?: (url: string, key: string) => SupabaseClient;
  validateCheckout?: (inputRoot: string, datasetVersion: string) => void;
  runValidation?: (params: { manifestPath: string; inputRoot: string; sourceReportPath: string; reportPath: string; supabase: SupabaseClient }) => Promise<ValidationReport>;
  writeReport?: (path: string, report: ValidationReport) => void;
};

export async function runCli(argv: readonly string[], env: NodeJS.ProcessEnv = process.env, dependencies: CliDependencies = {}): Promise<number> {
  const reportPath = reportPathFromArgs(argv); let manifest: LocalCatalogManifest | undefined;
  try {
    const options = parseArgs(argv); manifest = parseLocalCatalogManifestFromText(readFileSync(options.manifestPath, 'utf8')); (dependencies.validateCheckout ?? validateLocalDatasetCheckout)(options.inputRoot, manifest.datasetVersion);
    const url = env.SUPABASE_URL; const key = env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist voor read-only databasevalidatie.');
    const report = await (dependencies.runValidation ?? runValidation)({ ...options, supabase: (dependencies.createSupabaseClient ?? createClient)(url, key) }); (dependencies.writeReport ?? writeAtomicJson)(options.reportPath, report); summarize(report); return report.status === 'PASS' ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende operationele validatiefout.'; const failure = preflightFailureReport(message, manifest, env);
    if (reportPath) { try { (dependencies.writeReport ?? writeAtomicJson)(reportPath, failure); } catch (writeError) { console.error(`FAIL-rapport kon niet worden geschreven: ${writeError instanceof Error ? sanitizeOperationalError(writeError.message, env) : 'onbekende schrijffout'}`); } }
    console.error(`Setmappingvalidatie geblokkeerd: ${sanitizeOperationalError(message, env)}`); return 1;
  }
}
async function main(): Promise<number> { return runCli(process.argv.slice(2)); }
if (process.argv[1]?.endsWith('validate-set-mappings.ts')) main().then((code) => { process.exitCode = code; });
