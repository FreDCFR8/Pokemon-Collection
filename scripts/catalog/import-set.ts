import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { loadPokemonTcgDataJson } from './local-json.ts';
import { parseCardDetails, type CardDetails } from './card-details.ts';
import { assertWriteAuthorized, getWritePlanTitle, parseCatalogImportArgs, type CatalogImportOptions } from './import-args.ts';
import { writeDiagnosticResult, type DiagnosticExample, type FailureCode, type SetMappingCandidate, type SetMappingStatus, type SingleSetDiagnosticResult } from './diagnostic-result.ts';

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

type CliOptions = CatalogImportOptions;

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
  card_details?: CardDetails | null;
};

type CatalogIdentityRow = {
  id: string;
  external_source: string | null;
  external_id: string | null;
};

type SetCatalogRow = {
  set_code: string;
  source: string | null;
  source_id: string | null;
  name?: string | null;
  series?: string | null;
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
  classifications: CardClassification[];
  errors: string[];
  setMappingStatus: SetMappingStatus;
  setMappingEvidence: string[];
  setMappingCandidates: SetMappingCandidate[];
};

type CardClassification =
  | { kind: 'existing'; externalCard: PokemonCard; catalogCard: CatalogCardRow }
  | { kind: 'fallback'; externalCard: PokemonCard; catalogCard: CatalogCardRow }
  | { kind: 'new'; externalCard: PokemonCard };

type PlannedCatalogInsert = {
  id: string;
  external_source: string;
  external_id: string;
  pokemon: string;
  set_name: string;
  number: string;
  rarity: string | null;
  image_small: string | null;
  image_large: string | null;
  card_details: CardDetails;
  set_code: string;
};

type PlannedReferenceInsert = {
  card_catalog_id: string;
  source: string;
  external_id: string;
  source_url: string | null;
  last_seen_at: string;
};

type WritePlan = {
  existingMatches: number;
  newCatalogRows: PlannedCatalogInsert[];
  referencesForNewCards: PlannedReferenceInsert[];
  referencesForExistingCandidates: PlannedReferenceInsert[];
  blockedItems: number;
  plannedDatabaseWrites: number;
  errors: string[];
};

type WriteStats = {
  cardsCatalogInserted: number;
  referencesInsertedForNewCards: number;
  referencesInsertedForExistingCandidates: number;
  existingMatchesUnchanged: number;
  failedWrites: number;
  errors: string[];
};

type PostWriteVerification = {
  referenceCount: number;
  uniqueExternalReferenceCount: number;
  catalogLinkCount: number;
  collectionCardsBefore: number;
  collectionCardsAfter: number;
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
  details: CardDetails;
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
      details: parseCardDetails(item),
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
    url.searchParams.set('select', 'id,name,number,rarity,images,supertype,subtypes,hp,types,evolvesFrom,evolvesTo,rules,abilities,attacks,weaknesses,resistances,retreatCost,artist,nationalPokedexNumbers,legalities,regulationMark');

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

function sanitizeErrorMessage(message: string): string {
  let sanitized = message.replace(/([?&](?:apikey|key|token|access_token)=)[^&\s]+/gi, '$1[REDACTED]');
  for (const secret of [process.env.POKEMON_TCG_API_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]) {
    if (secret && secret.length >= 8) sanitized = sanitized.split(secret).join('[REDACTED]');
  }
  return sanitized;
}

async function readRows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new UserFacingError(`Supabase-query mislukt (${label}): ${sanitizeErrorMessage(error.message)}`);
  return data ?? [];
}

async function fetchSetCatalogMapping(supabase: SupabaseClient, externalSetId: string): Promise<SetCatalogRow[]> {
  return readRows<SetCatalogRow>(
    supabase.from('sets_catalog').select('set_code,source,source_id,name,series').eq('source', SOURCE).eq('source_id', externalSetId),
    'sets_catalog setmapping',
  );
}

async function fetchSetCatalogCandidates(supabase: SupabaseClient, incomingSet: PokemonSet): Promise<SetCatalogRow[]> {
  const rows = await readRows<SetCatalogRow>(
    supabase.from('sets_catalog').select('set_code,source,source_id,name,series'),
    'sets_catalog mapping candidates',
  );
  const normalizedName = normalizeRequired(incomingSet.name).toLowerCase();
  const normalizedSeries = normalizeRequired(incomingSet.series).toLowerCase();
  return rows.filter((row) => row.set_code === incomingSet.id || normalizeRequired(row.name ?? '').toLowerCase() === normalizedName && (!normalizedSeries || !row.series || normalizeRequired(row.series).toLowerCase() === normalizedSeries));
}

type CardNumberRow = { number: string | null };

