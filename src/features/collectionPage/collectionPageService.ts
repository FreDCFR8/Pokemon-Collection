import { createBrowserSupabaseClient } from '../../lib/supabase';
import { checkCollectionReadiness } from '../collections';
import { getCardDetailSetMetadata } from '../cardDetail/cardDetailSetMetadataService';
import { toCollectionPageCard, type CardsCatalogPageRow } from './collectionPageCardMapper';
import {
  COLLECTION_PAGE_SIZE,
  type CollectionFilterOptions,
  type CollectionPageFilters,
  type CollectionPageLoadOptions,
  type CollectionPageState,
} from './collectionPageTypes';


type SanitizedCollectionPageFilters = {
  rarity: string | null;
  setCode: string | null;
};

function toSafeErrorMessage(message: string | undefined): string {
  if (!message) {
    return 'Onbekende collectiepaginafout.';
  }

  return message
    .replace(/https?:\/\/\S+/g, '[url verborgen]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, '[id verborgen]')
    .slice(0, 240);
}

function normalizePage(page: number): number {
  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

function sanitizeSearchQuery(searchQuery: string | undefined): string | null {
  const sanitized = (searchQuery ?? '')
    .trim()
    .slice(0, 80)
    .replace(/[,%*_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized.length > 0 ? sanitized : null;
}


function sanitizeRarityFilter(value: string | undefined): string | null {
  const sanitized = (value ?? '').trim().slice(0, 80);

  return sanitized.length > 0 && !/[\0\r\n]/.test(sanitized) ? sanitized : null;
}

function sanitizeSetCodeFilter(value: string | undefined): string | null {
  const sanitized = (value ?? '').trim().slice(0, 40);

  return /^[A-Za-z0-9_-]+$/.test(sanitized) ? sanitized : null;
}

function sanitizeCollectionPageFilters(filters: CollectionPageFilters | undefined): SanitizedCollectionPageFilters {
  return {
    rarity: sanitizeRarityFilter(filters?.rarity),
    setCode: sanitizeSetCodeFilter(filters?.setCode),
  };
}


type CollectionFilterOptionsRpcSet = {
  set_code?: unknown;
  name?: unknown;
};

type CollectionFilterOptionsRpcResponse = {
  sets?: unknown;
  rarities?: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeRpcText(value: unknown, maxLength = 120): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const sanitized = value.trim().slice(0, maxLength);

  return sanitized.length > 0 && !/[\0\r\n]/.test(sanitized) ? sanitized : null;
}

function toCollectionFilterOptions(response: unknown): CollectionFilterOptions {
  const payload = isPlainObject(response) ? (response as CollectionFilterOptionsRpcResponse) : {};
  const setRows = Array.isArray(payload.sets) ? payload.sets : [];
  const rarityRows = Array.isArray(payload.rarities) ? payload.rarities : [];

  const setsByCode = new Map<string, string>();

  for (const row of setRows) {
    if (!isPlainObject(row)) {
      continue;
    }

    const setCode = sanitizeSetCodeFilter((row as CollectionFilterOptionsRpcSet).set_code as string | undefined);
    const name = sanitizeRpcText((row as CollectionFilterOptionsRpcSet).name);

    if (setCode && name) {
      setsByCode.set(setCode, name);
    }
  }

  const rarities = [...new Set(rarityRows.map((rarity) => sanitizeRpcText(rarity, 80)).filter((rarity): rarity is string => rarity !== null))].sort((firstRarity, secondRarity) =>
    firstRarity.localeCompare(secondRarity, 'nl', { sensitivity: 'base' }),
  );

  const sets = [...setsByCode.entries()]
    .map(([setCode, name]) => ({ setCode, name }))
    .sort((firstSet, secondSet) => firstSet.name.localeCompare(secondSet.name, 'nl', { sensitivity: 'base' }));

  return { sets, rarities };
}

export async function getCollectionFilterOptions(collectionId: string, filters: CollectionPageFilters = {}): Promise<CollectionFilterOptions> {
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    throw new Error('Collectiefilters kunnen niet worden opgehaald omdat de publieke Supabase configuratie ontbreekt.');
  }

  const { data, error } = await supabase.rpc('get_collection_filter_options', {
    p_collection_id: collectionId,
    p_set_code: sanitizeSetCodeFilter(filters.setCode),
    p_rarity: sanitizeRarityFilter(filters.rarity),
  });

  if (error) {
    throw new Error(`Slimme collectiefilters ophalen is mislukt: ${error.message}`);
  }

  return toCollectionFilterOptions(data);
}

function applyCollectionFilters<
  T extends {
    eq: (column: string, value: string) => T;
  },
>(query: T, filters: SanitizedCollectionPageFilters): T {
  let filteredQuery = query;

  if (filters.rarity) {
    filteredQuery = filteredQuery.eq('rarity', filters.rarity);
  }

  if (filters.setCode) {
    filteredQuery = filteredQuery.eq('set_code', filters.setCode);
  }

  return filteredQuery;
}

function applyCollectionSearchFilter<T extends { or: (filters: string) => T }>(query: T, searchQuery: string | null): T {
  if (!searchQuery) {
    return query;
  }

  const pattern = `%${searchQuery}%`;

  return query.or(`pokemon.ilike.${pattern},set_name.ilike.${pattern},number.ilike.${pattern}`);
}

export async function loadCollectionPage(
  requestedPage: number,
  options: CollectionPageLoadOptions = {},
): Promise<CollectionPageState> {
  const page = normalizePage(requestedPage);
  const searchQuery = sanitizeSearchQuery(options.searchQuery);
  const filters = sanitizeCollectionPageFilters(options.filters);
  const collectionReadiness = await checkCollectionReadiness();

  if (collectionReadiness.status !== 'collection-ready') {
    return {
      status: collectionReadiness.status === 'error' ? 'error' : collectionReadiness.status,
      message:
        collectionReadiness.status === 'error'
          ? 'Collectiepagina kan niet starten omdat de collectiecontrole is mislukt.'
          : collectionReadiness.message,
      totalCount: 0,
      page,
      pageSize: COLLECTION_PAGE_SIZE,
      cards: [],
      collectionId: null,
      errorMessage:
        collectionReadiness.status === 'error' ? toSafeErrorMessage(collectionReadiness.errorMessage) : undefined,
    };
  }

  const mainCollectionId = collectionReadiness.mainCollection?.id;

  if (!mainCollectionId) {
    return {
      status: 'collection-missing',
      message: 'Er is nog geen hoofdcollectie gekoppeld aan dit profiel.',
      totalCount: 0,
      page,
      pageSize: COLLECTION_PAGE_SIZE,
      cards: [],
      collectionId: null,
    };
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return {
      status: 'config-missing',
      message: 'Collectiepagina kan niet starten omdat de publieke Supabase configuratie ontbreekt.',
      totalCount: 0,
      page,
      pageSize: COLLECTION_PAGE_SIZE,
      cards: [],
      collectionId: null,
    };
  }

  const countQuery = supabase
    .from('cards_catalog')
    .select(
      `
        id,
        collection_cards!inner (
          id
        )
      `,
      { count: 'exact', head: true },
    )
    .eq('collection_cards.collection_id', mainCollectionId);

  const { count, error: countError } = await applyCollectionSearchFilter(applyCollectionFilters(countQuery, filters), searchQuery);

  if (countError) {
    return {
      status: 'error',
      message: 'Collectiekaarten tellen is mislukt.',
      totalCount: 0,
      page,
      pageSize: COLLECTION_PAGE_SIZE,
      cards: [],
      collectionId: mainCollectionId,
      errorMessage: toSafeErrorMessage(countError.message),
    };
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / COLLECTION_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * COLLECTION_PAGE_SIZE;
  const to = from + COLLECTION_PAGE_SIZE - 1;

  const pageQuery = supabase
    .from('cards_catalog')
    .select(
      `
        id,
        pokemon,
        set_name,
        set_code,
        number,
        rarity,
        image_small,
        image_large,
        collection_cards!inner (
          quantity,
          condition,
          status
        )
      `,
    )
    .eq('collection_cards.collection_id', mainCollectionId)
    .order('pokemon', { ascending: true })
    .order('set_name', { ascending: true })
    .order('number', { ascending: true })
    .range(from, to);

  const { data, error } = await applyCollectionSearchFilter(applyCollectionFilters(pageQuery, filters), searchQuery);

  if (error) {
    return {
      status: 'error',
      message: 'Collectiepagina laden is mislukt.',
      totalCount,
      page: safePage,
      pageSize: COLLECTION_PAGE_SIZE,
      cards: [],
      collectionId: mainCollectionId,
      errorMessage: toSafeErrorMessage(error.message),
    };
  }

  const cards = ((data ?? []) as CardsCatalogPageRow[]).flatMap((row) => {
    const card = toCollectionPageCard(row);
    return card ? [card] : [];
  });
  const setMetadata = await getCardDetailSetMetadata(cards.map((card) => card.setCode));

  return {
    status: 'ready',
    message: totalCount > 0 ? 'Collectiekaarten geladen.' : 'Nog geen kaarten in deze collectie.',
    totalCount,
    page: safePage,
    pageSize: COLLECTION_PAGE_SIZE,
    cards: cards.map((card) => ({ ...card, ...(setMetadata.get(card.setCode ?? '') ?? {}) })),
    collectionId: mainCollectionId,
  };
}
