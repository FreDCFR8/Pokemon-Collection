export const CATALOG_SEARCH_PAGE_SIZE = 24;
export const CATALOG_SEARCH_MIN_LENGTH = 3;
export const CATALOG_SEARCH_MAX_LENGTH = 80;

export type CatalogSearchCard = {
  id: string;
  pokemon: string | null;
  setName: string | null;
  setCode: string | null;
  number: string | null;
  rarity: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
};
export type CatalogSearchResult = {
  cards: CatalogSearchCard[];
  totalCount: number;
  page: number;
  pageSize: typeof CATALOG_SEARCH_PAGE_SIZE;
};
