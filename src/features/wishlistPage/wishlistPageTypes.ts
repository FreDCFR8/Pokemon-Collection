import type { CollectionPageStatus } from '../collectionPage/collectionPageTypes';

export const WISHLIST_PAGE_SIZE = 24;

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
  cards: WishlistPageCard[];
  collectionId: string | null;
  errorMessage?: string;
};
