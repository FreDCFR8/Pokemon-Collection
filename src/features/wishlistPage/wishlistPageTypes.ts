import type { CollectionPageStatus } from '../collectionPage/collectionPageTypes';

export const WISHLIST_PAGE_SIZE = 24;

export function getWishlistPageRange(page: number, pageSize = WISHLIST_PAGE_SIZE): { from: number; to: number } {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : WISHLIST_PAGE_SIZE;
  return { from: (safePage - 1) * safePageSize, to: safePage * safePageSize - 1 };
}

export type WishlistPageCard = {
  cardCatalogId: string;
  pokemon: string | null;
  setName: string | null;
  setCode: string | null;
  number: string | null;
  rarity: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
};

export type WishlistPageState = {
  status: CollectionPageStatus;
  message: string;
  totalCount: number;
  page: number;
  pageSize: number;
  cards: WishlistPageCard[];
  collectionId: string | null;
  errorMessage?: string;
};

export function createWishlistPageLoadingState(page: number): WishlistPageState {
  return { status: 'loading', message: 'Wishlist wordt voorbereid.', totalCount: 0, page, pageSize: WISHLIST_PAGE_SIZE, cards: [], collectionId: null };
}

export function createWishlistPageErrorState(page: number, errorMessage: string): WishlistPageState {
  return { ...createWishlistPageLoadingState(page), status: 'error', message: 'Wishlist laden is mislukt.', errorMessage };
}
