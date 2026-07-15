import type { CollectionOwnershipState, ConfirmedOwnership } from '../collectionCards';

export type CatalogSearchRequestContext = { requestId: number; term: string; page: number };
export type CatalogSearchDetailContext = { requestId: number; searchRequestId: number; cardCatalogId: string };

export function shouldApplyCatalogSearchContext(active: CatalogSearchRequestContext | null, completed: CatalogSearchRequestContext): boolean {
  return Boolean(active && active.requestId === completed.requestId && active.term === completed.term && active.page === completed.page);
}

export function shouldApplyCatalogSearchDetailContext(active: CatalogSearchDetailContext | null, completed: CatalogSearchDetailContext): boolean {
  return Boolean(active && active.requestId === completed.requestId && active.searchRequestId === completed.searchRequestId && active.cardCatalogId === completed.cardCatalogId);
}

export function toCatalogSearchDetailOwnershipState(ownership: ConfirmedOwnership | undefined, ownershipState: 'loading' | 'ready' | 'error'): CollectionOwnershipState {
  if (ownership) return { status: 'ready', value: ownership };
  return ownershipState === 'loading' ? { status: 'loading' } : { status: 'error', retryable: true };
}

export function getSafeCatalogSearchErrorMessage(): string {
  return 'Zoeken is tijdelijk niet beschikbaar. Probeer het opnieuw.';
}
