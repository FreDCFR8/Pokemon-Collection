import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { PINNED_DATASET_VERSION, validateLocalDatasetCheckout } from './local-checkout.ts';
import { reportHash } from './catalog-report-identity.ts';
import { parseManifest } from './catalog-quality-audit.ts';

const MANIFEST_PATH = 'config/catalog/local-pokemon-tcg-data-manifest.json';
const PAGE_SIZE = 500;
const SOURCE = 'pokemon_tcg_api';

type ManifestSet = { setId: string; expectedCards: number; enabled: boolean };
type SetRow = { id: string; set_code: string; name: string; source: string | null; source_id: string | null };
type SetReference = { set_catalog_id: string; source: string; external_id: string };
type CardRow = { id: string; set_code: string };

export type AliasClassification = 'alias_candidate' | 'unmapped_off_profile';
export type OffProfileSet = {
  setCode: string;
  cardCount: number;
  setCatalog: Pick<SetRow, 'id' | 'name' | 'source' | 'source_id'> | null;
  pokemonTcgApiExternalIds: string[];
  classification: AliasClassification;
  targetSetCode: string | null;
};

export function analyzeAliases(manifestSets: ManifestSet[], setRows: SetRow[], references: SetReference[], cards: CardRow[]) {
  const expectedCodes = new Set(manifestSets.map((set) => set.setId));
  const setsByCode = new Map(setRows.map((set) => [set.set_code, set]));
  const refsBySetId = new Map<string, SetReference[]>();
  for (const reference of references) {
    const rows = refsBySetId.get(reference.set_catalog_id) ?? [];
    rows.push(reference);
    refsBySetId.set(reference.set_catalog_id, rows);
  }
  const cardsByCode = new Map<string, number>();
  for (const card of cards) cardsByCode.set(card.set_code, (cardsByCode.get(card.set_code) ?? 0) + 1);
  const offProfile = [...cardsByCode.entries()]
    .filter(([setCode]) => !expectedCodes.has(setCode))
    .map(([setCode, cardCount]) => {
      const set = setsByCode.get(setCode) ?? null;
      const externalIds = (set ? refsBySetId.get(set.id) ?? [] : [])
        .filter((reference) => reference.source === SOURCE)
        .map((reference) => reference.external_id)
        .sort();
      const eligibleTargets = externalIds.filter((externalId) => expectedCodes.has(externalId));
      const targetSetCode = eligibleTargets.length === 1 ? eligibleTargets[0] : null;
      return {
        setCode, cardCount,
        setCatalog: set ? { id: set.id, name: set.name, source: set.source, source_id: set.source_id } : null,
        pokemonTcgApiExternalIds: externalIds,
        classification: targetSetCode ? 'alias_candidate' : 'unmapped_off_profile',
        targetSetCode,
      } satisfies OffProfileSet;
    })
    .sort((left, right) => left.setCode.localeCompare(right.setCode));
  const aliasByTarget = new Map(offProfile.filter((entry) => entry.targetSetCode).map((entry) => [entry.targetSetCode!, entry]));
  const missingExpectedSets = manifestSets.filter((set) => !setsByCode.has(set.setId)).map((set) => ({
    setCode: set.setId, expectedCards: set.expectedCards,
    resolution: aliasByTarget.has(set.setId) ? 'resolved_by_alias_candidate' : 'no_alias_candidate',
    aliasSetCode: aliasByTarget.get(set.setId)?.setCode ?? null,
  }));
  return { offProfile, missingExpectedSets };
}

function parseArgs(argv: string[]) {
  if (argv.length !== 4 || argv[0] !== '--input-root' || argv[2] !== '--report' || !argv[1] || !argv[3]) {
    throw new Error('Gebruik uitsluitend --input-root <dataset> --report <nieuw rapport>. Deze analyse is read-only.');
  }
  return { inputRoot: resolve(argv[1]), reportPath: resolve(argv[3]) };
}

