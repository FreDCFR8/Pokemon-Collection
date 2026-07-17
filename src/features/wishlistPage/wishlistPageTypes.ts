import type { CollectionPageStatus } from '../collectionPage/collectionPageTypes';
import type { ConfirmedOwnership } from '../collectionCards/collectionCardOwnershipTypes';

export const WISHLIST_PAGE_SIZE = 24;

export function getWishlistVisibleRange(totalCount: number, page: number, pageSize = WISHLIST_PAGE_SIZE): { first: number; last: number } {
  const safeCount = Number.isFinite(totalCount) && totalCount > 0 ? Math.floor(totalCount) : 0;
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : WISHLIST_PAGE_SIZE;
  if (safeCount === 0) return { first: 0, last: 0 };

  return {
    first: (safePage - 1) * safePageSize + 1,
    last: Math.min(safePage * safePageSize, safeCount),
  };
}

export function getWishlistPageRange(page: number, pageSize = WISHLIST_PAGE_SIZE): { from: number; to: number } {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : WISHLIST_PAGE_SIZE;
  return { from: (safePage - 1) * safePageSize, to: safePage * safePageSize - 1 };
}

export function getSafeWishlistPageAfterRemoval(currentPage: number, remainingCount: number, pageSize = WISHLIST_PAGE_SIZE): number {
  const safePage = Number.isFinite(currentPage) && currentPage >= 1 ? Math.floor(currentPage) : 1;
  const safeCount = Number.isFinite(remainingCount) && remainingCount >= 0 ? Math.floor(remainingCount) : 0;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : WISHLIST_PAGE_SIZE;
  return Math.min(safePage, Math.max(1, Math.ceil(safeCount / safePageSize)));
}

export type WishlistRemovalRecovery = 'close' | 'retry-remove' | 'blocked';

export type WishlistMutationOperation = 'remove-wishlist' | 'promote-wishlist';

export type WishlistDetailRequestContext = {
  mutationRequestId: number;
  cardCatalogId: string;
  collectionId: string;
  page: number;
};

export function shouldApplyWishlistDetailResponse(
  expected: WishlistDetailRequestContext,
  current: WishlistDetailRequestContext,
): boolean {
  return expected.mutationRequestId === current.mutationRequestId &&
    expected.cardCatalogId === current.cardCatalogId &&
    expected.collectionId === current.collectionId &&
    expected.page === current.page;
}

export function resolveWishlistRemovalRecovery(ownership: ConfirmedOwnership | null): WishlistRemovalRecovery {
  if (!ownership || ownership.kind === 'conflict') return 'blocked';
  if (ownership.kind === 'absent' || ownership.value.byStatus.wishlist.length === 0) return 'close';
  if (ownership.value.byStatus.wishlist.length === 1) return 'retry-remove';
  return 'blocked';
}

export type WishlistPageCard = {
  cardCatalogId: string;
  pokemon: string | null;
  setName: string | null;
  setCode: string | null;
  series?: string | null;
  releaseDate?: string | null;
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
