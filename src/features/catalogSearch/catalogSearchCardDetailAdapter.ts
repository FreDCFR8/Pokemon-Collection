import type { CardDetailCapabilities, CardDetailCard } from '../cardDetail';
import type { ConfirmedOwnership, OwnershipRecord } from '../collectionCards';
import type { CatalogSearchCard } from './catalogSearchTypes';

export type CatalogSearchMutationOperation = 'add' | 'add-wishlist' | 'remove-wishlist' | 'promote-wishlist' | 'increase' | 'decrease' | 'delete';

export type CatalogSearchMutationConfirmation = {
  operation: CatalogSearchMutationOperation;
  before: ConfirmedOwnership | undefined;
  confirmed: ConfirmedOwnership | undefined;
  collectionCardId?: string;
  previousQuantity?: number;
};

export type CatalogSearchMutationRetry =
  | { kind: 'write'; operation: CatalogSearchMutationOperation }
  | { kind: 'confirmation'; confirmation: CatalogSearchMutationConfirmation };

export function toCatalogSearchCardDetailCard(card: CatalogSearchCard): CardDetailCard {
  return {
    cardCatalogId: card.id,
    name: card.pokemon?.trim() || 'Onbekende kaart',
    number: card.number,
    set: { setCode: card.setCode, name: card.setName },
    rarity: card.rarity,
    images: { small: card.imageSmall, large: card.imageLarge },
  };
}

function isWishlistOnly(ownership: ConfirmedOwnership | undefined): boolean {
  return ownership?.kind === 'snapshot' &&
    ownership.value.byStatus.wishlist.length === 1 &&
    ownership.value.byStatus.owned.length === 0 &&
    ownership.value.byStatus.trade.length === 0 &&
    ownership.value.byStatus.missing.length === 0;
}

function isManageableOwned(ownership: ConfirmedOwnership | undefined): boolean {
  return ownership?.kind === 'snapshot' &&
    Boolean(ownership.value.manageableOwnedNearMintRecord) &&
    ownership.value.byStatus.owned.length === 1 &&
    ownership.value.byStatus.wishlist.length === 0 &&
    ownership.value.byStatus.trade.length === 0 &&
    ownership.value.byStatus.missing.length === 0;
}

function isValidOwnedNearMint(ownership: ConfirmedOwnership | undefined, collectionCardId?: string, expectedQuantity?: number | 'at-least-one'): boolean {
  if (ownership?.kind !== 'snapshot') return false;
  const record = ownership.value.manageableOwnedNearMintRecord;
  const ownedRecord = ownership.value.byStatus.owned[0];
  return Boolean(
    record &&
    record.status === 'owned' &&
    record.condition === 'Near Mint' &&
    (collectionCardId === undefined || record.collectionCardId === collectionCardId) &&
    (expectedQuantity === undefined || (expectedQuantity === 'at-least-one' ? record.quantity >= 1 : record.quantity === expectedQuantity)) &&
    ownership.value.byStatus.owned.length === 1 &&
    ownedRecord?.collectionCardId === record?.collectionCardId &&
    ownedRecord?.quantity === record?.quantity &&
    ownedRecord?.condition === record?.condition &&
    ownership.value.byStatus.wishlist.length === 0 &&
    ownership.value.byStatus.trade.length === 0 &&
    ownership.value.byStatus.missing.length === 0,
  );
}

export function doesCatalogSearchOwnershipConfirmMutation(params: CatalogSearchMutationConfirmation): boolean {
  const confirmed = params.confirmed;
  switch (params.operation) {
    case 'add':
      return isValidOwnedNearMint(confirmed, undefined, 'at-least-one') && confirmed?.kind === 'snapshot' && confirmed.value.byStatus.wishlist.length === 0;
    case 'add-wishlist':
      return confirmed?.kind === 'snapshot' && confirmed.value.physicalPresence === 'absent' && confirmed.value.byStatus.owned.length === 0 && confirmed.value.byStatus.wishlist.length === 1 && confirmed.value.byStatus.wishlist[0].quantity === 1 && confirmed.value.byStatus.wishlist[0].condition === null && confirmed.value.byStatus.trade.length === 0 && confirmed.value.byStatus.missing.length === 0;
    case 'remove-wishlist':
    case 'delete':
      return confirmed?.kind === 'absent';
    case 'promote-wishlist':
      return isValidOwnedNearMint(confirmed, undefined, 1) && confirmed?.kind === 'snapshot' && confirmed.value.byStatus.wishlist.length === 0;
    case 'increase':
      return params.previousQuantity !== undefined && isValidOwnedNearMint(confirmed, params.collectionCardId, params.previousQuantity + 1);
    case 'decrease':
      return params.previousQuantity !== undefined && isValidOwnedNearMint(confirmed, params.collectionCardId, params.previousQuantity - 1);
  }
}

export function createCatalogSearchCardDetailCapabilities(params: {
  ownership: ConfirmedOwnership | undefined;
  isPending?: boolean;
}): CardDetailCapabilities {
  const blocked = params.isPending === true;
  const ownership = params.ownership;

  if (!ownership || ownership.kind === 'conflict') {
    return {
      canAdd: false,
      canAddWishlist: false,
      canRemoveWishlist: false,
      canPromoteWishlist: false,
      canIncrease: false,
      canDecrease: false,
      unavailableReason: 'Status onbekend. Laad de collectiestatus opnieuw.',
    };
  }

  if (ownership.kind === 'absent') {
    return {
      canAdd: !blocked,
      canAddWishlist: !blocked,
      canRemoveWishlist: false,
      canPromoteWishlist: false,
      canIncrease: false,
      canDecrease: false,
    };
  }

  if (isWishlistOnly(ownership)) {
    return {
      canAdd: false,
      canAddWishlist: false,
      canRemoveWishlist: !blocked,
      canPromoteWishlist: !blocked,
      canIncrease: false,
      canDecrease: false,
    };
  }

  if (isManageableOwned(ownership)) {
    return {
      canAdd: false,
      canAddWishlist: false,
      canRemoveWishlist: false,
      canPromoteWishlist: false,
      canIncrease: !blocked,
      canDecrease: !blocked,
    };
  }

  return {
    canAdd: false,
    canAddWishlist: false,
    canRemoveWishlist: false,
    canPromoteWishlist: false,
    canIncrease: false,
    canDecrease: false,
    unavailableReason: 'Beheer via collectie',
  };
}

export function getCatalogSearchMutationRetryHandler(
  retry: CatalogSearchMutationRetry | undefined,
  handlers: Partial<Record<CatalogSearchMutationOperation, () => void>> & { confirmation?: () => void },
): (() => void) | undefined {
  if (!retry) return undefined;
  return retry.kind === 'confirmation' ? handlers.confirmation : handlers[retry.operation];
}
