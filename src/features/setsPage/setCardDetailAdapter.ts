import type { CardDetailProductCopy } from '../cardDetail';
import {
  createCardDetailOwnershipPresentation,
  hasConfirmedAbsence,
  hasConfirmedPhysicalPresence,
} from '../cardDetail/cardDetailOwnershipPresentation.ts';
import type { ConfirmedOwnership } from '../collectionCards';

export { hasConfirmedAbsence, hasConfirmedPhysicalPresence };

export function getSetWishlistCapabilities(params: {
  ownership: ConfirmedOwnership | undefined;
  hasConflictingRows: boolean;
}): { canAddWishlist: boolean; canRemoveWishlist: boolean } {
  if (params.hasConflictingRows || !params.ownership || params.ownership.kind === 'conflict') {
    return { canAddWishlist: false, canRemoveWishlist: false };
  }

  if (params.ownership.kind === 'absent') {
    return { canAddWishlist: true, canRemoveWishlist: false };
  }

  const wishlistCount = params.ownership.value.byStatus.wishlist.length;
  return {
    canAddWishlist: wishlistCount === 0,
    canRemoveWishlist: wishlistCount === 1,
  };
}

export function createSetCardDetailProductCopy(params: {
  ownership: ConfirmedOwnership | undefined;
  hasConflictingRows: boolean;
  showManageElsewhere: boolean;
}): CardDetailProductCopy {
  const presentation = createCardDetailOwnershipPresentation({
    ownership: params.ownership,
    hasConflict: params.hasConflictingRows,
  });

  return {
    statusItems: presentation.statusItems,
    physicalPresenceLabel: presentation.physicalPresenceLabel,
    managementMessage: params.showManageElsewhere ? 'Beheer via collectie' : presentation.conflictMessage,
  };
}
