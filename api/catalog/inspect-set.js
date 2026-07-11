const DEFAULT_SET_ID = "sv3pt5";
const MAX_SET_ID_LENGTH = 40;
const SET_ID_PATTERN = /^[A-Za-z0-9-]+$/;
const POKEMON_TCG_API_BASE_URL = "https://api.pokemontcg.io/v2";
const REQUEST_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 250;
const MAX_PAGES = 10;

class UpstreamError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, body, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");

  for (const [name, value] of Object.entries(extraHeaders)) {
    response.setHeader(name, value);
  }

  response.end(JSON.stringify(body));
}

function validateSetId(setId) {
  return setId.length > 0 && setId.length <= MAX_SET_ID_LENGTH && SET_ID_PATTERN.test(setId);
}

function upstreamStatusToResponseStatus(status) {
  if (status === 404) return 404;
  if (status === 429) return 503;
  return 502;
}

async function fetchPokemonTcgApi(path, params, apiKey) {
  const url = new URL(`${POKEMON_TCG_API_BASE_URL}${path}`);
  params.forEach((value, key) => url.searchParams.set(key, value));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(url, {
      headers: {
        "X-Api-Key": apiKey,
      },
      signal: controller.signal,
    });

    if (!upstreamResponse.ok) {
      throw new UpstreamError(upstreamResponse.status, "Pokémon TCG API request failed.");
    }

    return await upstreamResponse.json();
  } finally {
    clearTimeout(timeout);
  }
}

function compareCardNumbers(left, right) {
  const leftNumber = Number.parseInt(left, 10);
  const rightNumber = Number.parseInt(right, 10);

  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });
}

function summarizeCards(cards) {
  const ids = cards.map((card) => card.id).filter(Boolean);
  const uniqueIds = new Set(ids);
  const numbers = cards.map((card) => card.number).filter(Boolean).sort(compareCardNumbers);

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

async function fetchSetCards(setId, apiKey) {
  const cards = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const pageResponse = await fetchPokemonTcgApi(
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

    if (
      typeof pageResponse.totalCount !== "number" ||
      cards.length >= pageResponse.totalCount ||
      pageCards.length === 0
    ) {
      break;
    }

    page += 1;
  }

  return cards;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET" });
    return;
  }

  if (process.env.VERCEL_ENV === "production") {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  const apiKey = process.env.POKEMON_TCG_API_KEY;
  if (!apiKey) {
    sendJson(response, 500, { error: "Pokémon TCG API inspection is not configured." });
    return;
  }

  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  const setId = requestUrl.searchParams.get("setId") ?? DEFAULT_SET_ID;

  if (!validateSetId(setId)) {
    sendJson(response, 400, { error: "Invalid setId." });
    return;
  }

  try {
    const setResponse = await fetchPokemonTcgApi(
      `/sets/${encodeURIComponent(setId)}`,
      new URLSearchParams({
        select: "id,name,series,printedTotal,total,releaseDate,updatedAt,images",
      }),
      apiKey,
    );
    const cards = await fetchSetCards(setId, apiKey);
    const set = setResponse.data ?? {};

    sendJson(response, 200, {
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
      sendJson(response, upstreamStatusToResponseStatus(error.status), {
        error: "Unable to inspect Pokémon TCG API data.",
      });
      return;
    }

    if (error instanceof Error && error.name === "AbortError") {
      sendJson(response, 502, { error: "Pokémon TCG API request timed out." });
      return;
    }

    sendJson(response, 500, { error: "Unexpected inspection error." });
  }
}
