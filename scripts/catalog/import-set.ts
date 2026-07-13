import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ALLOWED_SET_ID = 'sv3pt5';
const SOURCE = 'pokemon_tcg_api';
const API_BASE_URL = 'https://api.pokemontcg.io/v2';
const PAGE_SIZE = 250;
const MAX_PAGES = 20;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const SUPABASE_BATCH_SIZE = 100;
const EXAMPLE_LIMIT = 10;
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const PERMANENT_STATUSES = new Set([400, 401, 403, 404]);

type CliOptions = { setId: string };

type SupabaseConfig = { url: string; serviceRoleKey: string };

type ExternalReferenceRow = {
  id: string;
  source: string;
  external_id: string;
  card_catalog_id: string | null;
};

type CatalogCardRow = {
  id: string;
  set_code: string | null;
  number: string | null;
  pokemon: string | null;
  rarity: string | null;
  image_small: string | null;
  image_large: string | null;
};

type SetCatalogRow = {
  set_code: string;
  source: string | null;
  source_id: string | null;
};

type MatchExample = {
  external_id: string;
  name: string;
  number: string;
  set_code?: string;
  card_catalog_id?: string;
  changed_fields?: string[];
  reason?: string;
};

type MatchingReport = {
  externalReferencesQueried: number;
  catalogCardsQueried: number;
  fallbackCandidatesQueried: number;
  matchedByExternalReference: number;
  candidateBySetAndNumber: number;
  newCards: number;
  ambiguous: number;
  conflicts: number;
  unresolvedWithoutSetMapping: number;
  metadataUnchanged: number;
  metadataChanged: number;
  candidateExamples: MatchExample[];
  newExamples: MatchExample[];
  ambiguousExamples: MatchExample[];
  conflictExamples: MatchExample[];
  unresolvedWithoutSetMappingExamples: MatchExample[];
  metadataChangedExamples: MatchExample[];
  fallbackAvailable: boolean;
  setCode?: string;
  errors: string[];
};

type PokemonSetResponse = { data?: unknown };
type PokemonCardsResponse = { data?: unknown };

type PokemonSet = {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  updatedAt: string;
};

type PokemonCard = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images?: {
    small?: string;
    large?: string;
  };
};

type FetchStats = {
  retriesUsed: number;
};

type PageResult = {
  cards: PokemonCard[];
  pagesFetched: number;
  emptyPageBeforeExpected: boolean;
  repeatedPageDetected: boolean;
  repeatedCardIdDetected: boolean;
};

type ValidationResult = {
  duplicateIds: string[];
  missingName: number;
  missingNumber: number;
  missingRarity: number;
  missingSmallImage: number;
  missingLargeImage: number;
  errors: string[];
};

class UserFacingError extends Error {}
class RequestError extends Error {}
class InvalidResponseError extends Error {}

function parseArgs(argv: string[]): CliOptions {
  let setId: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--set') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new UserFacingError('Ontbrekende waarde voor --set. Gebruik: npm run catalog:import -- --set sv3pt5');
      }
      setId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--set=')) {
      setId = arg.slice('--set='.length);
      continue;
    }

    if (arg === '--write' || arg.startsWith('--write=')) {
      throw new UserFacingError('Writes worden in Phase 7B-2D niet ondersteund. Dit script draait uitsluitend in DRY RUN-modus.');
    }

    throw new UserFacingError(`Onbekend argument: ${arg}`);
  }

  if (!setId) {
    throw new UserFacingError('Verplicht argument ontbreekt: --set. Gebruik: npm run catalog:import -- --set sv3pt5');
  }

  if (setId !== ALLOWED_SET_ID) {
    throw new UserFacingError(`Ongeldige set-ID: ${setId}. In deze fase is alleen ${ALLOWED_SET_ID} toegestaan.`);
  }

  return { setId };
}

function getApiKey(): string {
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  if (!apiKey) {
    throw new UserFacingError('Environment variable POKEMON_TCG_API_KEY ontbreekt. Stel deze lokaal in om de read-only dry-run uit te voeren.');
  }
  return apiKey;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === 'string' ? value[key] : undefined;
}

