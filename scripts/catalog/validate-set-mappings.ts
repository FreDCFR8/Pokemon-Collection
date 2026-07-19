import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadPokemonTcgDataJson, type LocalPokemonCard } from './local-json.ts';
import { parseLocalCatalogManifestFromText, type LocalCatalogManifest } from './local-manifest.ts';
import { validateLocalDatasetCheckout } from './local-checkout.ts';
import { writeAtomicJson } from './checkpoint.ts';
import { reportHash, SETMAPPING_VALIDATION_SCHEMA_VERSION, type SetMappingCandidateInput, type SetMappingReasonCode, type SetMappingValidationResult } from './setmapping-validation.ts';

type Candidate = { set_code?: string; name?: string; series?: string; source?: string | null; source_id?: string | null };
type CandidateRecord = { setId: string; setName: string; series: string; expectedCards: number; candidate: Candidate };
type CatalogSet = { set_code: string; name: string | null; series: string | null; source: string | null; source_id: string | null };
type Reference = { id: string; source: string; external_id: string; card_catalog_id: string | null };

type ValidationRecord = CandidateRecord & {
  existingCatalogSet: CatalogSet | null;
  existingSource: string | null;
  existingSourceId: string | null;
  incomingCardCount: number;
  uniqueCardNumbers: number;
  overlappingUniqueCardNumbers: number;
  existingExternalCardReferences: number;
  conflictingExternalCardReferences: number;
  duplicateIncomingCardNumbers: number;
  validation: SetMappingValidationResult;
};

