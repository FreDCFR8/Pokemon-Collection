import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { cardDetailsSemanticallyEqual } from './import-set.ts';
import { hasCardDetails, type CardDetails } from './card-details.ts';
import { reportHash } from './catalog-report-identity.ts';
import { validateLocalDatasetCheckout, PINNED_DATASET_VERSION } from './local-checkout.ts';
import { loadPokemonTcgDataJson } from './local-json.ts';

const APPROVAL = 'backfill-607-card-details-complete-sets';
const APPROVED_AUDIT_HASH = '017a7cb5030cca30b9059b3e7e91171fc9c84cf2b24e7c55431706c25945d42f';
const EXPECTED_SET_COUNT = 35;
const EXPECTED_DETAIL_ROWS = 607;
const PRECHECK_BATCH_SIZE = 100;
const SOURCE = 'pokemon_tcg_api';

type Mode = 'dry-run' | 'write' | 'idempotency';
type ManifestEntry = { setId: string; jsonPath: string; expectedCards: number; enabled: boolean };
type AuditResult = { setCode: string; expectedCards: number; catalogCards: number; missingCardDetails: number; issues: string[] };
type ApprovedAudit = {
  phase?: string; mode?: string; runnerStatus?: string; status?: string; databaseWritesTotal?: number;
  dataset?: { version?: string }; summary?: { missingCardDetails?: number; duplicateLogicalCards?: number; duplicateRows?: number };
  results?: AuditResult[]; reportHash?: string;
};
export type CatalogCard = { id: string; set_code: string | null; card_details: CardDetails | null };
export type ExternalReference = { card_catalog_id: string; external_id: string };
export type DetailTarget = { id: string; externalId: string; setCode: string; details: CardDetails };

function parseArgs(values: string[]) {
  if (
    values.length !== 10 || values[0] !== '--mode' || !['dry-run', 'write', 'idempotency'].includes(values[1]) ||
    values[2] !== '--input-root' || values[4] !== '--approved-audit' || values[6] !== '--confirm-write' ||
    values[7] !== APPROVAL || values[8] !== '--report'
  ) throw new Error(`Gebruik --mode <dry-run|write|idempotency> --input-root <dataset> --approved-audit <rapport> --confirm-write ${APPROVAL} --report <nieuw rapport>.`);
  return { mode: values[1] as Mode, inputRoot: resolve(values[3]), approvedAudit: resolve(values[5]), reportPath: resolve(values[9]) };
}

function isEmptyDetails(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0);
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) result.push(items.slice(start, start + size));
  return result;
}

function parseApprovedAudit(path: string): AuditResult[] {
  const audit = JSON.parse(readFileSync(path, 'utf8')) as ApprovedAudit;
  if (
    audit.reportHash !== APPROVED_AUDIT_HASH || audit.reportHash !== reportHash(audit) ||
    audit.phase !== 'Catalog data quality audit' || audit.mode !== 'read-only' || audit.runnerStatus !== 'PASS' ||
    audit.status !== 'ACTION_REQUIRED' || audit.databaseWritesTotal !== 0 || audit.dataset?.version !== PINNED_DATASET_VERSION ||
    audit.summary?.missingCardDetails !== 867 || audit.summary?.duplicateLogicalCards !== 0 || audit.summary?.duplicateRows !== 0 ||
    !Array.isArray(audit.results)
  ) throw new Error('Goedgekeurd kwaliteitsrapport is ongeldig of wijkt af.');

  const eligible = audit.results.filter((result) =>
    result.missingCardDetails > 0 && result.catalogCards === result.expectedCards &&
    result.issues.length === 1 && result.issues[0] === 'missing_card_details',
  );
  if (
    eligible.length !== EXPECTED_SET_COUNT ||
    eligible.reduce((sum, result) => sum + result.missingCardDetails, 0) !== EXPECTED_DETAIL_ROWS ||
    new Set(eligible.map((result) => result.setCode)).size !== EXPECTED_SET_COUNT
  ) throw new Error('Goedgekeurd kwaliteitsrapport bevat niet exact de 35 complete detailsets.');
  return eligible.sort((left, right) => left.setCode.localeCompare(right.setCode));
}

function parseManifest(): ManifestEntry[] {
  const manifest = JSON.parse(readFileSync('config/catalog/local-pokemon-tcg-data-manifest.json', 'utf8')) as { datasetVersion?: string; sets?: ManifestEntry[] };
  if (manifest.datasetVersion !== PINNED_DATASET_VERSION || !Array.isArray(manifest.sets)) throw new Error('Lokale manifestidentiteit is ongeldig.');
  return manifest.sets;
}

