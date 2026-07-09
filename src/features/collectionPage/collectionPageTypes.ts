export const COLLECTION_PAGE_SIZE = 24;

export type CollectionPageStatus =
  | 'loading'
  | 'config-missing'
  | 'signed-out'
  | 'profile-missing'
  | 'collection-missing'
  | 'ready'
  | 'error';

export type CollectionPageCard = {
  pokemon: string | null;
  setName: string | null;
  number: string | null;
  rarity: string | null;
  imageSmall: string | null;
  quantity: number | null;
  condition: string | null;
  status: string | null;
};

export type CollectionPageFilters = {
  rarity?: string;
  condition?: string;
  status?: string;
};

export type CollectionPageLoadOptions = {
  searchQuery?: string;
  filters?: CollectionPageFilters;
};

export type CollectionPageState = {
  status: CollectionPageStatus;
  message: string;
  totalCount: number;
  page: number;
  pageSize: number;
  cards: CollectionPageCard[];
  errorMessage?: string;
};