function readNumber(value: Record<string, unknown>, key: string): number | undefined {
  return typeof value[key] === 'number' ? value[key] : undefined;
}

function parseSet(value: unknown): PokemonSet {
  if (!isObject(value)) {
    throw new InvalidResponseError('Ongeldige API-response: setmetadata ontbreekt of heeft een ongeldig formaat.');
  }

  const set = {
    id: readString(value, 'id'),
    name: readString(value, 'name'),
    series: readString(value, 'series'),
    printedTotal: readNumber(value, 'printedTotal'),
    total: readNumber(value, 'total'),
    releaseDate: readString(value, 'releaseDate'),
    updatedAt: readString(value, 'updatedAt'),
  };

  if (!set.id || !set.name || !set.series || set.printedTotal === undefined || set.total === undefined || !set.releaseDate || !set.updatedAt) {
    throw new InvalidResponseError('Ongeldige API-response: verplichte setmetadata ontbreekt.');
  }

  return set as PokemonSet;
}

function parseCards(value: unknown): PokemonCard[] {
  if (!Array.isArray(value)) {
    throw new InvalidResponseError('Ongeldige API-response: cards data is geen array.');
  }

  return value.map((item) => {
    if (!isObject(item)) {
      throw new InvalidResponseError('Ongeldige API-response: kaartitem heeft een ongeldig formaat.');
    }

    const images = isObject(item.images) ? item.images : undefined;
    return {
      id: readString(item, 'id') ?? '',
      name: readString(item, 'name') ?? '',
      number: readString(item, 'number') ?? '',
      rarity: readString(item, 'rarity'),
      images: images
        ? {
            small: readString(images, 'small'),
            large: readString(images, 'large'),
          }
        : undefined,
    };
  });
}

function isTemporaryNetworkError(error: unknown): boolean {
  if (!isObject(error)) return false;
  const name = typeof error.name === 'string' ? error.name : '';
  const code = typeof error.code === 'string' ? error.code : '';
  return name === 'AbortError' || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(code);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: URL, apiKey: string, stats: FetchStats): Promise<unknown> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (RETRY_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
          stats.retriesUsed += 1;
          await sleep(250 * attempt);
          continue;
        }

        if (PERMANENT_STATUSES.has(response.status) || !RETRY_STATUSES.has(response.status) || attempt >= MAX_ATTEMPTS) {
          throw new RequestError(`Request mislukt met HTTP ${response.status} voor ${url.pathname}.`);
        }
      }

      return await response.json();
    } catch (error) {
      if (error instanceof RequestError) throw error;
      if (error instanceof SyntaxError) {
        throw new InvalidResponseError(`Ongeldige JSON-response voor ${url.pathname}.`);
      }
      if (isTemporaryNetworkError(error) && attempt < MAX_ATTEMPTS) {
        stats.retriesUsed += 1;
        await sleep(250 * attempt);
        continue;
      }
      throw new RequestError(`Request definitief mislukt voor ${url.pathname}.`);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new RequestError(`Request definitief mislukt voor ${url.pathname}.`);
}

async function fetchSet(setId: string, apiKey: string, stats: FetchStats): Promise<PokemonSet> {
  const url = new URL(`${API_BASE_URL}/sets/${setId}`);
  const response = (await fetchJson(url, apiKey, stats)) as PokemonSetResponse;
  if (!isObject(response) || response.data === undefined) {
    throw new InvalidResponseError('Ongeldige API-response: setmetadata data ontbreekt.');
  }
  return parseSet(response.data);
}

