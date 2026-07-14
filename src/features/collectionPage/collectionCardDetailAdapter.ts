import type {
  CardDetailCapabilities,
  CardDetailCard,
  CardDetailMutationState,
  CardDetailProductCopy,
} from '../cardDetail';
import { createCardDetailOwnershipPresentation } from '../cardDetail/cardDetailOwnershipPresentation.ts';
import type {
  CollectionCardMutationRecord,
  CollectionOwnershipState,
  ConfirmedOwnership,
  DecreaseCollectionCardQuantityMutationResult,
} from '../collectionCards';
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

function isSingleManageableOwnedNearMint(ownership: ConfirmedOwnership | undefined): boolean {
  if (ownership?.kind !== 'snapshot') {
    return false;
  }

  const { byStatus, manageableOwnedNearMintRecord } = ownership.value;

  return Boolean(
    manageableOwnedNearMintRecord &&
      byStatus.owned.length === 1 &&
      byStatus.wishlist.length === 0 &&
      byStatus.trade.length === 0 &&
      byStatus.missing.length === 0,
  );
}

export function createCollectionCardDetailCapabilities(
  ownership: CollectionOwnershipState,
  mutationStatus: CardDetailMutationState['status'] = 'idle',
): CardDetailCapabilities {
  const manageable = ownership.status === 'ready' &&
    mutationStatus !== 'pending' &&
    mutationStatus !== 'conflict' &&
    isSingleManageableOwnedNearMint(ownership.value);

  return {
    canAdd: false,
    canIncrease: manageable,
    canDecrease: manageable,
    unavailableReason: manageable
      ? undefined
      : ownership.status === 'error' || ownership.status === 'loading'
        ? 'Status onbekend. Laad de collectiestatus opnieuw.'
        : 'Quantitybeheer is alleen beschikbaar voor één owned Near Mint-kaart.',
  };
}

export type CollectionCardDetailQuantityMutationResult =
  | { kind: 'updated'; card: CollectionCardMutationRecord }
  | { kind: 'deleted'; collectionCardId: string };

export function mapCollectionCardDetailIncreaseResult(
  result: CollectionCardMutationRecord,
): CollectionCardDetailQuantityMutationResult {
  return { kind: 'updated', card: result };
}

export function mapCollectionCardDetailDecreaseResult(
  result: DecreaseCollectionCardQuantityMutationResult,
): CollectionCardDetailQuantityMutationResult {
  return result.action === 'deleted'
    ? { kind: 'deleted', collectionCardId: result.collectionCardId }
    : { kind: 'updated', card: result.card };
}

export function getCollectionCardDetailQuantityFromMutation(
  result: CollectionCardDetailQuantityMutationResult,
): number | null {
  return result.kind === 'updated' ? result.card.quantity : null;
}

export type CollectionCardDetailMutationExpectation = {
  collectionId: string;
  collectionCardId: string;
  cardCatalogId: string;
  expectedQuantity: number;
};

export class CollectionCardDetailInvalidResultError extends Error {
  readonly reason = 'invalid-result' as const;

  constructor() {
    super('De teruggegeven collectiestatus wijkt af van de verwachte kaartwijziging.');
    this.name = 'CollectionCardDetailInvalidResultError';
  }
}

export function validateCollectionCardDetailMutationResult(
  result: CollectionCardDetailQuantityMutationResult,
  expected: CollectionCardDetailMutationExpectation,
): CollectionCardDetailQuantityMutationResult {
  const isValid = result.kind === 'updated'
    ? result.card.collectionId === expected.collectionId &&
      result.card.collectionCardId === expected.collectionCardId &&
      result.card.cardCatalogId === expected.cardCatalogId &&
      result.card.quantity === expected.expectedQuantity
    : result.collectionCardId === expected.collectionCardId;

  if (!isValid) {
    throw new CollectionCardDetailInvalidResultError();
  }

  return result;
}
