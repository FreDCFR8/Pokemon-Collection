import type { CardDetailCard, CardDetailProductCopy } from '../cardDetail';
import { createCardDetailOwnershipPresentation } from '../cardDetail/cardDetailOwnershipPresentation.ts';
import type { CollectionOwnershipState, ConfirmedOwnership } from '../collectionCards';
import type { CollectionPageCard } from './collectionPageTypes';

export type CollectionCardDetailRequest = {
  requestId: number;
  collectionId: string;
  cardCatalogId: string;
  page: number;
};

function hasStableId(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function toCollectionCardDetailCard(card: CollectionPageCard): CardDetailCard | null {
  if (!hasStableId(card.cardCatalogId)) {
    return null;
  }

  return {
    cardCatalogId: card.cardCatalogId.trim(),
    name: card.pokemon?.trim() || 'Onbekende kaart',
    number: card.number,
    set: { setCode: card.setCode, name: card.setName },
    rarity: card.rarity,
    images: { small: card.imageSmall, large: card.imageLarge },
  };
}

export function shouldApplyCollectionCardDetailResponse(
  activeRequest: CollectionCardDetailRequest | null,
  completedRequest: CollectionCardDetailRequest,
): boolean {
  return Boolean(
    activeRequest &&
      activeRequest.requestId === completedRequest.requestId &&
      activeRequest.collectionId === completedRequest.collectionId &&
      activeRequest.cardCatalogId === completedRequest.cardCatalogId &&
      activeRequest.page === completedRequest.page,
  );
}

export function getConfirmedOwnership(ownership: CollectionOwnershipState): ConfirmedOwnership | undefined {
  if (ownership.status === 'ready') return ownership.value;
  if (ownership.status === 'loading' || ownership.status === 'error') return ownership.previous;
  return undefined;
}

export function createCollectionCardDetailProductCopy(ownership: CollectionOwnershipState): CardDetailProductCopy {
  const confirmedOwnership = getConfirmedOwnership(ownership);
  const presentation = createCardDetailOwnershipPresentation({
    ownership: confirmedOwnership,
    includeConflictSnapshotStatusItems: true,
  });

  return {
    statusItems: presentation.statusItems,
    physicalPresenceLabel: presentation.physicalPresenceLabel,
    managementMessage: presentation.conflictMessage,
  };
}