async function exactCount(client: ReturnType<typeof createClient>, table: 'cards_catalog' | 'collection_cards' | 'card_external_references'): Promise<number> {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true });
  if (error || count === null) throw new Error(`${table}: count-read mislukt.`);
  return count;
}

async function snapshot(client: ReturnType<typeof createClient>) {
  return {
    cardsCatalog: await exactCount(client, 'cards_catalog'),
    collectionCards: await exactCount(client, 'collection_cards'),
    cardExternalReferences: await exactCount(client, 'card_external_references'),
  };
}

async function readSetCards(client: ReturnType<typeof createClient>, setCode: string): Promise<CatalogCard[]> {
  const { data, error } = await client.from('cards_catalog').select('id,set_code,card_details').eq('set_code', setCode).order('id');
  if (error || !data) throw new Error(`${setCode}: cards_catalog-read mislukt.`);
  return data as CatalogCard[];
}

async function readReferences(client: ReturnType<typeof createClient>, ids: string[]): Promise<ExternalReference[]> {
  const { data, error } = await client.from('card_external_references').select('card_catalog_id,external_id').eq('source', SOURCE).in('card_catalog_id', ids);
  if (error || !data) throw new Error('card_external_references-read mislukt.');
  return data as ExternalReference[];
}

async function buildTargets(
  client: ReturnType<typeof createClient>,
  inputRoot: string,
  auditSets: AuditResult[],
  includeFilled: boolean,
): Promise<DetailTarget[]> {
  const manifestBySet = new Map(parseManifest().filter((entry) => entry.enabled).map((entry) => [entry.setId, entry]));
  const targets: DetailTarget[] = [];
  for (const auditSet of auditSets) {
    const entry = manifestBySet.get(auditSet.setCode);
    if (!entry || entry.expectedCards !== auditSet.expectedCards) throw new Error(`${auditSet.setCode}: manifestscope wijkt af.`);
    const localCards = loadPokemonTcgDataJson(join(inputRoot, entry.jsonPath), entry.setId).cards;
    const databaseCards = await readSetCards(client, entry.setId);
    if (localCards.length !== entry.expectedCards || databaseCards.length !== entry.expectedCards) throw new Error(`${entry.setId}: kaartenaantal wijkt af.`);
    const references = await readReferences(client, databaseCards.map((card) => card.id));
    const cardById = new Map(databaseCards.map((card) => [card.id, card]));
    const referencesByExternalId = new Map<string, ExternalReference[]>();
    for (const reference of references) referencesByExternalId.set(reference.external_id, [...(referencesByExternalId.get(reference.external_id) ?? []), reference]);
    const ids = new Set<string>();
    for (const local of localCards) {
      const matches = referencesByExternalId.get(local.id) ?? [];
      if (matches.length !== 1 || ids.has(matches[0].card_catalog_id) || !hasCardDetails(local.details)) throw new Error(`${entry.setId}/${local.id}: externe identiteit of bron-details zijn ongeldig.`);
      const card = cardById.get(matches[0].card_catalog_id);
      if (!card || card.set_code !== entry.setId) throw new Error(`${entry.setId}/${local.id}: catalogusset wijkt af.`);
      ids.add(card.id);
      if (includeFilled || isEmptyDetails(card.card_details)) {
        targets.push({ id: card.id, externalId: local.id, setCode: entry.setId, details: local.details });
      }
    }
    const expectedTargets = includeFilled ? entry.expectedCards : auditSet.missingCardDetails;
    if (ids.size !== entry.expectedCards || targets.filter((target) => target.setCode === entry.setId).length !== expectedTargets) throw new Error(`${entry.setId}: detailscope wijkt af van het goedgekeurde auditrapport.`);
  }
  const expectedTargetCount = includeFilled
    ? auditSets.reduce((sum, auditSet) => sum + auditSet.expectedCards, 0)
    : EXPECTED_DETAIL_ROWS;
  if (targets.length !== expectedTargetCount || new Set(targets.map((target) => target.id)).size !== expectedTargetCount) {
    throw new Error(includeFilled ? 'Volledige detailscope kon niet worden opgebouwd.' : 'Exacte 607-kaartenscope kon niet worden opgebouwd.');
  }
  return targets.sort((left, right) => left.id.localeCompare(right.id));
}

