import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { PINNED_DATASET_VERSION, POKEMON_TCG_DATA_REPOSITORY, validateLocalDatasetCheckout } from './local-checkout.ts';
import { reportHash } from './catalog-report-identity.ts';

const MANIFEST_PATH = 'config/catalog/local-pokemon-tcg-data-manifest.json';
const SOURCE_SETS_PATH = 'sets/en.json';
const EXPECTED_SET_COUNT = 173;
const EXPECTED_CARD_COUNT = 20_324;
const PAGE_SIZE = 500;

type ManifestSet = { setId: string; expectedCards: number; enabled: boolean };
type Manifest = { datasetRepository?: string; datasetVersion?: string; sets?: ManifestSet[] };
type SourceSetInput = {
  id?: unknown; name?: unknown; series?: unknown; printedTotal?: unknown; total?: unknown;
  releaseDate?: unknown; images?: { symbol?: unknown; logo?: unknown } | null;
};
type SourceSet = {
  setCode: string; name: string; series: string; printedTotal: number; total: number;
  releaseDate: string; symbolUrl: string; logoUrl: string;
};
type DatabaseSet = {
  id: string; set_code: string; name: string; series: string | null; release_date: string | null;
  printed_total: number | null; total: number | null; symbol_url: string | null; logo_url: string | null;
};
type DatabaseCard = { id: string; set_code: string; number: string; pokemon: string; card_details: unknown };

export type QualityIssue =
  | 'missing_set_row' | 'missing_series' | 'missing_release_date' | 'missing_printed_total'
  | 'missing_total' | 'missing_symbol_url' | 'missing_logo_url' | 'set_metadata_conflict'
  | 'card_count_mismatch' | 'missing_card_details' | 'duplicate_logical_card';

export type SetQualityResult = {
  setCode: string;
  expectedCards: number;
  catalogCards: number;
  missingCardDetails: number;
  duplicateLogicalCards: number;
  duplicateRows: number;
  issues: QualityIssue[];
  source: SourceSet;
  database: DatabaseSet | null;
};

function isNonBlankString(value: unknown): value is string { return typeof value === 'string' && value.trim() !== ''; }
function isNonNegativeInteger(value: unknown): value is number { return Number.isInteger(value) && (value as number) >= 0; }
function normalized(value: string | null | undefined): string { return (value ?? '').trim(); }
function emptyDetails(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0);
}

export function parseManifest(value: unknown): ManifestSet[] {
  const manifest = value as Manifest;
  if (manifest.datasetRepository !== POKEMON_TCG_DATA_REPOSITORY || manifest.datasetVersion !== PINNED_DATASET_VERSION || !Array.isArray(manifest.sets)) {
    throw new Error('Manifestidentiteit is ongeldig.');
  }
  if (manifest.sets.length !== EXPECTED_SET_COUNT) throw new Error(`Manifest bevat niet exact ${EXPECTED_SET_COUNT} sets.`);
  const sets = manifest.sets.map((entry) => {
    if (!entry.enabled || !isNonBlankString(entry.setId) || !isNonNegativeInteger(entry.expectedCards)) throw new Error('Manifest bevat een ongeldige enabled set.');
    return { setId: entry.setId, expectedCards: entry.expectedCards, enabled: entry.enabled };
  });
  if (new Set(sets.map((set) => set.setId)).size !== EXPECTED_SET_COUNT || sets.reduce((sum, set) => sum + set.expectedCards, 0) !== EXPECTED_CARD_COUNT) {
    throw new Error('Manifestprofiel wijkt af van de gepinde dataset.');
  }
  return sets.sort((left, right) => left.setId.localeCompare(right.setId));
}

