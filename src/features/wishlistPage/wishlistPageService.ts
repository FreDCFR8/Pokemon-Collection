import { createBrowserSupabaseClient } from '../../lib/supabase';
import { checkCollectionReadiness } from '../collections';
import { getCardDetailSetMetadata } from '../cardDetail/cardDetailSetMetadataService';
import type { CollectionFilterOptions, CollectionPageFilters } from '../collectionPage/collectionPageTypes';
import { getSafeWishlistPageAfterRemoval, getWishlistPageRange, WISHLIST_PAGE_SIZE, type WishlistPageCard, type WishlistPageState } from './wishlistPageTypes';

type WishlistCatalogRow = {
  id: unknown;
  pokemon: unknown;
  set_name: unknown;
  set_code: unknown;
  number: unknown;
  rarity: unknown;
  image_small: unknown;
  image_large: unknown;
};

type WishlistFilterRow = {
  set_code: unknown;
  set_name: unknown;
  rarity: unknown;
};

export type WishlistPageLoadOptions = {
  searchQuery?: string;
  filters?: CollectionPageFilters;
};

type SanitizedWishlistFilters = {
  rarity: string | null;
  setCode: string | null;
};

function safeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function safeErrorMessage(message: string | undefined): string {
  return (message || 'Onbekende wishlistfout.')
    .replace(/https?:\/\/\S+/g, '[url verborgen]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, '[id verborgen]')
    .slice(0, 240);
}

function sanitizeSearchQuery(value: string | undefined): string | null {
  const sanitized = (value ?? '')
    .trim()
    .slice(0, 80)
    .replace(/[,%*_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized.length > 0 ? sanitized : null;
}

function sanitizeRarity(value: string | undefined): string | null {
  const sanitized = (value ?? '').trim().slice(0, 80);
  return sanitized.length > 0 && !/[\0\r\n]/.test(sanitized) ? sanitized : null;
}

function sanitizeSetCode(value: string | undefined): string | null {
  const sanitized = (value ?? '').trim().slice(0, 40);
  return /^[A-Za-z0-9_-]+$/.test(sanitized) ? sanitized : null;
}

function sanitizeFilters(filters: CollectionPageFilters | undefined): SanitizedWishlistFilters {
  return {
    rarity: sanitizeRarity(filters?.rarity),
    setCode: sanitizeSetCode(filters?.setCode),
  };
}

function applyFilters<T extends { eq: (column: string, value: string) => T }>(query: T, filters: SanitizedWishlistFilters): T {
  let nextQuery = query;
  if (filters.rarity) nextQuery = nextQuery.eq('rarity', filters.rarity);
  if (filters.setCode) nextQuery = nextQuery.eq('set_code', filters.setCode);
  return nextQuery;
}

function applySearch<T extends { or: (filters: string) => T }>(query: T, searchQuery: string | null): T {
  if (!searchQuery) return query;
  const pattern = `%${searchQuery}%`;
  return query.or(`pokemon.ilike.${pattern},set_name.ilike.${pattern},number.ilike.${pattern}`);
}

function toWishlistPageCard(row: WishlistCatalogRow): WishlistPageCard | null {
  const cardCatalogId = safeText(row.id);
  if (!cardCatalogId) return null;

  return {
    cardCatalogId,
    pokemon: safeText(row.pokemon),
    setName: safeText(row.set_name),
    setCode: safeText(row.set_code),
    number: safeText(row.number),
    rarity: safeText(row.rarity),
    imageSmall: safeText(row.image_small),
    imageLarge: safeText(row.image_large),
  };
}

function unavailableState(status: WishlistPageState['status'], message: string, page: number, collectionId: string | null = null, errorMessage?: string): WishlistPageState {
  return { status, message, totalCount: 0, page, pageSize: WISHLIST_PAGE_SIZE, cards: [], collectionId, errorMessage };
}

export async function getWishlistFilterOptions(
  collectionId: string,
  filters: CollectionPageFilters = {},
): Promise<CollectionFilterOptions> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) throw new Error('Wishlistfilters kunnen niet worden opgehaald omdat de publieke Supabase-configuratie ontbreekt.');

  const sanitized = sanitizeFilters(filters);
  let query = supabase
    .from('cards_catalog')
    .select('set_code, set_name, rarity, collection_cards!inner(id)')
    .eq('collection_cards.collection_id', collectionId)
    .eq('collection_cards.status', 'wishlist')
    .limit(1000);

  if (sanitized.rarity) query = query.eq('rarity', sanitized.rarity);

  const { data, error } = await query;
  if (error) throw new Error(`Wishlistfilters ophalen is mislukt: ${error.message}`);

  const rows = (data ?? []) as WishlistFilterRow[];
  const setsByCode = new Map<string, string>();
  const rarities = new Set<string>();

  for (const row of rows) {
    const setCode = safeText(row.set_code);
    const setName = safeText(row.set_name);
    const rarity = safeText(row.rarity);
    if (setCode && setName) setsByCode.set(setCode, setName);
    if (!sanitized.setCode || setCode === sanitized.setCode) {
      if (rarity) rarities.add(rarity);
    }
  }

  return {
    sets: [...setsByCode.entries()]
      .map(([setCode, name]) => ({ setCode, name }))
      .sort((first, second) => first.name.localeCompare(second.name, 'nl', { sensitivity: 'base' })),
    rarities: [...rarities].sort((first, second) => first.localeCompare(second, 'nl', { sensitivity: 'base' })),
  };
}

export async function loadWishlistPage(
  requestedPage = 1,
  options: WishlistPageLoadOptions = {},
): Promise<WishlistPageState> {
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1;
  const searchQuery = sanitizeSearchQuery(options.searchQuery);
  const filters = sanitizeFilters(options.filters);
  const readiness = await checkCollectionReadiness();
  if (readiness.status !== 'collection-ready' || !readiness.mainCollection?.id) {
    return unavailableState(readiness.status === 'collection-ready' ? 'error' : readiness.status, readiness.message, page);
  }

  const collectionId = readiness.mainCollection.id;
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return unavailableState('config-missing', 'Wishlist kan niet starten omdat de publieke Supabase-configuratie ontbreekt.', page, collectionId);

  const countQuery = supabase
    .from('cards_catalog')
    .select('id, collection_cards!inner(id)', { count: 'exact', head: true })
    .eq('collection_cards.collection_id', collectionId)
    .eq('collection_cards.status', 'wishlist');

  const countResult = await applySearch(applyFilters(countQuery, filters), searchQuery);

  if (countResult.error) {
    return unavailableState('error', 'Wishlistkaarten tellen is mislukt.', page, collectionId, safeErrorMessage(countResult.error.message));
  }

  const totalCount = countResult.count ?? 0;
  const safePage = getSafeWishlistPageAfterRemoval(page, totalCount);
  const range = getWishlistPageRange(safePage);

  const pageQuery = supabase
    .from('cards_catalog')
    .select('id, pokemon, set_name, set_code, number, rarity, image_small, image_large, collection_cards!inner(id)')
    .eq('collection_cards.collection_id', collectionId)
    .eq('collection_cards.status', 'wishlist')
    .order('pokemon', { ascending: true })
    .order('set_name', { ascending: true })
    .order('number', { ascending: true })
    .order('id', { ascending: true })
    .range(range.from, range.to);

  const { data, error } = await applySearch(applyFilters(pageQuery, filters), searchQuery);

  if (error) {
    return unavailableState('error', 'Wishlistkaarten laden is mislukt.', safePage, collectionId, safeErrorMessage(error.message));
  }

  const cards = ((data ?? []) as WishlistCatalogRow[]).flatMap((row) => {
    const card = toWishlistPageCard(row);
    return card ? [card] : [];
  });
  const setMetadata = await getCardDetailSetMetadata(cards.map((card) => card.setCode));

  return {
    status: 'ready',
    message: totalCount > 0 ? 'Wishlistkaarten geladen.' : 'Geen wishlistkaarten gevonden.',
    totalCount,
    page: safePage,
    pageSize: WISHLIST_PAGE_SIZE,
    cards: cards.map((card) => ({ ...card, ...(setMetadata.get(card.setCode ?? '') ?? {}) })),
    collectionId,
  };
}
