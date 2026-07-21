import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { loadPokemonTcgDataJson } from './local-json.ts';
import { PINNED_DATASET_VERSION, validateLocalDatasetCheckout } from './local-checkout.ts';
import { reportHash } from './catalog-report-identity.ts';
import { parseManifest } from './catalog-quality-audit.ts';

const APPROVAL = 'recover-11-svp-null-set-codes';
const APPROVED_REPORT_HASH = '8ba60f79b218692757a8af4d6b7b82279c97ea7a4eaa9964edfc0f94568fd068';
const TARGET_SET_CODE = 'svp';
const TARGET_SET_NAME = 'Scarlet & Violet Black Star Promos';
const EXPECTED_CANDIDATES = 11;

type Mode = 'dry-run' | 'write' | 'idempotency';
type Candidate = {
  cardCatalogId: string;
  externalId: string;
  number: string;
  pokemon: string;
  currentSetName: string;
  expectedSetName: string;
  mismatches: unknown[];
  classification: string;
};
type ApprovedReport = {
  phase?: string;
  mode?: string;
  datasetVersion?: string;
  databaseWritesTotal?: number;
  status?: string;
  summary?: { exactRecoveryCandidates?: number; metadataConflicts?: number };
  candidates?: Candidate[];
  reportHash?: string;
};
type CatalogCard = {
  id: string;
  external_id: string | null;
  pokemon: string;
  set_name: string | null;
  set_code: string | null;
  number: string;
  rarity: string | null;
  image_small: string | null;
  image_large: string | null;
};
type ExternalReference = { card_catalog_id: string; source: string; external_id: string };

function parseArgs(values: string[]) {
  if (
    values.length !== 10 ||
    values[0] !== '--mode' ||
    !['dry-run', 'write', 'idempotency'].includes(values[1]) ||
    values[2] !== '--input-root' ||
    values[4] !== '--approved-report' ||
    values[6] !== '--confirm-write' ||
    values[7] !== APPROVAL ||
    values[8] !== '--report'
  ) {
    throw new Error(
      `Gebruik --mode <dry-run|write|idempotency> --input-root <dataset> --approved-report <rapport> --confirm-write ${APPROVAL} --report <nieuw rapport>.`,
    );
  }
  return {
    mode: values[1] as Mode,
    inputRoot: resolve(values[3]),
    approvedReport: resolve(values[5]),
    reportPath: resolve(values[9]),
  };
}

function parseApprovedReport(path: string): ApprovedReport {
  const report = JSON.parse(readFileSync(path, 'utf8')) as ApprovedReport;
  if (
    report.reportHash !== APPROVED_REPORT_HASH ||
    report.reportHash !== reportHash(report) ||
    report.phase !== 'SVP null set-code recovery analysis' ||
    report.mode !== 'read-only' ||
    report.datasetVersion !== PINNED_DATASET_VERSION ||
    report.databaseWritesTotal !== 0 ||
    report.status !== 'ACTION_REQUIRED' ||
    report.summary?.exactRecoveryCandidates !== EXPECTED_CANDIDATES ||
    report.summary?.metadataConflicts !== 0 ||
    !Array.isArray(report.candidates) ||
    report.candidates.length !== EXPECTED_CANDIDATES
  ) {
    throw new Error('Goedgekeurd SVP-analyserapport is ongeldig of wijkt af.');
  }

  const ids = new Set<string>();
  const externalIds = new Set<string>();
  for (const candidate of report.candidates) {
    if (
      !candidate.cardCatalogId ||
      !candidate.externalId ||
      candidate.currentSetName !== TARGET_SET_NAME ||
      candidate.expectedSetName !== TARGET_SET_NAME ||
      candidate.classification !== 'exact_recovery_candidate' ||
      !Array.isArray(candidate.mismatches) ||
      candidate.mismatches.length !== 0 ||
      ids.has(candidate.cardCatalogId) ||
      externalIds.has(candidate.externalId)
    ) {
      throw new Error('Goedgekeurd SVP-rapport bevat een ongeldige of dubbele kandidaat.');
    }
    ids.add(candidate.cardCatalogId);
    externalIds.add(candidate.externalId);
  }
  return report;
}