async function fetchCardNumbersForSet(supabase: SupabaseClient, setCode: string): Promise<string[]> {
  const numbers: string[] = [];
  for (let offset = 0; ; offset += SUPABASE_BATCH_SIZE) {
    const rows = await readRows<CardNumberRow>(
      supabase.from('cards_catalog').select('number').eq('set_code', setCode).order('id').range(offset, offset + SUPABASE_BATCH_SIZE - 1),
      'cards_catalog mapping card coverage',
    );
    numbers.push(...rows.map((row) => normalizeOptional(row.number)).filter((number): number is string => Boolean(number)));
    if (rows.length < SUPABASE_BATCH_SIZE) break;
  }
  return uniqueSorted(numbers);
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

async function fetchReferencesByCardIds(supabase: SupabaseClient, cardIds: string[]): Promise<ExternalReferenceRow[]> {
  const rows: ExternalReferenceRow[] = [];
  for (const batch of chunks(uniqueSorted(cardIds), SUPABASE_BATCH_SIZE)) {
    rows.push(
      ...(await readRows<ExternalReferenceRow>(
        supabase.from('card_external_references').select('id,source,external_id,card_catalog_id').eq('source', SOURCE).in('card_catalog_id', batch),
        'card_external_references by card_catalog_id',
      )),
    );
  }
  return rows;
}

async function fetchCatalogIdentities(supabase: SupabaseClient, externalIds: string[]): Promise<CatalogIdentityRow[]> {
  const rows: CatalogIdentityRow[] = [];
  for (const batch of chunks(uniqueSorted(externalIds), SUPABASE_BATCH_SIZE)) {
    rows.push(
      ...(await readRows<CatalogIdentityRow>(
        supabase.from('cards_catalog').select('id,external_source,external_id').eq('external_source', SOURCE).in('external_id', batch),
        'cards_catalog by external identity',
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

async function fetchCatalogCardsForSet(supabase: SupabaseClient, setCode: string): Promise<CatalogCardRow[]> {
  const rows: CatalogCardRow[] = [];
  for (let offset = 0; ; offset += SUPABASE_BATCH_SIZE) {
    const batch = await readRows<CatalogCardRow>(
      supabase
        .from('cards_catalog')
        .select('id,set_code,number,pokemon,rarity,image_small,image_large,card_details')
        .eq('set_code', setCode)
        .order('id')
        .range(offset, offset + SUPABASE_BATCH_SIZE - 1),
      'cards_catalog post-write set verification',
    );
    rows.push(...batch);
    if (batch.length < SUPABASE_BATCH_SIZE) break;
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

async function matchCards(supabase: SupabaseClient, incomingSet: PokemonSet, externalCards: PokemonCard[]): Promise<MatchingReport> {
  const setId = incomingSet.id;
  const errors: string[] = [];
  const externalIds = uniqueSorted(externalCards.map((card) => card.id).filter(Boolean));
  const setMappings = await fetchSetCatalogMapping(supabase, setId);
  const candidateRows = await fetchSetCatalogCandidates(supabase, incomingSet);
  const setCode = setMappings.length === 1 ? setMappings[0].set_code : undefined;
  const unresolvedReason = setMappings.length === 0 ? 'missing_set_mapping' : setMappings.length > 1 ? 'multiple_set_mappings' : undefined;
  if (setMappings.length === 0) errors.push('Fallbackmatching kon niet worden uitgevoerd omdat geen betrouwbare sets_catalog-koppeling voor deze externe set bestaat.');
  if (setMappings.length > 1) errors.push('Fallbackmatching kon niet worden uitgevoerd omdat meerdere sets_catalog-koppelingen voor deze externe set bestaan.');

  const incomingNumbers = uniqueSorted(externalCards.map((card) => normalizeRequired(card.number)).filter(Boolean));
  const mappingCandidates: SetMappingCandidate[] = [];
  for (const candidate of candidateRows) {
    const candidateNumbers = await fetchCardNumbersForSet(supabase, candidate.set_code);
    const overlap = candidateNumbers.filter((number) => incomingNumbers.includes(number)).length;
    const evidenceCodes = [
      ...(candidate.set_code === setId ? ['exact_set_code'] : []),
      ...(normalizeRequired(candidate.name ?? '').toLowerCase() === normalizeRequired(incomingSet.name).toLowerCase() ? ['exact_normalized_name'] : []),
      ...(candidate.series && normalizeRequired(candidate.series).toLowerCase() === normalizeRequired(incomingSet.series).toLowerCase() ? ['series_match'] : []),
      ...(overlap > 0 ? ['card_number_overlap'] : []),
    ];
    mappingCandidates.push({ set_code: candidate.set_code, ...(candidate.name ? { name: candidate.name } : {}), ...(candidate.series ? { series: candidate.series } : {}), source: candidate.source, source_id: candidate.source_id, evidenceCodes, incomingCardCount: incomingNumbers.length, overlappingUniqueCardNumbers: overlap, coveragePercentage: incomingNumbers.length === 0 ? 0 : Number(((overlap / incomingNumbers.length) * 100).toFixed(2)) });
  }

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
  const linkedSourceReferences = await fetchReferencesByCardIds(supabase, linkedCardIds);
  const sourceReferencesByCardId = new Map<string, ExternalReferenceRow[]>();
  for (const reference of linkedSourceReferences) {
    if (!reference.card_catalog_id) continue;
    const list = sourceReferencesByCardId.get(reference.card_catalog_id) ?? [];
    list.push(reference);
    sourceReferencesByCardId.set(reference.card_catalog_id, list);
  }

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
  const fallbackReferences = await fetchReferencesByCardIds(
    supabase,
    fallbackCards.map((card) => card.id),
  );
  const fallbackReferencesByCardId = new Map<string, ExternalReferenceRow[]>();
  for (const reference of fallbackReferences) {
    if (!reference.card_catalog_id) continue;
    const list = fallbackReferencesByCardId.get(reference.card_catalog_id) ?? [];
    list.push(reference);
    fallbackReferencesByCardId.set(reference.card_catalog_id, list);
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
    classifications: [],
    errors,
    setMappingStatus: setMappings.length === 1 ? 'already_reliable' : setMappings.length > 1 ? 'conflicting_candidate' : mappingCandidates.length === 1 ? 'exact_candidate' : mappingCandidates.length > 1 ? 'ambiguous_candidate' : 'no_candidate',
    setMappingEvidence: setMappings.length === 1 ? ['exact_external_source_id'] : mappingCandidates.length > 0 ? ['candidate_evidence_only; no automatic promotion'] : [],
    setMappingCandidates: mappingCandidates,
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
      const referencesForCatalogCard = sourceReferencesByCardId.get(reference.card_catalog_id) ?? [];
      if (referencesForCatalogCard.length !== 1 || referencesForCatalogCard[0].id !== reference.id) {
        report.conflicts += 1;
        addExample(report.conflictExamples, { ...baseExample, card_catalog_id: reference.card_catalog_id, reason: 'catalog_card_has_multiple_source_references' });
        continue;
      }

      report.matchedByExternalReference += 1;
      const changedFields = compareMetadata(externalCard, catalogCard, setCode);
      if (changedFields.length > 0) {
        report.metadataChanged += 1;
        addExample(report.metadataChangedExamples, { ...baseExample, card_catalog_id: catalogCard.id, changed_fields: changedFields });
      } else {
        report.metadataUnchanged += 1;
        report.classifications.push({ kind: 'existing', externalCard, catalogCard });
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
      const candidate = candidates[0];
      const changedFields = compareMetadata(externalCard, candidate, setCode);
      const conflictingReferences = fallbackReferencesByCardId.get(candidate.id) ?? [];
      if (changedFields.length > 0) {
        report.conflicts += 1;
        report.metadataChanged += 1;
        addExample(report.metadataChangedExamples, { ...baseExample, card_catalog_id: candidate.id, changed_fields: changedFields });
        addExample(report.conflictExamples, { ...baseExample, card_catalog_id: candidate.id, changed_fields: changedFields, reason: 'fallback_metadata_mismatch' });
      } else if (conflictingReferences.length > 0) {
        report.conflicts += 1;
        addExample(report.conflictExamples, { ...baseExample, card_catalog_id: candidate.id, reason: 'fallback_candidate_already_has_source_reference' });
      } else {
        report.candidateBySetAndNumber += 1;
        report.metadataUnchanged += 1;
        addExample(report.candidateExamples, { ...baseExample, card_catalog_id: candidate.id });
        report.classifications.push({ kind: 'fallback', externalCard, catalogCard: candidate });
      }
    } else if (candidates.length > 1) {
      report.ambiguous += 1;
      addExample(report.ambiguousExamples, { ...baseExample, reason: `${candidates.length}_fallback_candidates` });
    } else {
      report.newCards += 1;
      addExample(report.newExamples, baseExample);
      report.classifications.push({ kind: 'new', externalCard });
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
  if (report.metadataChanged > 0) errors.push('Bestaande catalogusmetadata wijkt af; automatische metadata-updates zijn niet toegestaan.');

  report.candidateExamples = sortExamples(report.candidateExamples);
  report.newExamples = sortExamples(report.newExamples);
  report.ambiguousExamples = sortExamples(report.ambiguousExamples);
  report.conflictExamples = sortExamples(report.conflictExamples);
  report.unresolvedWithoutSetMappingExamples = sortExamples(report.unresolvedWithoutSetMappingExamples);
  report.metadataChangedExamples = sortExamples(report.metadataChangedExamples);
  return report;
}

function buildWritePlan(matching: MatchingReport, setName: string, importedAt: string, totalCards: number): WritePlan {
  const newCatalogRows: PlannedCatalogInsert[] = [];
  const referencesForNewCards: PlannedReferenceInsert[] = [];
  const referencesForExistingCandidates: PlannedReferenceInsert[] = [];
  const setCode = matching.setCode;

  for (const classification of [...matching.classifications].sort((a, b) => a.externalCard.id.localeCompare(b.externalCard.id))) {
    if (classification.kind === 'existing') continue;
    if (!setCode) continue;

    if (classification.kind === 'fallback') {
      referencesForExistingCandidates.push({
        card_catalog_id: classification.catalogCard.id,
        source: SOURCE,
        external_id: classification.externalCard.id,
        source_url: null,
        last_seen_at: importedAt,
      });
      continue;
    }

    const id = randomUUID();
    newCatalogRows.push({
      id,
      external_source: SOURCE,
      external_id: classification.externalCard.id,
      pokemon: normalizeRequired(classification.externalCard.name),
      set_name: normalizeRequired(setName),
      number: normalizeRequired(classification.externalCard.number),
      rarity: normalizeOptional(classification.externalCard.rarity),
      image_small: normalizeOptional(classification.externalCard.images?.small),
      image_large: normalizeOptional(classification.externalCard.images?.large),
      card_details: classification.externalCard.details,
      set_code: setCode,
    });
    referencesForNewCards.push({
      card_catalog_id: id,
      source: SOURCE,
      external_id: classification.externalCard.id,
      source_url: null,
      last_seen_at: importedAt,
    });
  }

  const existingMatches = matching.classifications.filter((classification) => classification.kind === 'existing').length;
  const plannedReferences = [...referencesForNewCards, ...referencesForExistingCandidates];
  const duplicatePlannedExternalIds = new Set(duplicateValues(plannedReferences.map((row) => row.external_id)));
  const duplicatePlannedCatalogIds = new Set(duplicateValues(plannedReferences.map((row) => row.card_catalog_id)));
  const unsafePlannedReferences = plannedReferences.filter(
    (row) => duplicatePlannedExternalIds.has(row.external_id) || duplicatePlannedCatalogIds.has(row.card_catalog_id),
  ).length;
  const errors: string[] = [];
  if (duplicatePlannedExternalIds.size > 0) errors.push('Het writeplan bevat dubbele geplande source + external_id-references.');
  if (duplicatePlannedCatalogIds.size > 0) errors.push('Het writeplan bevat dubbele geplande card_catalog_id + source-references.');
  if (newCatalogRows.length !== referencesForNewCards.length) errors.push('Nieuwe cataloguskaarten en hun geplande references vormen geen één-op-éénkoppeling.');
  const blockedItems = totalCards - matching.classifications.length + unsafePlannedReferences;
  return {
    existingMatches,
    newCatalogRows,
    referencesForNewCards,
    referencesForExistingCandidates,
    blockedItems,
    plannedDatabaseWrites: newCatalogRows.length + referencesForNewCards.length + referencesForExistingCandidates.length,
    errors,
  };
}

async function countCollectionCards(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from('collection_cards').select('id', { count: 'exact', head: true });
  if (error) throw new UserFacingError(`Supabase-query mislukt (collection_cards veiligheidscontrole): ${sanitizeErrorMessage(error.message)}`);
  if (count === null) throw new UserFacingError('Supabase gaf geen collection_cards-count terug voor de veiligheidscontrole.');
  return count;
}

async function assertNoCatalogIdentities(supabase: SupabaseClient, rows: PlannedCatalogInsert[]): Promise<void> {
  const existing = await fetchCatalogIdentities(
    supabase,
    rows.map((row) => row.external_id),
  );
  if (existing.length > 0) {
    throw new UserFacingError('Defensieve batchcontrole blokkeerde een cards_catalog-insert omdat de externe identiteit inmiddels bestaat. Voer de import opnieuw uit.');
  }
}

async function assertNoReferences(supabase: SupabaseClient, rows: PlannedReferenceInsert[]): Promise<void> {
  const byExternalId = await fetchExternalReferences(
    supabase,
    rows.map((row) => row.external_id),
  );
  const byCatalogId = await fetchReferencesByCardIds(
    supabase,
    rows.map((row) => row.card_catalog_id),
  );
  if (byExternalId.length > 0 || byCatalogId.length > 0) {
    throw new UserFacingError('Defensieve batchcontrole blokkeerde een reference-insert omdat source + external_id of card_catalog_id + source inmiddels bestaat. Voer de import opnieuw uit.');
  }
}

async function insertRows(supabase: SupabaseClient, table: 'cards_catalog' | 'card_external_references', rows: unknown[], label: string): Promise<number> {
  const { data, error } = await supabase.from(table).insert(rows).select('id');
  if (error) throw new UserFacingError(`Supabase-insert mislukt (${label}): ${sanitizeErrorMessage(error.message)}`);
  if (!data || data.length !== rows.length) {
    throw new UserFacingError(`Supabase-insert gaf een onverwacht aantal bevestigde rijen terug (${label}).`);
  }
  return data.length;
}

async function executeWritePlan(supabase: SupabaseClient, plan: WritePlan): Promise<WriteStats> {
  const stats: WriteStats = {
    cardsCatalogInserted: 0,
    referencesInsertedForNewCards: 0,
    referencesInsertedForExistingCandidates: 0,
    existingMatchesUnchanged: plan.existingMatches,
    failedWrites: 0,
    errors: [],
  };

  for (const batch of chunks(plan.newCatalogRows, SUPABASE_BATCH_SIZE)) {
    try {
      await assertNoCatalogIdentities(supabase, batch);
      stats.cardsCatalogInserted += await insertRows(supabase, 'cards_catalog', batch, 'nieuwe cards_catalog-records');
    } catch (error) {
      stats.failedWrites += batch.length;
      stats.errors.push(error instanceof Error ? error.message : 'Onbekende fout bij cards_catalog-insert.');
      return stats;
    }
  }

  for (const batch of chunks(plan.referencesForNewCards, SUPABASE_BATCH_SIZE)) {
    try {
      await assertNoReferences(supabase, batch);
      stats.referencesInsertedForNewCards += await insertRows(supabase, 'card_external_references', batch, 'references voor nieuwe kaarten');
    } catch (error) {
      stats.failedWrites += batch.length;
      stats.errors.push(error instanceof Error ? error.message : 'Onbekende fout bij references voor nieuwe kaarten.');
      return stats;
    }
  }

  for (const batch of chunks(plan.referencesForExistingCandidates, SUPABASE_BATCH_SIZE)) {
    try {
      await assertNoReferences(supabase, batch);
      stats.referencesInsertedForExistingCandidates += await insertRows(
        supabase,
        'card_external_references',
        batch,
        'references voor bestaande fallbackkandidaten',
      );
    } catch (error) {
      stats.failedWrites += batch.length;
      stats.errors.push(error instanceof Error ? error.message : 'Onbekende fout bij references voor bestaande fallbackkandidaten.');
      return stats;
    }
  }

  return stats;
}

function duplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

async function verifyPostWrite(params: {
  supabase: SupabaseClient;
  externalCards: PokemonCard[];
  expectedCards: number;
  setCode: string;
  collectionCardsBefore: number;
}): Promise<PostWriteVerification> {
  const collectionCardsAfter = await countCollectionCards(params.supabase);
  const catalogCardsForSet = await fetchCatalogCardsForSet(params.supabase, params.setCode);
  const referencesForSet = await fetchReferencesByCardIds(
    params.supabase,
    catalogCardsForSet.map((card) => card.id),
  );
  const incomingExternalIds = uniqueSorted(params.externalCards.map((card) => card.id));
  const incomingReferences = await fetchExternalReferences(params.supabase, incomingExternalIds);
  const incomingLinkedIds = uniqueSorted(
    incomingReferences.map((reference) => reference.card_catalog_id).filter((cardId): cardId is string => Boolean(cardId)),
  );
  const incomingLinkedCards = await fetchCatalogCardsByIds(params.supabase, incomingLinkedIds);
  const errors: string[] = [];
  const referenceExternalIds = referencesForSet.map((reference) => reference.external_id);
  const referenceCatalogIds = referencesForSet
    .map((reference) => reference.card_catalog_id)
    .filter((cardId): cardId is string => Boolean(cardId));
  const uniqueExternalReferenceCount = new Set(referenceExternalIds).size;
  const catalogLinkCount = new Set(referenceCatalogIds).size;

  if (referencesForSet.length !== params.expectedCards) errors.push(`Post-write reference count is ${referencesForSet.length}; verwacht ${params.expectedCards}.`);
  if (uniqueExternalReferenceCount !== params.expectedCards) errors.push(`Post-write unieke external_id-count is ${uniqueExternalReferenceCount}; verwacht ${params.expectedCards}.`);
  if (catalogLinkCount !== params.expectedCards) errors.push(`Post-write unieke card_catalog_id-count is ${catalogLinkCount}; verwacht ${params.expectedCards}.`);
  if (referencesForSet.some((reference) => !reference.card_catalog_id)) errors.push('Post-write verificatie vond een ontbrekende card_catalog_id.');
  if (duplicateValues(referenceExternalIds).length > 0) errors.push('Post-write verificatie vond dubbele source + external_id-references.');
  if (duplicateValues(referenceCatalogIds).length > 0) errors.push('Post-write verificatie vond dubbele card_catalog_id + source-references.');
  if (incomingReferences.length !== params.expectedCards) errors.push(`Niet iedere API-kaart heeft na de write exact één externe reference (${incomingReferences.length}/${params.expectedCards}).`);
  if (incomingReferences.some((reference) => !reference.card_catalog_id)) errors.push('Minstens één API-reference heeft na de write geen card_catalog_id.');
  if (duplicateValues(incomingReferences.map((reference) => reference.external_id)).length > 0) errors.push('Een API external_id heeft na de write meer dan één source-reference.');
  if (uniqueSorted(referenceExternalIds).join('|') !== incomingExternalIds.join('|')) errors.push('De externe references voor de set komen niet exact overeen met de gevalideerde API-kaart-ID’s.');
  if (incomingLinkedCards.length !== incomingLinkedIds.length) errors.push('Minstens één externe reference verwijst niet naar een bestaande cards_catalog-rij.');
  if (incomingLinkedCards.some((card) => card.set_code !== params.setCode)) errors.push('Minstens één gekoppelde cataloguskaart heeft niet de verwachte set_code.');
  if (collectionCardsAfter !== params.collectionCardsBefore) {
    errors.push(
      `KRITIEKE VEILIGHEIDSWAARSCHUWING: collection_cards-count veranderde van ${params.collectionCardsBefore} naar ${collectionCardsAfter}. Externe gelijktijdige activiteit is mogelijk; dit script bevat geen collection_cards-writepad.`,
    );
  }

  return {
    referenceCount: referencesForSet.length,
    uniqueExternalReferenceCount,
    catalogLinkCount,
    collectionCardsBefore: params.collectionCardsBefore,
    collectionCardsAfter,
    errors,
  };
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
  write: boolean;
  sourceLabel: string;
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
}): void {
  console.log(params.write ? 'Catalog import write' : 'Catalog import dry run');
  console.log(`Source: ${params.sourceLabel}`);
  console.log(`Set: ${params.setId}`);
  console.log(`Set name: ${params.setName}`);
  console.log(`Mode: ${params.write ? 'WRITE' : 'DRY RUN'}`);
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
    console.log(`Setmapping status: ${params.matching.setCode ? `reliable (${params.matching.setCode})` : 'missing or ambiguous'}`);
    if (!params.matching.fallbackAvailable) console.log('Fallback matching: unavailable (geen betrouwbare sets_catalog mapping gevonden).');
    printExamples('Candidate by set and number samples', params.matching.candidateExamples);
    printExamples('New samples', params.matching.newExamples);
    printExamples('Ambiguous samples', params.matching.ambiguousExamples);
    printExamples('Conflict samples', params.matching.conflictExamples);
    printExamples('Unresolved without set mapping samples', params.matching.unresolvedWithoutSetMappingExamples);
    printExamples('Metadata changed samples', params.matching.metadataChangedExamples);
    console.log('');
  }
}

function printWritePlan(plan: WritePlan, write: boolean): void {
  console.log(getWritePlanTitle(write));
  console.log(`Bestaande matches ongewijzigd: ${plan.existingMatches}`);
  console.log(`Nieuwe cards_catalog-records: ${plan.newCatalogRows.length}`);
  console.log(`Nieuwe card_external_references: ${plan.referencesForNewCards.length}`);
  console.log(`Veilige references voor bestaande fallbackkandidaten: ${plan.referencesForExistingCandidates.length}`);
  console.log(`Geblokkeerde items: ${plan.blockedItems}`);
  console.log(`Theoretisch geplande writes: ${plan.plannedDatabaseWrites}`);
  console.log('');
}

function printFinalResult(passed: boolean, databaseWrites: number): void {
  console.log(`Result: ${passed ? 'PASS' : 'FAIL'}`);
  console.log(`Database writes: ${databaseWrites}`);
}

function diagnosticExamples(matching: MatchingReport): Partial<Record<FailureCode, DiagnosticExample[]>> {
  const map = (examples: MatchExample[]): DiagnosticExample[] => examples.slice(0, EXAMPLE_LIMIT).map(({ external_id, number, card_catalog_id, reason, changed_fields }) => ({ external_id, number, ...(card_catalog_id ? { card_catalog_id } : {}), ...(reason ? { reason } : {}), ...(changed_fields ? { changed_fields } : {}) }));
  return {
    ...(matching.unresolvedWithoutSetMappingExamples.length ? { missing_set_mapping: map(matching.unresolvedWithoutSetMappingExamples) } : {}),
    ...(matching.ambiguousExamples.length ? { ambiguous_fallback_candidate: map(matching.ambiguousExamples) } : {}),
    ...(matching.conflictExamples.some((item) => item.reason === 'fallback_metadata_mismatch') ? { fallback_metadata_mismatch: map(matching.conflictExamples.filter((item) => item.reason === 'fallback_metadata_mismatch')) } : {}),
    ...(matching.conflictExamples.length ? { external_reference_conflict: map(matching.conflictExamples) } : {}),
    ...(matching.metadataChangedExamples.length ? { card_identity_conflict: map(matching.metadataChangedExamples) } : {}),
  };
}

function buildDiagnosticResult(params: { set: PokemonSet; receivedCards: number; validation: ValidationResult; matching: MatchingReport; writePlan: WritePlan; passed: boolean; databaseWrites: number }): SingleSetDiagnosticResult {
  const reasons = new Set<FailureCode>();
  if (params.validation.errors.length > 0) reasons.add('input_validation_failure');
  if (params.validation.duplicateIds.length > 0) reasons.add('card_identity_conflict');
  if (params.matching.setMappingStatus === 'no_candidate') reasons.add('missing_set_mapping');
  if (params.matching.setMappingStatus === 'ambiguous_candidate') reasons.add('ambiguous_set_mapping');
  if (params.matching.setMappingStatus === 'conflicting_candidate') reasons.add('ambiguous_set_mapping');
  if (params.matching.ambiguous > 0) reasons.add('ambiguous_fallback_candidate');
  if (params.matching.conflicts > 0) reasons.add('external_reference_conflict');
  if (params.matching.conflictExamples.some((item) => item.reason === 'fallback_metadata_mismatch')) reasons.add('fallback_metadata_mismatch');
  if (params.matching.metadataChanged > 0) reasons.add('card_identity_conflict');
  if (params.writePlan.blockedItems > 0 && reasons.size === 0) reasons.add('unexpected_runner_failure');
  return {
    schemaVersion: 1,
    setId: params.set.id,
    setName: params.set.name,
    expectedCards: params.set.total,
    receivedCards: params.receivedCards,
    status: params.passed ? 'PASS' : 'FAIL',
    ...(params.matching.setCode ? { setCode: params.matching.setCode } : {}),
    setMappingStatus: params.matching.setMappingStatus,
    setMapping: {
      status: params.matching.setMappingStatus,
      ...(params.matching.setCode ? { reliableSetCode: params.matching.setCode } : {}),
      candidates: params.matching.setMappingCandidates,
      evidence: params.matching.setMappingEvidence,
    },
    externalReferenceMatches: params.matching.matchedByExternalReference,
    fallbackCandidates: params.matching.candidateBySetAndNumber,
    newCards: params.matching.newCards,
    ambiguousItems: params.matching.ambiguous,
    conflicts: params.matching.conflicts,
    unresolvedWithoutSetMapping: params.matching.unresolvedWithoutSetMapping,
    metadataUnchanged: params.matching.metadataUnchanged,
    metadataChanged: params.matching.metadataChanged,
    blockedItems: params.writePlan.blockedItems,
    plannedDatabaseWrites: params.writePlan.plannedDatabaseWrites,
    databaseWrites: params.databaseWrites,
    failureReasons: [...reasons].sort(),
    examples: diagnosticExamples(params.matching),
  };
}

function diagnosticPathFromArgv(argv: readonly string[]): string | undefined {
  const index = argv.indexOf('--diagnostic-result');
  if (index >= 0) return argv[index + 1];
  return argv.find((arg) => arg.startsWith('--diagnostic-result='))?.slice('--diagnostic-result='.length);
}

function printPostWriteReport(stats: WriteStats, verification: PostWriteVerification): void {
  console.log('Post-write resultaat');
  console.log(`cards_catalog toegevoegd: ${stats.cardsCatalogInserted}`);
  console.log(`References toegevoegd voor nieuwe kaarten: ${stats.referencesInsertedForNewCards}`);
  console.log(`References toegevoegd voor bestaande kandidaten: ${stats.referencesInsertedForExistingCandidates}`);
  console.log(`Bestaande matches ongewijzigd: ${stats.existingMatchesUnchanged}`);
  console.log(`Mislukte writes: ${stats.failedWrites}`);
  console.log(`Verificatie reference-count: ${verification.referenceCount}`);
  console.log(`Verificatie unieke external-reference-count: ${verification.uniqueExternalReferenceCount}`);
  console.log(`Verificatie cataloguskoppelingen: ${verification.catalogLinkCount}`);
  console.log(`collection_cards vóór: ${verification.collectionCardsBefore}`);
  console.log(`collection_cards na: ${verification.collectionCardsAfter}`);
  console.log('');
}

async function main(): Promise<number> {
  const start = Date.now();
  const stats: FetchStats = { retriesUsed: 0 };
  let setId = 'unknown';
  let sourceLabel = 'pokemon_tcg_api';
  let writeMode = process.argv.slice(2).includes('--write');

  try {
    const options = parseCatalogImportArgs(process.argv.slice(2));
    setId = options.setId;
    sourceLabel = options.source;
    writeMode = options.write;
    assertWriteAuthorized(options);
    const supabaseConfig = getSupabaseConfig();
    const supabase = createSupabase(supabaseConfig);
    const localData = options.source === 'pokemon_tcg_data' ? loadPokemonTcgDataJson(options.inputPath!, setId) : undefined;
    const apiKey = options.source === 'pokemon_tcg_api' ? getApiKey() : undefined;
    const set = localData
      ? {
          id: setId,
          name: options.setName!,
          series: options.setSeries!,
          printedTotal: localData.cards.length,
          total: localData.cards.length,
          releaseDate: '',
          updatedAt: '',
        }
      : await fetchSet(setId, apiKey!, stats);
    const cards = localData
      ? {
          cards: localData.cards,
          pagesFetched: 0,
          emptyPageBeforeExpected: false,
          repeatedPageDetected: false,
          repeatedCardIdDetected: false,
        }
      : await fetchCards(setId, set.total, apiKey!, stats);
    const validation = validate(set, cards);
    const uniqueExternalIds = new Set(cards.cards.map((card) => card.id).filter(Boolean)).size;
    const matching = await matchCards(supabase, set, cards.cards);
    const writePlan = buildWritePlan(matching, set.name, new Date().toISOString(), cards.cards.length);
    const allErrors = [...validation.errors, ...matching.errors, ...writePlan.errors];
    if (writePlan.blockedItems > 0 && !allErrors.includes('Minstens één item kon niet eenduidig in het writeplan worden opgenomen.')) {
      allErrors.push('Minstens één item kon niet eenduidig in het writeplan worden opgenomen.');
    }
    const passed = allErrors.length === 0;

    printReport({
      write: options.write,
      sourceLabel,
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
    });
    printWritePlan(writePlan, options.write);

    if (!passed) {
      for (const error of allErrors) console.error(`Fout: ${error}`);
      writeDiagnosticResult(options.diagnosticResultPath, buildDiagnosticResult({ set, receivedCards: cards.cards.length, validation, matching, writePlan, passed: false, databaseWrites: 0 }));
      printFinalResult(false, 0);
      return 1;
    }

    if (!options.write) {
      writeDiagnosticResult(options.diagnosticResultPath, buildDiagnosticResult({ set, receivedCards: cards.cards.length, validation, matching, writePlan, passed: true, databaseWrites: 0 }));
      printFinalResult(true, 0);
      return 0;
    }

    try {
      await assertNoCatalogIdentities(supabase, writePlan.newCatalogRows);
      await assertNoReferences(supabase, [...writePlan.referencesForNewCards, ...writePlan.referencesForExistingCandidates]);
    } catch (error) {
      console.error(`Fout: pre-write gate geblokkeerd: ${error instanceof Error ? error.message : 'defensieve writecontrole mislukt.'}`);
      writeDiagnosticResult(options.diagnosticResultPath, buildDiagnosticResult({ set, receivedCards: cards.cards.length, validation, matching, writePlan, passed: false, databaseWrites: 0 }));
      printFinalResult(false, 0);
      return 1;
    }

    let collectionCardsBefore: number;
    try {
      collectionCardsBefore = await countCollectionCards(supabase);
    } catch (error) {
      console.error(`Fout: ${error instanceof Error ? error.message : 'collection_cards veiligheidscontrole mislukt.'}`);
      writeDiagnosticResult(options.diagnosticResultPath, buildDiagnosticResult({ set, receivedCards: cards.cards.length, validation, matching, writePlan, passed: false, databaseWrites: 0 }));
      printFinalResult(false, 0);
      return 1;
    }

    const writeStats = await executeWritePlan(supabase, writePlan);
    let verification: PostWriteVerification;
    try {
      verification = await verifyPostWrite({
        supabase,
        externalCards: cards.cards,
        expectedCards: set.total,
        setCode: matching.setCode!,
        collectionCardsBefore,
      });
    } catch (error) {
      let collectionCardsAfter = -1;
      try {
        collectionCardsAfter = await countCollectionCards(supabase);
      } catch {
        // De oorspronkelijke verificatiefout blijft leidend; -1 maakt de ontbrekende count zichtbaar.
      }
      verification = {
        referenceCount: -1,
        uniqueExternalReferenceCount: -1,
        catalogLinkCount: -1,
        collectionCardsBefore,
        collectionCardsAfter,
        errors: [error instanceof Error ? error.message : 'Onbekende fout tijdens post-write verificatie.'],
      };
    }

    const databaseWrites =
      writeStats.cardsCatalogInserted + writeStats.referencesInsertedForNewCards + writeStats.referencesInsertedForExistingCandidates;
    const writeErrors = [...writeStats.errors, ...verification.errors];
    if (databaseWrites !== writePlan.plannedDatabaseWrites) {
      writeErrors.push(`Werkelijke databasewrites (${databaseWrites}) verschillen van het goedgekeurde writeplan (${writePlan.plannedDatabaseWrites}).`);
    }
    const writePassed = writeErrors.length === 0;
    printPostWriteReport(writeStats, verification);
    for (const error of writeErrors) console.error(`Fout: ${sanitizeErrorMessage(error)}`);
    writeDiagnosticResult(options.diagnosticResultPath, buildDiagnosticResult({ set, receivedCards: cards.cards.length, validation, matching, writePlan, passed: writePassed, databaseWrites }));
    printFinalResult(writePassed, databaseWrites);
    return writePassed ? 0 : 1;
  } catch (error) {
    console.error(writeMode ? 'Catalog import write' : 'Catalog import dry run');
    console.error(`Source: ${sourceLabel}`);
    console.error(`Set: ${setId}`);
    console.error(`Mode: ${writeMode ? 'WRITE' : 'DRY RUN'}`);
    console.error('');
    const message = error instanceof Error ? error.message : 'Onbekende fout tijdens catalog import.';
    console.error(`Fout: ${sanitizeErrorMessage(message)}`);
    writeDiagnosticResult(diagnosticPathFromArgv(process.argv.slice(2)), {
      schemaVersion: 1,
      setId,
      status: 'FAIL',
      receivedCards: 0,
      setMappingStatus: 'no_candidate',
      setMapping: { status: 'no_candidate', candidates: [], evidence: [] },
      externalReferenceMatches: 0,
      fallbackCandidates: 0,
      newCards: 0,
      ambiguousItems: 0,
      conflicts: 0,
      unresolvedWithoutSetMapping: 0,
      metadataUnchanged: 0,
      metadataChanged: 0,
      blockedItems: 0,
      plannedDatabaseWrites: 0,
      databaseWrites: 0,
      failureReasons: ['unexpected_runner_failure'],
      examples: { unexpected_runner_failure: [{ reason: sanitizeErrorMessage(message) }] } as Partial<Record<FailureCode, DiagnosticExample[]>>,
    });
    printFinalResult(false, 0);
    return 1;
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch(() => {
    console.error('Onverwachte fout tijdens catalog import.');
    console.error('Result: FAIL');
    console.error('Database writes: 0');
    process.exitCode = 1;
  });
