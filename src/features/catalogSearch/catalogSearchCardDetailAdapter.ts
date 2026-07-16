import type { CardDetailCapabilities, CardDetailCard } from '../cardDetail';
import type { ConfirmedOwnership } from '../collectionCards';
import type { CatalogSearchCard } from './catalogSearchTypes';

export type CatalogSearchMutationOperation = 'add' | 'add-wishlist' | 'remove-wishlist' | 'promote-wishlist' | 'increase' | 'decrease' | 'delete';

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
  operation: CatalogSearchMutationOperation | undefined,
  handlers: Partial<Record<CatalogSearchMutationOperation, () => void>>,
): (() => void) | undefined {
  return operation ? handlers[operation] : undefined;
}
