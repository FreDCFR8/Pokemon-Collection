const ALLOWED_SET_ID = 'sv3pt5';
const SOURCE = 'pokemon-tcg-api';
const API_BASE_URL = 'https://api.pokemontcg.io/v2';
const PAGE_SIZE = 250;
const MAX_PAGES = 20;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const PERMANENT_STATUSES = new Set([400, 401, 403, 404]);

type CliOptions = { setId: string };

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
      throw new UserFacingError('Writes worden in Phase 7B-2C niet ondersteund. Dit script draait uitsluitend in DRY RUN-modus.');
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

        if (PERMANENT_STATUSES.has(response.status) || !RETRY_STATUSES.has(response.status)) {
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
    const set = await fetchSet(setId, apiKey, stats);
    const cards = await fetchCards(setId, set.total, apiKey, stats);
    const validation = validate(set, cards);
    const uniqueExternalIds = new Set(cards.cards.map((card) => card.id).filter(Boolean)).size;
    const passed = validation.errors.length === 0;

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
      passed,
    });

    if (!passed) {
      for (const error of validation.errors) console.error(`Fout: ${error}`);
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
