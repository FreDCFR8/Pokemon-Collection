import type { CardDetailCard, CardDetailProductCopy } from '../cardDetail/CardDetailDialog';
import type {
  CollectionOwnershipState,
  CollectionStatus,
  ConfirmedOwnership,
  OwnershipRecord,
} from '../collectionCards';
import type { CollectionPageCard } from './collectionPageTypes.ts';

const STATUS_LABELS: Record<CollectionStatus, string> = {
  owned: 'In collectie',
  wishlist: 'Op wishlist',
  trade: 'Voor ruil',
  missing: 'Ontbreekt',
};

const STATUS_ORDER: CollectionStatus[] = ['owned', 'wishlist', 'trade', 'missing'];

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
  const snapshot = confirmedOwnership?.kind === 'snapshot'
    ? confirmedOwnership.value
    : confirmedOwnership?.kind === 'conflict'
      ? confirmedOwnership.value
      : undefined;
  const statusItems = snapshot
    ? STATUS_ORDER.flatMap((status) => {
        const quantity = snapshot.byStatus[status]
          .reduce((total: number, record: OwnershipRecord) => total + Math.max(0, record.quantity), 0);

        if (
          status === 'owned' &&
          snapshot.manageableOwnedNearMintRecord &&
          snapshot.byStatus.owned.length === 1 &&
          snapshot.byStatus.wishlist.length === 0 &&
          snapshot.byStatus.trade.length === 0 &&
          snapshot.byStatus.missing.length === 0
        ) {
          return [];
        }

        return quantity > 0
          ? [{ status, label: `${STATUS_LABELS[status]} · ${quantity} ${quantity === 1 ? 'exemplaar' : 'exemplaren'}` }]
          : [];
      })
    : [];

  return {
    statusItems,
    physicalPresenceLabel:
      snapshot?.physicalPresence === 'present'
        ? 'In collectie'
        : undefined,
    managementMessage: confirmedOwnership?.kind === 'conflict' ? 'Gegevensconflict' : undefined,
  };
}