type ValidationReport = {
  schemaVersion: number;
  phase: 'Phase 7B-2F9D-A';
  mode: 'read-only';
  source: 'pokemon_tcg_data';
  datasetRepository: string;
  datasetVersion: string;
  manifestPath: string;
  sourceReportPath: string;
  candidateCount: number;
  databaseWritesTotal: 0;
  classifications: Record<string, number>;
  reasonCodes: Record<string, number>;
  reasonCodeExamples: Record<string, string[]>;
  operationalErrors: string[];
  architectureRecommendation: 'reuse_sets_catalog_columns_for_now' | 'introduce_set_external_references_later';
  architectureBasis: string[];
  candidates: ValidationRecord[];
  reportHash: string;
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Bronrapport bevat een ongeldig object.');
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Bronrapport mist ${label}.`);
  return value;
}

function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(`Bronrapport bevat een ongeldig ${label}.`);
  return value;
}

export function readExactCandidates(text: string): CandidateRecord[] {
  const root = object(JSON.parse(text));
  if (root.source !== 'pokemon_tcg_data') throw new Error('Bronrapport moet source pokemon_tcg_data gebruiken.');
  if (!Array.isArray(root.results)) throw new Error('Bronrapport mist results.');
  const candidates: CandidateRecord[] = [];
  for (const raw of root.results) {
    const result = object(raw);
    const diagnostic = object(result.diagnostic);
    if (diagnostic.setMappingStatus !== 'exact_candidate') continue;
    const mapping = object(diagnostic.setMapping);
    if (!Array.isArray(mapping.candidates) || mapping.candidates.length !== 1) throw new Error('exact_candidate zonder exact één kandidaat is geblokkeerd.');
    const candidate = object(mapping.candidates[0]);
    candidates.push({
      setId: string(result.setId, 'setId'),
      setName: string(diagnostic.setName, 'setName'),
      series: string(result.series ?? diagnostic.series ?? candidate.series ?? '', 'series'),
      expectedCards: number(result.expectedCards, 'expectedCards'),
      candidate: {
        set_code: string(candidate.set_code, 'candidate.set_code'),
        name: typeof candidate.name === 'string' ? candidate.name : undefined,
        series: typeof candidate.series === 'string' ? candidate.series : undefined,
        source: candidate.source === null || typeof candidate.source === 'string' ? candidate.source as string | null | undefined : undefined,
        source_id: candidate.source_id === null || typeof candidate.source_id === 'string' ? candidate.source_id as string | null | undefined : undefined,
      },
    });
  }
  return candidates.sort((a, b) => a.setId.localeCompare(b.setId));
}

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const response = await query;
  if (response.error) throw new Error(`Read-only Supabase-query mislukt (${label}): ${response.error.message}`);
  return response.data ?? [];
}

async function validateOne(supabase: SupabaseClient, candidate: CandidateRecord, inputRoot: string): Promise<ValidationRecord> {
  const setCode = candidate.candidate.set_code!;
  const manifestPath = resolve(inputRoot, `cards/en/${candidate.setId}.json`);
  const cards: LocalPokemonCard[] = loadPokemonTcgDataJson(manifestPath, candidate.setId).cards;
  const numbers = cards.map((card) => card.number.trim()).filter(Boolean);
  const uniqueNumbers = [...new Set(numbers)].sort();
  const catalogSets = await rows<CatalogSet>(supabase.from('sets_catalog').select('set_code,name,series,source,source_id').eq('set_code', setCode), 'sets_catalog');
  const existingCatalogSet = catalogSets.length === 1 ? catalogSets[0] : null;
  const catalogCards = await rows<{ number: string | null }>(supabase.from('cards_catalog').select('number').eq('set_code', setCode), 'cards_catalog');
  const catalogNumbers = new Set(catalogCards.map((card) => card.number?.trim()).filter((value): value is string => Boolean(value)));
  const references = await rows<Reference>(supabase.from('card_external_references').select('id,source,external_id,card_catalog_id').in('external_id', cards.map((card) => card.id)), 'card_external_references');
  const byExternalId = new Map<string, Reference[]>();
  for (const ref of references) byExternalId.set(ref.external_id, [...(byExternalId.get(ref.external_id) ?? []), ref]);
  const conflictCount = [...byExternalId.values()].filter((refs) => refs.length !== 1 || refs.some((ref) => !ref.card_catalog_id)).length;
  const input: SetMappingCandidateInput = {
    externalSetId: candidate.setId,
    externalSetName: candidate.setName,
    externalSeries: candidate.series,
    proposedSetCode: setCode,
    candidateSource: candidate.candidate.source,
    candidateSourceId: candidate.candidate.source_id,
    candidateCount: 1,
    catalogSet: existingCatalogSet,
    catalogSetRowCount: catalogSets.length,
    incomingCardCount: cards.length,
    uniqueIncomingCardNumbers: uniqueNumbers.length,
    overlappingUniqueCardNumbers: uniqueNumbers.filter((value) => catalogNumbers.has(value)).length,
    existingExternalCardReferences: references.length,
    conflictingExternalCardReferences: conflictCount,
    duplicateIncomingCardNumbers: numbers.length - uniqueNumbers.length,
  };
  const validation = validateSetMappingCandidate(input);
  return {
    ...candidate,
    existingCatalogSet,
    existingSource: existingCatalogSet?.source ?? null,
    existingSourceId: existingCatalogSet?.source_id ?? null,
    incomingCardCount: cards.length,
    uniqueCardNumbers: uniqueNumbers.length,
    overlappingUniqueCardNumbers: input.overlappingUniqueCardNumbers,
    existingExternalCardReferences: references.length,
    conflictingExternalCardReferences: conflictCount,
    duplicateIncomingCardNumbers: input.duplicateIncomingCardNumbers ?? 0,
    validation,
  };
}

function summarize(records: ValidationRecord[]): void {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.validation.classification, (counts.get(record.validation.classification) ?? 0) + 1);
  console.log('\nPhase 7B-2F9D-A read-only setmapping validation');
  console.log(`Candidates: ${records.length}`);
  for (const classification of ['safe_for_mapping_review', 'needs_manual_review', 'blocked']) console.log(`${classification}: ${counts.get(classification) ?? 0}`);
  console.log('Database writes: 0');
  const examples = new Map<string, string>();
  for (const record of records) for (const reason of record.validation.reasonCodes) if (!examples.has(reason)) examples.set(reason, record.setId);
  console.log('Reason-code examples:');
  for (const [reason, setId] of [...examples.entries()].sort()) console.log(`- ${reason}: ${setId}`);
}

export async function runValidation(params: { manifestPath: string; inputRoot: string; sourceReportPath: string; reportPath: string; supabase: SupabaseClient }): Promise<ValidationReport> {
  const manifest: LocalCatalogManifest = parseLocalCatalogManifestFromText(readFileSync(params.manifestPath, 'utf8'));
  const candidates = readExactCandidates(readFileSync(params.sourceReportPath, 'utf8'));
  const manifestSets = new Map(manifest.sets.map((set) => [set.setId, set]));
  if (candidates.some((candidate) => !manifestSets.has(candidate.setId))) throw new Error('Exact kandidaat ontbreekt in het gepinde manifest.');
  const records = [] as ValidationRecord[];
  for (const candidate of candidates) records.push(await validateOne(params.supabase, candidate, params.inputRoot));
  const classifications: Record<string, number> = {};
  const reasonCodes: Record<string, number> = {};
  for (const record of records) {
    classifications[record.validation.classification] = (classifications[record.validation.classification] ?? 0) + 1;
    for (const reason of record.validation.reasonCodes) reasonCodes[reason] = (reasonCodes[reason] ?? 0) + 1;
  }
  const reportWithoutHash = {
    schemaVersion: SETMAPPING_VALIDATION_SCHEMA_VERSION,
    phase: 'Phase 7B-2F9D-A' as const,
    mode: 'read-only' as const,
    source: 'pokemon_tcg_data' as const,
    datasetRepository: manifest.datasetRepository,
    datasetVersion: manifest.datasetVersion,
    manifestPath: relative(process.cwd(), resolve(params.manifestPath)).replaceAll('\\', '/'),
    sourceReportPath: relative(process.cwd(), resolve(params.sourceReportPath)).replaceAll('\\', '/'),
    candidateCount: records.length,
    databaseWritesTotal: 0 as const,
    classifications,
    reasonCodes,
    reasonCodeExamples: Object.fromEntries(Object.keys(reasonCodes).sort().map((reason) => [reason, records.filter((record) => record.validation.reasonCodes.includes(reason as SetMappingReasonCode)).map((record) => record.setId).sort().slice(0, 3)])),
    operationalErrors: [],
    architectureRecommendation: 'introduce_set_external_references_later' as const,
    architectureBasis: [
      'sets_catalog is canonical metadata and currently stores one source/source_id provenance pair per row.',
      'card_external_references already models multiple source identities without replacing internal card IDs.',
      'reusing sets_catalog.source/source_id for a second source would overwrite existing provenance and cannot represent parallel identities.',
    ],
    candidates: records,
  };
  return { ...reportWithoutHash, reportHash: reportHash(reportWithoutHash) };
}

function args(argv: readonly string[]): { manifestPath: string; inputRoot: string; sourceReportPath: string; reportPath: string } {
  if (argv.includes('--write') || argv.some((value) => value.startsWith('--write='))) throw new Error('Deze analyse ondersteunt geen --write.');
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!['--manifest', '--input-root', '--source-report', '--report'].includes(key)) throw new Error(`Onbekend argument: ${key}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`Ontbrekende waarde voor ${key}.`);
    values.set(key, value);
  }
  for (const key of ['--manifest', '--input-root', '--source-report', '--report']) if (!values.has(key)) throw new Error(`${key} is verplicht.`);
  return { manifestPath: values.get('--manifest')!, inputRoot: values.get('--input-root')!, sourceReportPath: values.get('--source-report')!, reportPath: values.get('--report')! };
}

async function main(): Promise<number> {
  try {
    const options = args(process.argv.slice(2));
    const manifest = parseLocalCatalogManifestFromText(readFileSync(options.manifestPath, 'utf8'));
    validateLocalDatasetCheckout(options.inputRoot, manifest.datasetVersion);
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist voor read-only databasevalidatie.');
    const report = await runValidation({ ...options, supabase: createClient(url, key) });
    writeAtomicJson(options.reportPath, report);
    summarize(report.candidates);
    return 0;
  } catch (error) {
    console.error(`Setmappingvalidatie geblokkeerd: ${error instanceof Error ? error.message : 'onbekende fout'}`);
    return 1;
  }
}

if (process.argv[1]?.endsWith('validate-set-mappings.ts')) main().then((code) => { process.exitCode = code; });