export function parseSourceSets(value: unknown, manifestSets: ManifestSet[]): Map<string, SourceSet> {
  if (!Array.isArray(value)) throw new Error('Lokale sets/en.json heeft geen geldige lijst.');
  const expected = new Set(manifestSets.map((set) => set.setId));
  const parsed = new Map<string, SourceSet>();
  for (const raw of value as SourceSetInput[]) {
    if (!isNonBlankString(raw.id) || !expected.has(raw.id)) continue;
    if (!isNonBlankString(raw.name) || !isNonBlankString(raw.series) || !isNonNegativeInteger(raw.printedTotal)
      || !isNonNegativeInteger(raw.total) || !isNonBlankString(raw.releaseDate)
      || !isNonBlankString(raw.images?.symbol) || !isNonBlankString(raw.images?.logo)) {
      throw new Error(`${raw.id}: lokale setmetadata is onvolledig.`);
    }
    if (parsed.has(raw.id)) throw new Error(`${raw.id}: dubbele lokale setmetadata.`);
    parsed.set(raw.id, {
      setCode: raw.id, name: raw.name, series: raw.series, printedTotal: raw.printedTotal,
      total: raw.total, releaseDate: raw.releaseDate, symbolUrl: raw.images.symbol, logoUrl: raw.images.logo,
    });
  }
  if (parsed.size !== EXPECTED_SET_COUNT || [...expected].some((setCode) => !parsed.has(setCode))) {
    throw new Error('Lokale sets/en.json komt niet exact overeen met het 173-setmanifest.');
  }
  return parsed;
}

function sameSetMetadata(source: SourceSet, database: DatabaseSet): boolean {
  return database.name === source.name && normalized(database.series) === source.series
    && database.release_date === source.releaseDate && database.printed_total === source.printedTotal
    && database.total === source.total && normalized(database.symbol_url) === source.symbolUrl
    && normalized(database.logo_url) === source.logoUrl;
}

export function buildQualityResults(manifestSets: ManifestSet[], sourceSets: Map<string, SourceSet>, databaseSets: DatabaseSet[], databaseCards: DatabaseCard[]): SetQualityResult[] {
  const setsByCode = new Map(databaseSets.map((set) => [set.set_code, set]));
  const cardsBySet = new Map<string, DatabaseCard[]>();
  for (const card of databaseCards) {
    const cards = cardsBySet.get(card.set_code) ?? [];
    cards.push(card);
    cardsBySet.set(card.set_code, cards);
  }
  return manifestSets.map((manifestSet) => {
    const source = sourceSets.get(manifestSet.setId);
    if (!source) throw new Error(`${manifestSet.setId}: bronmetadata ontbreekt.`);
    const database = setsByCode.get(manifestSet.setId) ?? null;
    const cards = cardsBySet.get(manifestSet.setId) ?? [];
    const grouped = new Map<string, DatabaseCard[]>();
    for (const card of cards) {
      const key = `${card.number}\u0000${card.pokemon}`;
      const group = grouped.get(key) ?? [];
      group.push(card);
      grouped.set(key, group);
    }
    const duplicateGroups = [...grouped.values()].filter((group) => group.length > 1);
    const issues: QualityIssue[] = [];
    if (!database) issues.push('missing_set_row');
    else {
      if (!isNonBlankString(database.series)) issues.push('missing_series');
      if (!isNonBlankString(database.release_date)) issues.push('missing_release_date');
      if (!isNonNegativeInteger(database.printed_total)) issues.push('missing_printed_total');
      if (!isNonNegativeInteger(database.total)) issues.push('missing_total');
      if (!isNonBlankString(database.symbol_url)) issues.push('missing_symbol_url');
      if (!isNonBlankString(database.logo_url)) issues.push('missing_logo_url');
      if (sameSetMetadata(source, database) === false) issues.push('set_metadata_conflict');
    }
    if (cards.length !== manifestSet.expectedCards) issues.push('card_count_mismatch');
    const missingCardDetails = cards.filter((card) => emptyDetails(card.card_details)).length;
    if (missingCardDetails > 0) issues.push('missing_card_details');
    if (duplicateGroups.length > 0) issues.push('duplicate_logical_card');
    return {
      setCode: manifestSet.setId, expectedCards: manifestSet.expectedCards, catalogCards: cards.length,
      missingCardDetails, duplicateLogicalCards: duplicateGroups.length,
      duplicateRows: duplicateGroups.reduce((sum, group) => sum + group.length, 0),
      issues, source, database,
    };
  });
}

function parseArgs(argv: string[]) {
  if (argv.length !== 4 || argv[0] !== '--input-root' || argv[2] !== '--report' || !argv[1] || !argv[3]) {
    throw new Error('Gebruik uitsluitend --input-root <dataset> --report <nieuw rapport>. Deze audit is read-only.');
  }
  return { inputRoot: resolve(argv[1]), reportPath: resolve(argv[3]) };
}