async function exactCount(client: ReturnType<typeof createClient>, table: 'sets_catalog' | 'cards_catalog' | 'set_external_references') {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true });
  if (error || count === null) throw new Error(`${table}: count-read mislukt.`);
  return count;
}

async function readAllCards(client: ReturnType<typeof createClient>): Promise<CardRow[]> {
  const rows: CardRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client.from('cards_catalog').select('id,set_code').order('id').range(from, from + PAGE_SIZE - 1);
    if (error || !data) throw new Error('cards_catalog-read mislukt.');
    rows.push(...data as CardRow[]);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function main(): Promise<void> {
  const { inputRoot, reportPath } = parseArgs(process.argv.slice(2));
  if (existsSync(reportPath)) throw new Error(`Rapport bestaat al: ${reportPath}`);
  validateLocalDatasetCheckout(inputRoot, PINNED_DATASET_VERSION);
  const manifestSets = parseManifest(JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')));
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  const client = createClient(url, key);
  const before = {
    setsCatalog: await exactCount(client, 'sets_catalog'), cardsCatalog: await exactCount(client, 'cards_catalog'),
    setExternalReferences: await exactCount(client, 'set_external_references'),
  };
  const [{ data: sets, error: setsError }, { data: references, error: referencesError }, cards] = await Promise.all([
    client.from('sets_catalog').select('id,set_code,name,source,source_id').order('set_code'),
    client.from('set_external_references').select('set_catalog_id,source,external_id').order('set_catalog_id'),
    readAllCards(client),
  ]);
  if (setsError || !sets) throw new Error('sets_catalog-read mislukt.');
  if (referencesError || !references) throw new Error('set_external_references-read mislukt.');
  const analysis = analyzeAliases(manifestSets, sets as SetRow[], references as SetReference[], cards);
  const after = {
    setsCatalog: await exactCount(client, 'sets_catalog'), cardsCatalog: await exactCount(client, 'cards_catalog'),
    setExternalReferences: await exactCount(client, 'set_external_references'),
  };
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Analyse abort: database veranderde tijdens de read-only meting.');
  const aliasCandidates = analysis.offProfile.filter((entry) => entry.classification === 'alias_candidate');
  const unmapped = analysis.offProfile.filter((entry) => entry.classification === 'unmapped_off_profile');
  const report = {
    schemaVersion: 1, phase: 'Catalog alias and off-profile analysis', mode: 'read-only', runnerStatus: 'PASS',
    status: analysis.offProfile.length === 0 && analysis.missingExpectedSets.length === 0 ? 'CLEAN' : 'ACTION_REQUIRED',
    datasetVersion: PINNED_DATASET_VERSION, databaseWritesTotal: 0, databaseCounts: { before, after }, summary: {
      offProfileSetCodes: analysis.offProfile.length,
      offProfileCards: analysis.offProfile.reduce((sum, entry) => sum + entry.cardCount, 0),
      aliasCandidates: aliasCandidates.length,
      aliasCandidateCards: aliasCandidates.reduce((sum, entry) => sum + entry.cardCount, 0),
      unmappedOffProfileSetCodes: unmapped.length,
      unmappedOffProfileCards: unmapped.reduce((sum, entry) => sum + entry.cardCount, 0),
      missingExpectedSetCodes: analysis.missingExpectedSets.length,
      missingExpectedResolvedByAlias: analysis.missingExpectedSets.filter((entry) => entry.resolution === 'resolved_by_alias_candidate').length,
    }, offProfile: analysis.offProfile, missingExpectedSets: analysis.missingExpectedSets, reportHash: '',
  };
  report.reportHash = reportHash(report);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Catalog alias analysis: ${report.status}; offProfileCards=${report.summary.offProfileCards}; databaseWritesTotal=0; reportHash=${report.reportHash}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Catalog alias analysis failed.'); process.exitCode = 1; });
}
