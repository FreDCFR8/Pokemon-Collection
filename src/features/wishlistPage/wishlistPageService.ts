import { createBrowserSupabaseClient } from '../../lib/supabase';
import { checkCollectionReadiness } from '../collections';
import { getCardDetailSetMetadata } from '../cardDetail/cardDetailSetMetadataService';
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

function safeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function safeErrorMessage(message: string | undefined): string {
  return (message || 'Onbekende wishlistfout.')
    .replace(/https?:\/\/\S+/g, '[url verborgen]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, '[id verborgen]')
    .slice(0, 240);
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

export async function loadWishlistPage(requestedPage = 1): Promise<WishlistPageState> {
  const page = Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : 1;
  const readiness = await checkCollectionReadiness();
  if (readiness.status !== 'collection-ready' || !readiness.mainCollection?.id) {
    return unavailableState(readiness.status === 'collection-ready' ? 'error' : readiness.status, readiness.message, page);
  }

  const collectionId = readiness.mainCollection.id;
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return unavailableState('config-missing', 'Wishlist kan niet starten omdat de publieke Supabase-configuratie ontbreekt.', page, collectionId);

  const countResult = await supabase
    .from('cards_catalog')
    .select('id, collection_cards!inner(id)', { count: 'exact', head: true })
    .eq('collection_cards.collection_id', collectionId)
    .eq('collection_cards.status', 'wishlist');

  if (countResult.error) {
    return unavailableState('error', 'Wishlistkaarten tellen is mislukt.', page, collectionId, safeErrorMessage(countResult.error.message));
  }

  const totalCount = countResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / WISHLIST_PAGE_SIZE));
  const safePage = getSafeWishlistPageAfterRemoval(page, totalCount);
  const range = getWishlistPageRange(safePage);

  const { data, error } = await supabase
    .from('cards_catalog')
    .select('id, pokemon, set_name, set_code, number, rarity, image_small, image_large, collection_cards!inner(id)')
    .eq('collection_cards.collection_id', collectionId)
    .eq('collection_cards.status', 'wishlist')
    .order('pokemon', { ascending: true })
    .order('set_name', { ascending: true })
    .order('number', { ascending: true })
    .order('id', { ascending: true })
    .range(range.from, range.to);

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
    message: (countResult.count ?? 0) > 0 ? 'Wishlistkaarten geladen.' : 'Nog geen kaarten op de wishlist.',
    totalCount,
    page: safePage,
    pageSize: WISHLIST_PAGE_SIZE,
    cards: cards.map((card) => ({ ...card, ...(setMetadata.get(card.setCode ?? '') ?? {}) })),
    collectionId,
  };
}