async function exactCount(client: ReturnType<typeof createClient>, table: 'sets_catalog' | 'cards_catalog'): Promise<number> {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true });
  if (error || count === null) throw new Error(`${table}: count-read mislukt.`);
  return count;
}

async function readAllCards(client: ReturnType<typeof createClient>): Promise<DatabaseCard[]> {
  const cards: DatabaseCard[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client.from('cards_catalog').select('id,set_code,number,pokemon,card_details').order('id').range(from, from + PAGE_SIZE - 1);
    if (error || !data) throw new Error('cards_catalog-read mislukt.');
    cards.push(...data as DatabaseCard[]);
    if (data.length < PAGE_SIZE) return cards;
  }
}

async function main(): Promise<void> {
  const { inputRoot, reportPath } = parseArgs(process.argv.slice(2));
  if (existsSync(reportPath)) throw new Error(`Rapport bestaat al: ${reportPath}`);
  validateLocalDatasetCheckout(inputRoot, PINNED_DATASET_VERSION);
  const manifestSets = parseManifest(JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')));
  const sourceSets = parseSourceSets(JSON.parse(readFileSync(join(inputRoot, SOURCE_SETS_PATH), 'utf8')), manifestSets);
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  const client = createClient(url, key);
  const before = { setsCatalog: await exactCount(client, 'sets_catalog'), cardsCatalog: await exactCount(client, 'cards_catalog') };
  const [{ data: rawSets, error: setsError }, cards] = await Promise.all([
    client.from('sets_catalog').select('id,set_code,name,series,release_date,printed_total,total,symbol_url,logo_url').order('set_code'),
    readAllCards(client),
  ]);
  if (setsError || !rawSets) throw new Error('sets_catalog-read mislukt.');
  const results = buildQualityResults(manifestSets, sourceSets, rawSets as DatabaseSet[], cards);
  const after = { setsCatalog: await exactCount(client, 'sets_catalog'), cardsCatalog: await exactCount(client, 'cards_catalog') };
  if (before.setsCatalog !== after.setsCatalog || before.cardsCatalog !== after.cardsCatalog) throw new Error('Audit abort: database veranderde tijdens de read-only meting.');
  const issueSets = results.filter((result) => result.issues.length > 0);
  const report = {
    schemaVersion: 1, phase: 'Catalog data quality audit', mode: 'read-only', runnerStatus: 'PASS',
    status: issueSets.length === 0 ? 'CLEAN' : 'ACTION_REQUIRED', dataset: {
      repository: POKEMON_TCG_DATA_REPOSITORY, version: PINNED_DATASET_VERSION, expectedSets: EXPECTED_SET_COUNT, expectedCards: EXPECTED_CARD_COUNT,
    }, databaseWritesTotal: 0, databaseCounts: { before, after }, summary: {
      setsWithIssues: issueSets.length, missingSetRows: results.filter((result) => result.issues.includes('missing_set_row')).length,
      missingSeries: results.filter((result) => result.issues.includes('missing_series')).length,
      missingReleaseDates: results.filter((result) => result.issues.includes('missing_release_date')).length,
      missingPrintedTotals: results.filter((result) => result.issues.includes('missing_printed_total')).length,
      missingTotals: results.filter((result) => result.issues.includes('missing_total')).length,
      missingSymbols: results.filter((result) => result.issues.includes('missing_symbol_url')).length,
      missingLogos: results.filter((result) => result.issues.includes('missing_logo_url')).length,
      metadataConflicts: results.filter((result) => result.issues.includes('set_metadata_conflict')).length,
      cardCountMismatches: results.filter((result) => result.issues.includes('card_count_mismatch')).length,
      missingCardDetails: results.reduce((sum, result) => sum + result.missingCardDetails, 0),
      duplicateLogicalCards: results.reduce((sum, result) => sum + result.duplicateLogicalCards, 0),
      duplicateRows: results.reduce((sum, result) => sum + result.duplicateRows, 0),
    }, results, reportHash: '',
  };
  report.reportHash = reportHash(report);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Catalog quality audit: ${report.status}; sets=${EXPECTED_SET_COUNT}; databaseWritesTotal=0; reportHash=${report.reportHash}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Catalog quality audit failed.'); process.exitCode = 1; });
}