async function exactCount(
  client: ReturnType<typeof createClient>,
  table: 'cards_catalog' | 'collection_cards' | 'card_external_references',
  filter?: (query: any) => any,
): Promise<number> {
  let query = client.from(table).select('id', { count: 'exact', head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error || count === null) throw new Error(`${table}: count-read mislukt.`);
  return count;
}

async function databaseSnapshot(client: ReturnType<typeof createClient>) {
  return {
    cardsCatalog: await exactCount(client, 'cards_catalog'),
    nullSetCodeCards: await exactCount(client, 'cards_catalog', (query) => query.is('set_code', null)),
    svpCards: await exactCount(client, 'cards_catalog', (query) => query.eq('set_code', TARGET_SET_CODE)),
    collectionCards: await exactCount(client, 'collection_cards'),
    cardExternalReferences: await exactCount(client, 'card_external_references'),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (existsSync(options.reportPath)) throw new Error(`Rapport bestaat al: ${options.reportPath}`);

  validateLocalDatasetCheckout(options.inputRoot, PINNED_DATASET_VERSION);
  const approved = parseApprovedReport(options.approvedReport);
  const manifest = JSON.parse(readFileSync('config/catalog/local-pokemon-tcg-data-manifest.json', 'utf8'));
  parseManifest(manifest);
  const entry = manifest.sets.find((item: { setId: string }) => item.setId === TARGET_SET_CODE);
  if (!entry || entry.name !== TARGET_SET_NAME) throw new Error('Canonieke SVP-manifestidentiteit ontbreekt.');

  const localCards = loadPokemonTcgDataJson(join(options.inputRoot, entry.jsonPath), TARGET_SET_CODE).cards;
  const localById = new Map(localCards.map((card) => [card.id, card]));
  const candidates = approved.candidates!;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  const client = createClient(url, key);

  const { data: setRows, error: setError } = await client
    .from('sets_catalog')
    .select('id,set_code,name')
    .eq('set_code', TARGET_SET_CODE);
  if (
    setError ||
    !setRows ||
    setRows.length !== 1 ||
    setRows[0].name !== TARGET_SET_NAME
  ) {
    throw new Error('Exact één canonieke SVP-set is vereist.');
  }

  const ids = candidates.map((candidate) => candidate.cardCatalogId);
  const { data: cardRows, error: cardError } = await client
    .from('cards_catalog')
    .select('id,external_id,pokemon,set_name,set_code,number,rarity,image_small,image_large')
    .in('id', ids);
  if (cardError || !cardRows || cardRows.length !== EXPECTED_CANDIDATES) {
    throw new Error('Exacte kaart-precheck mislukt.');
  }

  const { data: referenceRows, error: referenceError } = await client
    .from('card_external_references')
    .select('card_catalog_id,source,external_id')
    .in('card_catalog_id', ids)
    .eq('source', 'pokemon_tcg_api');
  if (referenceError || !referenceRows) throw new Error('Externe-reference-precheck mislukt.');

  const cardsById = new Map((cardRows as CatalogCard[]).map((card) => [card.id, card]));
  const references = referenceRows as ExternalReference[];
  for (const candidate of candidates) {
    const card = cardsById.get(candidate.cardCatalogId);
    const local = localById.get(candidate.externalId);
    const matchingReferences = references.filter(
      (reference) =>
        reference.card_catalog_id === candidate.cardCatalogId &&
        reference.external_id === candidate.externalId,
    );
    const conflictingReferences = references.filter(
      (reference) =>
        reference.card_catalog_id === candidate.cardCatalogId &&
        reference.external_id !== candidate.externalId,
    );
    if (
      !card ||
      !local ||
      matchingReferences.length !== 1 ||
      conflictingReferences.length !== 0 ||
      card.pokemon !== candidate.pokemon ||
      card.pokemon !== local.name ||
      card.number !== candidate.number ||
      card.number !== local.number ||
      card.set_name !== TARGET_SET_NAME ||
      card.rarity !== (local.rarity ?? null) ||
      card.image_small !== (local.images?.small ?? null) ||
      card.image_large !== (local.images?.large ?? null)
    ) {
      throw new Error(`${candidate.cardCatalogId}: identiteit of kernmetadata wijkt af.`);
    }
  }

  const before = await databaseSnapshot(client);
  const expectedBefore = options.mode === 'idempotency'
    ? { nullSetCodeCards: 29, svpCards: 11, candidateSetCode: TARGET_SET_CODE }
    : { nullSetCodeCards: 40, svpCards: 0, candidateSetCode: null };
  if (
    before.nullSetCodeCards !== expectedBefore.nullSetCodeCards ||
    before.svpCards !== expectedBefore.svpCards ||
    [...cardsById.values()].some((card) => card.set_code !== expectedBefore.candidateSetCode)
  ) {
    throw new Error('Database-precheck wijkt af; niets werd gewijzigd.');
  }

  const rpcRows = candidates.map((candidate) => ({
    id: candidate.cardCatalogId,
    expected_external_id: candidate.externalId,
    expected_pokemon: candidate.pokemon,
    expected_set_name: TARGET_SET_NAME,
    expected_number: candidate.number,
    target_set_code: TARGET_SET_CODE,
  }));

  let writes = 0;
  if (options.mode === 'write') {
    const { data, error } = await client.rpc('apply_catalog_svp_null_recovery', { p_rows: rpcRows });
    if (error || data !== EXPECTED_CANDIDATES) {
      throw new Error('Transactionele SVP-herstelwrite mislukt.');
    }
    writes = data;
  }

  const after = await databaseSnapshot(client);
  const expectedAfter = options.mode === 'dry-run'
    ? { nullSetCodeCards: 40, svpCards: 0, candidateSetCode: null }
    : { nullSetCodeCards: 29, svpCards: 11, candidateSetCode: TARGET_SET_CODE };

  const { data: postcheckRows, error: postcheckError } = await client
    .from('cards_catalog')
    .select('id,set_code')
    .in('id', ids);
  if (
    postcheckError ||
    !postcheckRows ||
    postcheckRows.length !== EXPECTED_CANDIDATES ||
    postcheckRows.some((card) => card.set_code !== expectedAfter.candidateSetCode) ||
    after.nullSetCodeCards !== expectedAfter.nullSetCodeCards ||
    after.svpCards !== expectedAfter.svpCards ||
    after.cardsCatalog !== before.cardsCatalog ||
    after.collectionCards !== before.collectionCards ||
    after.cardExternalReferences !== before.cardExternalReferences
  ) {
    throw new Error('Exacte SVP-postcheck mislukt.');
  }

  const report = {
    schemaVersion: 1,
    phase: 'SVP null set-code recovery',
    mode: options.mode,
    approvedReportHash: approved.reportHash,
    datasetVersion: PINNED_DATASET_VERSION,
    candidateRows: EXPECTED_CANDIDATES,
    plannedWrites: options.mode === 'dry-run' ? EXPECTED_CANDIDATES : 0,
    databaseWritesTotal: writes,
    databaseCounts: { before, after },
    status: 'PASS',
    reportHash: '',
  };
  report.reportHash = reportHash(report);
  mkdirSync(dirname(options.reportPath), { recursive: true });
  writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(
    `SVP null set-code recovery ${options.mode}: PASS; candidates=${EXPECTED_CANDIDATES}; plannedWrites=${report.plannedWrites}; databaseWritesTotal=${writes}; reportHash=${report.reportHash}`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'SVP null set-code recovery failed.');
    process.exitCode = 1;
  });
}