async function fetchCards(setId: string, expectedCards: number, apiKey: string, stats: FetchStats): Promise<PageResult> {
  const cards: PokemonCard[] = [];
  const pageSignatures = new Set<string>();
  const seenCardIds = new Set<string>();
  let emptyPageBeforeExpected = false;
  let repeatedPageDetected = false;
  let repeatedCardIdDetected = false;
  let pagesFetched = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(`${API_BASE_URL}/cards`);
    url.searchParams.set('q', `set.id:${setId}`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    url.searchParams.set('select', 'id,name,number,rarity,images');

    const response = (await fetchJson(url, apiKey, stats)) as PokemonCardsResponse;
    if (!isObject(response) || response.data === undefined) {
      throw new InvalidResponseError('Ongeldige API-response: cards data ontbreekt.');
    }

    const pageCards = parseCards(response.data);
    pagesFetched += 1;
    const signature = pageCards.map((card) => card.id).join('|');

    if (pageSignatures.has(signature) && pageCards.length > 0) {
      repeatedPageDetected = true;
      break;
    }
    pageSignatures.add(signature);

    if (pageCards.length === 0) {
      if (cards.length < expectedCards) emptyPageBeforeExpected = true;
      break;
    }

    for (const card of pageCards) {
      if (card.id && seenCardIds.has(card.id)) repeatedCardIdDetected = true;
      if (card.id) seenCardIds.add(card.id);
      cards.push(card);
    }

    if (cards.length >= expectedCards) break;
  }

  return { cards, pagesFetched, emptyPageBeforeExpected, repeatedPageDetected, repeatedCardIdDetected };
}

function validate(set: PokemonSet, pageResult: PageResult): ValidationResult {
  const errors: string[] = [];
  if (!Number.isInteger(set.total) || set.total <= 0) {
    errors.push('Expected count uit setmetadata ontbreekt of is ongeldig.');
  }

  const idCounts = new Map<string, number>();
  let missingName = 0;
  let missingNumber = 0;
  let missingRarity = 0;
  let missingSmallImage = 0;
  let missingLargeImage = 0;

  for (const card of pageResult.cards) {
    if (!card.id) errors.push('Minstens één kaart mist een external ID.');
    if (!card.name) missingName += 1;
    if (!card.number) missingNumber += 1;
    if (!card.rarity) missingRarity += 1;
    if (!card.images?.small) missingSmallImage += 1;
    if (!card.images?.large) missingLargeImage += 1;
    if (card.id) idCounts.set(card.id, (idCounts.get(card.id) ?? 0) + 1);
  }

  const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id).sort();

  if (pageResult.cards.length !== set.total) errors.push('Received count verschilt van expected count.');
  if (pageResult.cards.length > set.total) errors.push('Received count is groter dan expected count.');
  if (duplicateIds.length > 0) errors.push('Duplicate external IDs gevonden.');
  if (missingName > 0) errors.push('Minstens één kaart mist name.');
  if (missingNumber > 0) errors.push('Minstens één kaart mist number.');
  if (pageResult.emptyPageBeforeExpected) errors.push('Lege pagina ontvangen voordat het verwachte totaal bereikt was.');
  if (pageResult.repeatedPageDetected) errors.push('Herhaalde pagina gedetecteerd tijdens paginatie.');
  if (pageResult.repeatedCardIdDetected) errors.push('Herhaalde kaart-ID gedetecteerd tijdens paginatie.');
  if (pageResult.pagesFetched >= MAX_PAGES && pageResult.cards.length < set.total) errors.push('Harde paginalimiet bereikt voordat alle kaarten ontvangen waren.');

  return { duplicateIds, missingName, missingNumber, missingRarity, missingSmallImage, missingLargeImage, errors: [...new Set(errors)] };
}

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new UserFacingError('Environment variable SUPABASE_URL ontbreekt. Stel deze lokaal in voor de read-only Supabase-matchingfase.');
  if (!serviceRoleKey) throw new UserFacingError('Environment variable SUPABASE_SERVICE_ROLE_KEY ontbreekt. Stel deze lokaal in voor de read-only Supabase-matchingfase.');
  return { url, serviceRoleKey };
}