export async function verifyTargetState(client: ReturnType<typeof createClient>, targets: DetailTarget[], expected: 'empty' | 'filled'): Promise<void> {
  const byId = new Map(targets.map((target) => [target.id, target]));
  const cards: CatalogCard[] = [];
  const references: ExternalReference[] = [];
  for (const [index, batch] of chunks(targets, PRECHECK_BATCH_SIZE).entries()) {
    const { data, error } = await client
      .from('cards_catalog')
      .select('id,set_code,card_details')
      .in('id', batch.map((target) => target.id));
    if (error) throw new Error(`Exacte detailkaart-precheck batch ${index + 1} mislukt: ${error.message}`);
    if (!data || data.length !== batch.length) throw new Error(`Exacte detailkaart-precheck batch ${index + 1} bevat ${data?.length ?? 0} kaarten; verwacht ${batch.length}.`);
    cards.push(...(data as CatalogCard[]));
    references.push(...await readReferences(client, batch.map((target) => target.id)));
  }
  if (cards.length !== targets.length) throw new Error(`Exacte detailkaart-precheck bevat ${cards.length} kaarten; verwacht ${targets.length}.`);
  const referencesByCardId = new Map<string, ExternalReference[]>();
  for (const reference of references) referencesByCardId.set(reference.card_catalog_id, [...(referencesByCardId.get(reference.card_catalog_id) ?? []), reference]);
  for (const card of cards) {
    const target = byId.get(card.id);
    const matchingReferences = target ? (referencesByCardId.get(card.id) ?? []).filter((reference) => reference.external_id === target.externalId) : [];
    if (!target || card.set_code !== target.setCode || matchingReferences.length !== 1) throw new Error(`${card.id}: canonieke catalogusidentiteit wijkt af.`);
    if (expected === 'empty' ? !isEmptyDetails(card.card_details) : !cardDetailsSemanticallyEqual(card.card_details, target.details)) {
      throw new Error('Database-precheck wijkt af; niets werd gewijzigd.');
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (existsSync(options.reportPath)) throw new Error(`Rapport bestaat al: ${options.reportPath}`);
  validateLocalDatasetCheckout(options.inputRoot, PINNED_DATASET_VERSION);
  const auditSets = parseApprovedAudit(options.approvedAudit);
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const targets = await buildTargets(client, options.inputRoot, auditSets, options.mode === 'idempotency');
  const before = await snapshot(client);
  await verifyTargetState(client, targets, options.mode === 'idempotency' ? 'filled' : 'empty');

  let writes = 0;
  if (options.mode === 'write') {
    const rows = targets.map((target) => ({ id: target.id, expected_external_id: target.externalId, expected_set_code: target.setCode, target_card_details: target.details }));
    const { data, error } = await client.rpc('apply_catalog_details_complete_sets', { p_rows: rows });
    if (error || data !== EXPECTED_DETAIL_ROWS) throw new Error('Transactionele detail-backfill mislukt.');
    writes = data;
  }

  await verifyTargetState(client, targets, options.mode === 'dry-run' ? 'empty' : 'filled');
  const after = await snapshot(client);
  if (after.cardsCatalog !== before.cardsCatalog || after.collectionCards !== before.collectionCards || after.cardExternalReferences !== before.cardExternalReferences) throw new Error('Postcheck mislukt: beschermde aantallen wijzigden.');
  const report = {
    schemaVersion: 1, phase: 'Catalog card details backfill for complete sets', mode: options.mode,
    approvedAuditHash: APPROVED_AUDIT_HASH, datasetVersion: PINNED_DATASET_VERSION,
    setCount: EXPECTED_SET_COUNT, candidateRows: EXPECTED_DETAIL_ROWS,
    verifiedRows: targets.length,
    plannedWrites: options.mode === 'dry-run' ? EXPECTED_DETAIL_ROWS : 0,
    databaseWritesTotal: writes, databaseCounts: { before, after }, status: 'PASS', reportHash: '',
  };
  report.reportHash = reportHash(report);
  mkdirSync(dirname(options.reportPath), { recursive: true });
  writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Catalog details complete-set backfill ${options.mode}: PASS; sets=${EXPECTED_SET_COUNT}; candidates=${EXPECTED_DETAIL_ROWS}; plannedWrites=${report.plannedWrites}; databaseWritesTotal=${writes}; reportHash=${report.reportHash}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Catalog details complete-set backfill failed.'); process.exitCode = 1; });
}
