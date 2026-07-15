import { CATALOG_SEARCH_MAX_LENGTH, CATALOG_SEARCH_MIN_LENGTH, CATALOG_SEARCH_PAGE_SIZE } from './catalogSearchTypes.ts';

export function normalizeCatalogSearchTerm(value: string): string {
  return value.trim().replace(/[^\p{L}\p{N}\s\-\/#]/gu, ' ').replace(/\s+/g, ' ').slice(0, CATALOG_SEARCH_MAX_LENGTH).trim();
}

export function isCatalogSearchTermValid(value: string): boolean {
  return normalizeCatalogSearchTerm(value).length >= CATALOG_SEARCH_MIN_LENGTH;
}

export function getCatalogSearchRange(page: number): { page: number; from: number; to: number } {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * CATALOG_SEARCH_PAGE_SIZE;
  return { page: safePage, from, to: from + CATALOG_SEARCH_PAGE_SIZE - 1 };
}

export function shouldApplyCatalogSearchResponse(activeRequestId: number, responseRequestId: number): boolean {
  return activeRequestId === responseRequestId;
}
