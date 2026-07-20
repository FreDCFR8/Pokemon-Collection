import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { PINNED_DATASET_VERSION, validateLocalDatasetCheckout } from './local-checkout.ts';
import { reportHash } from './catalog-report-identity.ts';
import { parseManifest, parseSourceSets } from './catalog-quality-audit.ts';

const MANIFEST_PATH = 'config/catalog/local-pokemon-tcg-data-manifest.json';
const SOURCE_SETS_PATH = 'sets/en.json';
const SOURCE = 'pokemon_tcg_api';

type ManifestSet = { setId: string; expectedCards: number; enabled: boolean };
type SourceSet = { setCode: string; name: string; series: string; printedTotal: number; total: number; releaseDate: string; symbolUrl: string; logoUrl: string };
type DatabaseSet = {
  id: string; set_code: string; name: string; source: string | null; source_id: string | null;
  series: string | null; release_date: string | null; printed_total: number | null; total: number | null;
  symbol_url: string | null; logo_url: string | null;
};
type MetadataFields = Pick<SourceSet, 'series' | 'releaseDate' | 'printedTotal' | 'total' | 'symbolUrl' | 'logoUrl'>;

function normalized(value: string | null | undefined): string { return (value ?? '').trim(); }
function normalizedDate(value: string | null | undefined): string { return normalized(value).replaceAll('/', '-'); }

export type MetadataPlanRow = {
  setCatalogId: string;
  databaseSetCode: string;
  sourceSetCode: string | null;
  identity: 'exact_set_code' | 'exact_legacy_source_id' | 'blocked';
  action: 'update_metadata' | 'already_exact' | 'blocked';
  changedFields: Partial<MetadataFields>;
  blockReason: 'missing_source_set' | 'name_conflict' | 'unmapped_legacy_set' | null;
};

function metadataChanges(source: SourceSet, database: DatabaseSet): Partial<MetadataFields> {
  const changes: Partial<MetadataFields> = {};
  if (normalized(database.series) !== source.series) changes.series = source.series;
  if (normalizedDate(database.release_date) !== normalizedDate(source.releaseDate)) changes.releaseDate = source.releaseDate;
  if (database.printed_total !== source.printedTotal) changes.printedTotal = source.printedTotal;
  if (database.total !== source.total) changes.total = source.total;
  if (normalized(database.symbol_url) !== source.symbolUrl) changes.symbolUrl = source.symbolUrl;
  if (normalized(database.logo_url) !== source.logoUrl) changes.logoUrl = source.logoUrl;
  return changes;
}

export function buildMetadataDryRunPlan(manifestSets: ManifestSet[], sourceSets: Map<string, SourceSet>, databaseSets: DatabaseSet[]): MetadataPlanRow[] {
  const expectedCodes = new Set(manifestSets.map((set) => set.setId));
  return databaseSets.map((database) => {
    const sourceSetCode = expectedCodes.has(database.set_code) ? database.set_code
      : database.source === SOURCE && database.source_id && expectedCodes.has(database.source_id) ? database.source_id
        : null;
    const identity = sourceSetCode === database.set_code ? 'exact_set_code'
      : sourceSetCode ? 'exact_legacy_source_id' : 'blocked';
    const source = sourceSetCode ? sourceSets.get(sourceSetCode) : null;
    if (!source) return {
      setCatalogId: database.id, databaseSetCode: database.set_code, sourceSetCode: null, identity, action: 'blocked', changedFields: {},
      blockReason: sourceSetCode ? 'missing_source_set' : 'unmapped_legacy_set',
    };
    if (database.name !== source.name) return {
      setCatalogId: database.id, databaseSetCode: database.set_code, sourceSetCode, identity, action: 'blocked', changedFields: {}, blockReason: 'name_conflict',
    };
    const changedFields = metadataChanges(source, database);
    return {
      setCatalogId: database.id, databaseSetCode: database.set_code, sourceSetCode, identity,
      action: Object.keys(changedFields).length === 0 ? 'already_exact' : 'update_metadata', changedFields, blockReason: null,
    };
  }).sort((left, right) => left.databaseSetCode.localeCompare(right.databaseSetCode));
}

function parseArgs(argv: string[]) {
  if (argv.length !== 4 || argv[0] !== '--input-root' || argv[2] !== '--report' || !argv[1] || !argv[3]) {
    throw new Error('Gebruik uitsluitend --input-root <dataset> --report <nieuw rapport>. Dit is uitsluitend een metadata dry-run.');
  }
  return { inputRoot: resolve(argv[1]), reportPath: resolve(argv[3]) };
}

async function exactCount(client: ReturnType<typeof createClient>, table: 'sets_catalog' | 'cards_catalog' | 'collection_cards') {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true });
  if (error || count === null) throw new Error(`${table}: count-read mislukt.`);
  return count;
}

async function main(): Promise<void> {
  const { inputRoot, reportPath } = parseArgs(process.argv.slice(2));
  if (existsSync(reportPath)) throw new Error(`Rapport bestaat al: ${reportPath}`);
  validateLocalDatasetCheckout(inputRoot, PINNED_DATASET_VERSION);
  const manifestSets = parseManifest(JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))) as ManifestSet[];
  const sourceSets = parseSourceSets(JSON.parse(readFileSync(join(inputRoot, SOURCE_SETS_PATH), 'utf8')), manifestSets) as Map<string, SourceSet>;
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  const client = createClient(url, key);
  const before = { setsCatalog: await exactCount(client, 'sets_catalog'), cardsCatalog: await exactCount(client, 'cards_catalog'), collectionCards: await exactCount(client, 'collection_cards') };
  const { data, error } = await client.from('sets_catalog').select('id,set_code,name,source,source_id,series,release_date,printed_total,total,symbol_url,logo_url').order('set_code');
  if (error || !data) throw new Error('sets_catalog-read mislukt.');
  const plan = buildMetadataDryRunPlan(manifestSets, sourceSets, data as DatabaseSet[]);
  const after = { setsCatalog: await exactCount(client, 'sets_catalog'), cardsCatalog: await exactCount(client, 'cards_catalog'), collectionCards: await exactCount(client, 'collection_cards') };
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Dry-run abort: database veranderde tijdens de meting.');
  const updates = plan.filter((entry) => entry.action === 'update_metadata');
  const blockers = plan.filter((entry) => entry.action === 'blocked');
  const report = {
    schemaVersion: 1, phase: 'Catalog set metadata dry-run', mode: 'read-only', runnerStatus: 'PASS',
    status: updates.length === 0 && blockers.length === 0 ? 'CLEAN' : 'REVIEW_REQUIRED', datasetVersion: PINNED_DATASET_VERSION,
    databaseWritesTotal: 0, databaseCounts: { before, after }, summary: {
      existingSetRows: plan.length, plannedMetadataUpdates: updates.length, alreadyExact: plan.filter((entry) => entry.action === 'already_exact').length,
      blockedRows: blockers.length, exactLegacySourceIdRows: plan.filter((entry) => entry.identity === 'exact_legacy_source_id').length,
    }, plan, reportHash: '',
  };
  report.reportHash = reportHash(report);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Catalog set metadata dry-run: ${report.status}; plannedUpdates=${updates.length}; blocked=${blockers.length}; databaseWritesTotal=0; reportHash=${report.reportHash}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Catalog set metadata dry-run failed.'); process.exitCode = 1; });
}