function createSupabase(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeRequired(value: string): string {
  return value.trim();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function sortExamples(examples: MatchExample[]): MatchExample[] {
  return [...examples].sort((a, b) => a.external_id.localeCompare(b.external_id)).slice(0, EXAMPLE_LIMIT);
}

function addExample(list: MatchExample[], example: MatchExample): void {
  list.push(example);
}

async function readRows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new UserFacingError(`Supabase-query mislukt (${label}): ${error.message}`);
  return data ?? [];
}

async function fetchSetCatalogMapping(supabase: SupabaseClient, externalSetId: string): Promise<SetCatalogRow[]> {
  return readRows<SetCatalogRow>(
    supabase.from('sets_catalog').select('set_code,source,source_id').eq('source', SOURCE).eq('source_id', externalSetId),
    'sets_catalog setmapping',
  );
}

async function fetchExternalReferences(supabase: SupabaseClient, externalIds: string[]): Promise<ExternalReferenceRow[]> {
  const rows: ExternalReferenceRow[] = [];
  for (const batch of chunks(externalIds, SUPABASE_BATCH_SIZE)) {
    rows.push(
      ...(await readRows<ExternalReferenceRow>(
        supabase.from('card_external_references').select('id,source,external_id,card_catalog_id').eq('source', SOURCE).in('external_id', batch),
        'card_external_references',
      )),
    );
  }
  return rows;
}

async function fetchCatalogCardsByIds(supabase: SupabaseClient, cardIds: string[]): Promise<CatalogCardRow[]> {
  const rows: CatalogCardRow[] = [];
  for (const batch of chunks(cardIds, SUPABASE_BATCH_SIZE)) {
    rows.push(
      ...(await readRows<CatalogCardRow>(
        supabase.from('cards_catalog').select('id,set_code,number,pokemon,rarity,image_small,image_large').in('id', batch),
        'cards_catalog by id',
      )),
    );
  }
  return rows;
}

async function fetchFallbackCandidates(supabase: SupabaseClient, setCode: string, numbers: string[]): Promise<CatalogCardRow[]> {
  const rows: CatalogCardRow[] = [];
  for (const batch of chunks(numbers, SUPABASE_BATCH_SIZE)) {
    rows.push(
      ...(await readRows<CatalogCardRow>(
        supabase.from('cards_catalog').select('id,set_code,number,pokemon,rarity,image_small,image_large').eq('set_code', setCode).in('number', batch),
        'cards_catalog fallback candidates',
      )),
    );
  }
  return rows;
}

function compareMetadata(externalCard: PokemonCard, catalogCard: CatalogCardRow, setCode?: string): string[] {
  const differences: string[] = [];
  const comparisons: Array<[string, string | null, string | null]> = [
    ['name', normalizeRequired(externalCard.name), normalizeOptional(catalogCard.pokemon)],
    ['number', normalizeRequired(externalCard.number), normalizeOptional(catalogCard.number)],
    ['rarity', normalizeOptional(externalCard.rarity), normalizeOptional(catalogCard.rarity)],
    ['image_small', normalizeOptional(externalCard.images?.small), normalizeOptional(catalogCard.image_small)],
    ['image_large', normalizeOptional(externalCard.images?.large), normalizeOptional(catalogCard.image_large)],
  ];
  if (setCode) comparisons.push(['set_code', setCode, normalizeOptional(catalogCard.set_code)]);

  for (const [field, externalValue, internalValue] of comparisons) {
    if (externalValue !== internalValue) differences.push(field);
  }
  return differences;
}

async function matchCards(supabase: SupabaseClient, setId: string, externalCards: PokemonCard[]): Promise<MatchingReport> {
  const errors: string[] = [];
  const externalIds = uniqueSorted(externalCards.map((card) => card.id).filter(Boolean));
  const setMappings = await fetchSetCatalogMapping(supabase, setId);
  const setCode = setMappings.length === 1 ? setMappings[0].set_code : undefined;
  const unresolvedReason = setMappings.length === 0 ? 'missing_set_mapping' : setMappings.length > 1 ? 'multiple_set_mappings' : undefined;
  if (setMappings.length === 0) errors.push('Fallbackmatching kon niet worden uitgevoerd omdat geen betrouwbare sets_catalog-koppeling voor deze externe set bestaat.');
  if (setMappings.length > 1) errors.push('Fallbackmatching kon niet worden uitgevoerd omdat meerdere sets_catalog-koppelingen voor deze externe set bestaan.');

  const references = await fetchExternalReferences(supabase, externalIds);
  const referencesByExternalId = new Map<string, ExternalReferenceRow[]>();
  for (const reference of references) {
    const list = referencesByExternalId.get(reference.external_id) ?? [];
    list.push(reference);
    referencesByExternalId.set(reference.external_id, list);
  }

  const linkedCardIds = uniqueSorted(references.map((reference) => reference.card_catalog_id).filter((cardId): cardId is string => Boolean(cardId)));
  const linkedCatalogCards = await fetchCatalogCardsByIds(supabase, linkedCardIds);
  const catalogById = new Map(linkedCatalogCards.map((card) => [card.id, card]));

  const cardsWithoutPrimary = externalCards.filter((card) => (referencesByExternalId.get(card.id) ?? []).length === 0);
  const fallbackNumbers = setCode ? uniqueSorted(cardsWithoutPrimary.map((card) => normalizeRequired(card.number)).filter(Boolean)) : [];
  const fallbackCards = setCode ? await fetchFallbackCandidates(supabase, setCode, fallbackNumbers) : [];
  const fallbackByNumber = new Map<string, CatalogCardRow[]>();
  for (const card of fallbackCards) {
    const number = normalizeOptional(card.number);
    if (!number) continue;
    const list = fallbackByNumber.get(number) ?? [];
    list.push(card);
    fallbackByNumber.set(number, list);
  }

  const report: MatchingReport = {
    externalReferencesQueried: references.length,
    catalogCardsQueried: linkedCatalogCards.length,
    fallbackCandidatesQueried: fallbackCards.length,
    matchedByExternalReference: 0,
    candidateBySetAndNumber: 0,
    newCards: 0,
    ambiguous: 0,
    conflicts: 0,
    unresolvedWithoutSetMapping: 0,
    metadataUnchanged: 0,
    metadataChanged: 0,
    candidateExamples: [],
    newExamples: [],
    ambiguousExamples: [],
    conflictExamples: [],
    unresolvedWithoutSetMappingExamples: [],
    metadataChangedExamples: [],
    fallbackAvailable: Boolean(setCode),
    setCode,
    errors,
  };

  for (const externalCard of [...externalCards].sort((a, b) => a.id.localeCompare(b.id))) {
    const baseExample = { external_id: externalCard.id, name: externalCard.name, number: externalCard.number, ...(setCode ? { set_code: setCode } : {}) };
    const matchingReferences = referencesByExternalId.get(externalCard.id) ?? [];

    if (matchingReferences.length > 1) {
      report.conflicts += 1;
      addExample(report.conflictExamples, { ...baseExample, reason: 'multiple_external_references' });
      continue;
    }

    if (matchingReferences.length === 1) {
      const reference = matchingReferences[0];
      if (!reference.card_catalog_id) {
        report.conflicts += 1;
        addExample(report.conflictExamples, { ...baseExample, reason: 'missing_card_catalog_id' });
        continue;
      }
      const catalogCard = catalogById.get(reference.card_catalog_id);
      if (!catalogCard) {
        report.conflicts += 1;
        addExample(report.conflictExamples, { ...baseExample, card_catalog_id: reference.card_catalog_id, reason: 'dangling_card_catalog_id' });
        continue;
      }

      report.matchedByExternalReference += 1;
      const changedFields = compareMetadata(externalCard, catalogCard, setCode);
      if (changedFields.length > 0) {
        report.metadataChanged += 1;
        addExample(report.metadataChangedExamples, { ...baseExample, card_catalog_id: catalogCard.id, changed_fields: changedFields });
      } else {
        report.metadataUnchanged += 1;
      }
      continue;
    }

    if (!setCode) {
      report.unresolvedWithoutSetMapping += 1;
      addExample(report.unresolvedWithoutSetMappingExamples, { ...baseExample, reason: unresolvedReason });
      continue;
    }

    const candidates = fallbackByNumber.get(normalizeRequired(externalCard.number)) ?? [];
    if (candidates.length === 1) {
      report.candidateBySetAndNumber += 1;
      addExample(report.candidateExamples, { ...baseExample, card_catalog_id: candidates[0].id });
    } else if (candidates.length > 1) {
      report.ambiguous += 1;
      addExample(report.ambiguousExamples, { ...baseExample, reason: `${candidates.length}_fallback_candidates` });
    } else {
      report.newCards += 1;
      addExample(report.newExamples, baseExample);
    }
  }

  const classified =
    report.matchedByExternalReference +
    report.candidateBySetAndNumber +
    report.newCards +
    report.ambiguous +
    report.conflicts +
    report.unresolvedWithoutSetMapping;
  if (classified !== externalCards.length) errors.push('Niet iedere externe kaart kreeg exact één primaire matchingstatus.');
  if (report.conflicts > 0) errors.push('Conflicten gevonden in externe referenties.');
  if (report.ambiguous > 0) errors.push('Ambigue fallbackmatches gevonden.');
  if (report.unresolvedWithoutSetMapping > 0) errors.push('Niet-gematchte kaarten zonder betrouwbare setmapping gevonden.');

  report.candidateExamples = sortExamples(report.candidateExamples);
  report.newExamples = sortExamples(report.newExamples);
  report.ambiguousExamples = sortExamples(report.ambiguousExamples);
  report.conflictExamples = sortExamples(report.conflictExamples);
  report.unresolvedWithoutSetMappingExamples = sortExamples(report.unresolvedWithoutSetMappingExamples);
  report.metadataChangedExamples = sortExamples(report.metadataChangedExamples);
  return report;
}

function printExamples(title: string, examples: MatchExample[]): void {
  if (examples.length === 0) return;
  console.log(`${title}:`);
  for (const example of examples) {
    const parts = [
      `external_id=${example.external_id}`,
      `name=${example.name}`,
      `number=${example.number}`,
      example.set_code ? `set_code=${example.set_code}` : undefined,
      example.card_catalog_id ? `cards_catalog.id=${example.card_catalog_id}` : undefined,
      example.changed_fields ? `changed_fields=${example.changed_fields.join('|')}` : undefined,
      example.reason ? `reason=${example.reason}` : undefined,
    ].filter(Boolean);
    console.log(`- ${parts.join('; ')}`);
  }
}

function printReport(params: {
  setId: string;
  setName: string;
  expectedCards: number | string;
  receivedCards: number;
  uniqueExternalIds: number;
  duplicateIds: string[];
  missingName: number;
  missingNumber: number;
  missingRarity: number;
  missingSmallImage: number;
  missingLargeImage: number;
  pagesFetched: number;
  retriesUsed: number;
  durationMs: number;
  matching?: MatchingReport;
  passed: boolean;
}): void {
  console.log('Catalog import dry run');
  console.log(`Source: ${SOURCE}`);
  console.log(`Set: ${params.setId}`);
  console.log(`Set name: ${params.setName}`);
  console.log('Mode: DRY RUN');
  console.log('');
  console.log(`Expected cards: ${params.expectedCards}`);
  console.log(`Received cards: ${params.receivedCards}`);
  console.log(`Unique external IDs: ${params.uniqueExternalIds}`);
  console.log(`Duplicate external IDs: ${params.duplicateIds.length}`);
  if (params.duplicateIds.length > 0) console.log(`Duplicate external ID samples: ${params.duplicateIds.slice(0, 10).join(', ')}`);
  console.log(`Cards missing name: ${params.missingName}`);
  console.log(`Cards missing number: ${params.missingNumber}`);
  console.log(`Cards missing rarity: ${params.missingRarity}`);
  console.log(`Cards missing small image: ${params.missingSmallImage}`);
  console.log(`Cards missing large image: ${params.missingLargeImage}`);
  console.log(`Pages fetched: ${params.pagesFetched}`);
  console.log(`Retries used: ${params.retriesUsed}`);
  console.log(`Duration: ${params.durationMs} ms`);
  console.log('');
  if (params.matching) {
    console.log('Supabase matching');
    console.log(`External references queried: ${params.matching.externalReferencesQueried}`);
    console.log(`Catalog cards queried: ${params.matching.catalogCardsQueried}`);
    console.log(`Fallback candidates queried: ${params.matching.fallbackCandidatesQueried}`);
    console.log(`Matched by external reference: ${params.matching.matchedByExternalReference}`);
    console.log(`Candidate by set and number: ${params.matching.candidateBySetAndNumber}`);
    console.log(`New: ${params.matching.newCards}`);
    console.log(`Ambiguous: ${params.matching.ambiguous}`);
    console.log(`Conflicts: ${params.matching.conflicts}`);
    console.log(`Unresolved without set mapping: ${params.matching.unresolvedWithoutSetMapping}`);
    console.log(`Metadata unchanged: ${params.matching.metadataUnchanged}`);
    console.log(`Metadata changed: ${params.matching.metadataChanged}`);
    if (!params.matching.fallbackAvailable) console.log('Fallback matching: unavailable (geen betrouwbare sets_catalog mapping gevonden).');
    printExamples('Candidate by set and number samples', params.matching.candidateExamples);
    printExamples('New samples', params.matching.newExamples);
    printExamples('Ambiguous samples', params.matching.ambiguousExamples);
    printExamples('Conflict samples', params.matching.conflictExamples);
    printExamples('Unresolved without set mapping samples', params.matching.unresolvedWithoutSetMappingExamples);
    printExamples('Metadata changed samples', params.matching.metadataChangedExamples);
    console.log('');
  }
  console.log(`Result: ${params.passed ? 'PASS' : 'FAIL'}`);
  console.log('Database writes: 0');
}

async function main(): Promise<number> {
  const start = Date.now();
  const stats: FetchStats = { retriesUsed: 0 };
  let setId = ALLOWED_SET_ID;

  try {
    const options = parseArgs(process.argv.slice(2));
    setId = options.setId;
    const apiKey = getApiKey();
    const supabaseConfig = getSupabaseConfig();
    const supabase = createSupabase(supabaseConfig);
    const set = await fetchSet(setId, apiKey, stats);
    const cards = await fetchCards(setId, set.total, apiKey, stats);
    const validation = validate(set, cards);
    const uniqueExternalIds = new Set(cards.cards.map((card) => card.id).filter(Boolean)).size;
    const matching = await matchCards(supabase, setId, cards.cards);
    const allErrors = [...validation.errors, ...matching.errors];
    const passed = allErrors.length === 0;

    printReport({
      setId,
      setName: set.name,
      expectedCards: set.total,
      receivedCards: cards.cards.length,
      uniqueExternalIds,
      duplicateIds: validation.duplicateIds,
      missingName: validation.missingName,
      missingNumber: validation.missingNumber,
      missingRarity: validation.missingRarity,
      missingSmallImage: validation.missingSmallImage,
      missingLargeImage: validation.missingLargeImage,
      pagesFetched: cards.pagesFetched,
      retriesUsed: stats.retriesUsed,
      durationMs: Date.now() - start,
      matching,
      passed,
    });

    if (!passed) {
      for (const error of allErrors) console.error(`Fout: ${error}`);
    }

    return passed ? 0 : 1;
  } catch (error) {
    console.error('Catalog import dry run');
    console.error(`Source: ${SOURCE}`);
    console.error(`Set: ${setId}`);
    console.error('Mode: DRY RUN');
    console.error('');
    const message = error instanceof Error ? error.message : 'Onbekende fout tijdens catalog import dry run.';
    console.error(`Fout: ${message}`);
    console.error('Result: FAIL');
    console.error('Database writes: 0');
    return 1;
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch(() => {
    console.error('Onverwachte fout tijdens catalog import dry run.');
    console.error('Result: FAIL');
    console.error('Database writes: 0');
    process.exitCode = 1;
  });
