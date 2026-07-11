import { createBrowserSupabaseClient } from '../../lib/supabase';
import { checkCollectionReadiness } from '../collections';
import {
  COLLECTION_PAGE_SIZE,
  type CollectionPageCard,
  type CollectionPageFilters,
  type CollectionPageLoadOptions,
  type CollectionPageState,
} from './collectionPageTypes';


type SanitizedCollectionPageFilters = {
  rarity: string | null;
  setCode: string | null;
};

const ALLOWED_RARITY_FILTERS = new Set([
  'ACE SPEC Rare',
  'Black White Rare',
  'Common',
  'Double Rare',
  'Holo Rare',
  'Hyper Rare',
  'Illustration Rare',
  'MEGA_ATTACK_RARE',
  'Onbekend',
  'Promo',
  'Radiant Rare',
  'Rare',
  'Rare Holo',
  'Rare Holo V',
  'Rare Holo VMAX',
  'Rare Holo VSTAR',
  'Rare Rainbow',
  'Rare Ultra',
  'Shiny Rare',
  'Shiny Ultra Rare',
  'Special Illustration Rare',
  'Trainer Gallery Rare Holo',
  'Ultra Rare',
  'Uncommon',
]);

type CardsCatalogPageRow = {
  pokemon: string | null;
  set_name: string | null;
  set_code: string | null;
  number: string | null;
  rarity: string | null;
  image_small: string | null;
  collection_cards:
    | {
        quantity: number | null;
        condition: string | null;
        status: string | null;
      }
    | {
        quantity: number | null;
        condition: string | null;
        status: string | null;
      }[]
    | null;
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

function firstOwnershipRow(row: CardsCatalogPageRow['collection_cards']) {
  if (Array.isArray(row)) {
    return row[0] ?? null;
  }

  return row;
}

function toCollectionPageCard(row: CardsCatalogPageRow): CollectionPageCard {
  const ownership = firstOwnershipRow(row.collection_cards);

  return {
    pokemon: row.pokemon ?? null,
    setName: row.set_name ?? null,
    number: row.number ?? null,
    rarity: row.rarity ?? null,
    imageSmall: row.image_small ?? null,
    quantity: ownership?.quantity ?? null,
    condition: ownership?.condition ?? null,
    status: ownership?.status ?? null,
  };
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


function sanitizeExactFilterValue(value: string | undefined, allowedValues: Set<string>): string | null {
  const sanitized = (value ?? '').trim().slice(0, 40);

  return allowedValues.has(sanitized) ? sanitized : null;
}

function sanitizeSetCodeFilter(value: string | undefined): string | null {
  const sanitized = (value ?? '').trim().slice(0, 40);

  return /^[A-Za-z0-9_-]+$/.test(sanitized) ? sanitized : null;
}

function sanitizeCollectionPageFilters(filters: CollectionPageFilters | undefined): SanitizedCollectionPageFilters {
  return {
    rarity: sanitizeExactFilterValue(filters?.rarity, ALLOWED_RARITY_FILTERS),
    setCode: sanitizeSetCodeFilter(filters?.setCode),
  };
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
        pokemon,
        set_name,
        set_code,
        number,
        rarity,
        image_small,
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
      errorMessage: toSafeErrorMessage(error.message),
    };
  }

  return {
    status: 'ready',
    message: totalCount > 0 ? 'Collectiekaarten geladen.' : 'Nog geen kaarten in deze collectie.',
    totalCount,
    page: safePage,
    pageSize: COLLECTION_PAGE_SIZE,
    cards: ((data ?? []) as CardsCatalogPageRow[]).map(toCollectionPageCard),
  };
}
