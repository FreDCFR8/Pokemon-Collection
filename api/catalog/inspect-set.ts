const DEFAULT_SET_ID = "sv3pt5";
const MAX_SET_ID_LENGTH = 40;
const SET_ID_PATTERN = /^[A-Za-z0-9-]+$/;
const POKEMON_TCG_API_BASE_URL = "https://api.pokemontcg.io/v2";
const REQUEST_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 250;
const MAX_PAGES = 10;

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

type PokemonSet = {
  id?: string;
  name?: string;
  series?: string;
  printedTotal?: number;
  total?: number;
  releaseDate?: string;
  updatedAt?: string;
};

type PokemonCard = {
  id?: string;
  name?: string;
  number?: string;
  rarity?: string;
  images?: {
    small?: string;
    large?: string;
  };
};

type SetApiResponse = {
  data?: PokemonSet;
};

type CardsApiResponse = {
  data?: PokemonCard[];
  page?: number;
  pageSize?: number;
  count?: number;
  totalCount?: number;
};

class UpstreamError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function jsonResponse(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      ...headers,
    },
  });
}

function validateSetId(setId: string): boolean {
  return setId.length > 0 && setId.length <= MAX_SET_ID_LENGTH && SET_ID_PATTERN.test(setId);
}

function upstreamStatusToResponseStatus(status: number): number {
  if (status === 404) return 404;
  if (status === 429) return 503;
  return 502;
}

async function fetchPokemonTcgApi<T>(path: string, params: URLSearchParams, apiKey: string): Promise<T> {
  const url = new URL(`${POKEMON_TCG_API_BASE_URL}${path}`);
  params.forEach((value, key) => url.searchParams.set(key, value));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "X-Api-Key": apiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new UpstreamError(response.status, "Pokémon TCG API request failed.");
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function compareCardNumbers(left: string, right: string): number {
  const leftNumber = Number.parseInt(left, 10);
  const rightNumber = Number.parseInt(right, 10);

  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });
}

function summarizeCards(cards: PokemonCard[]) {
  const ids = cards.map((card) => card.id).filter((id): id is string => Boolean(id));
  const uniqueIds = new Set(ids);
  const numbers = cards
    .map((card) => card.number)
    .filter((number): number is string => Boolean(number))
    .sort(compareCardNumbers);

  return {
    received: cards.length,
    uniqueIds: uniqueIds.size,
    duplicateIds: ids.length - uniqueIds.size,
    withName: cards.filter((card) => Boolean(card.name)).length,
    withNumber: numbers.length,
    withRarity: cards.filter((card) => Boolean(card.rarity)).length,
    withSmallImage: cards.filter((card) => Boolean(card.images?.small)).length,
    withLargeImage: cards.filter((card) => Boolean(card.images?.large)).length,
    lowestNumbers: numbers.slice(0, 10),
    highestNumbers: numbers.slice(-10).reverse(),
  };
}

async function fetchSetCards(setId: string, apiKey: string): Promise<PokemonCard[]> {
  const cards: PokemonCard[] = [];
  let page = 1;
  let totalCount: number | undefined;

  while (page <= MAX_PAGES) {
    const pageResponse = await fetchPokemonTcgApi<CardsApiResponse>(
      "/cards",
      new URLSearchParams({
        q: `set.id:${setId}`,
        page: String(page),
        pageSize: String(PAGE_SIZE),
        orderBy: "number",
        select: "id,name,number,rarity,supertype,subtypes,images,set",
      }),
      apiKey,
    );

    const pageCards = Array.isArray(pageResponse.data) ? pageResponse.data : [];
    cards.push(...pageCards);
    totalCount = pageResponse.totalCount;

    if (typeof totalCount !== "number" || cards.length >= totalCount || pageCards.length === 0) {
      break;
    }

    page += 1;
  }

  return cards;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed." }, { Allow: "GET" });
  }

  if (process.env.VERCEL_ENV === "production") {
    return jsonResponse(404, { error: "Not found." });
  }

  const apiKey = process.env.POKEMON_TCG_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "Pokémon TCG API inspection is not configured." });
  }

  const requestUrl = new URL(request.url);
  const setId = requestUrl.searchParams.get("setId") ?? DEFAULT_SET_ID;

  if (!validateSetId(setId)) {
    return jsonResponse(400, { error: "Invalid setId." });
  }

  try {
    const setResponse = await fetchPokemonTcgApi<SetApiResponse>(
      `/sets/${encodeURIComponent(setId)}`,
      new URLSearchParams({
        select: "id,name,series,printedTotal,total,releaseDate,updatedAt,images",
      }),
      apiKey,
    );
    const cards = await fetchSetCards(setId, apiKey);
    const set = setResponse.data ?? {};

    return jsonResponse(200, {
      source: "pokemon_tcg_api",
      readOnly: true,
      set: {
        id: set.id ?? setId,
        name: set.name ?? null,
        series: set.series ?? null,
        printedTotal: set.printedTotal ?? null,
        total: set.total ?? null,
        releaseDate: set.releaseDate ?? null,
        updatedAt: set.updatedAt ?? null,
      },
      cards: summarizeCards(cards),
      sample: cards.slice(0, 10).map((card) => ({
        id: card.id ?? null,
        name: card.name ?? null,
        number: card.number ?? null,
        rarity: card.rarity ?? null,
        imageSmall: card.images?.small ?? null,
        imageLarge: card.images?.large ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof UpstreamError) {
      return jsonResponse(upstreamStatusToResponseStatus(error.status), {
        error: "Unable to inspect Pokémon TCG API data.",
      });
    }

    if (error instanceof Error && error.name === "AbortError") {
      return jsonResponse(502, { error: "Pokémon TCG API request timed out." });
    }

    return jsonResponse(500, { error: "Unexpected inspection error." });
  }
}
