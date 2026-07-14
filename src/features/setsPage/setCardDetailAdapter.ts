import type { CardDetailProductCopy } from '../cardDetail';
import {
  createCardDetailOwnershipPresentation,
  hasConfirmedAbsence,
  hasConfirmedPhysicalPresence,
} from '../cardDetail/cardDetailOwnershipPresentation.ts';
import type { ConfirmedOwnership } from '../collectionCards';

export { hasConfirmedAbsence, hasConfirmedPhysicalPresence };

export type SetCardMutationOperation = 'add' | 'add-wishlist' | 'remove-wishlist' | 'promote-wishlist' | 'increase' | 'decrease' | 'delete';

export function getSetCardMutationRetryHandler(
  operation: SetCardMutationOperation | undefined,
  handlers: Partial<Record<SetCardMutationOperation, () => void>>,
): (() => void) | undefined {
  return operation ? handlers[operation] : undefined;
}

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
    canAddWishlist: false,
    canRemoveWishlist: wishlistCount === 1,
  };
}

export function canPromoteSetWishlist(params: {
  ownership: ConfirmedOwnership | undefined;
  hasConflictingRows: boolean;
}): boolean {
  return !params.hasConflictingRows && params.ownership?.kind === 'snapshot' && params.ownership.value.byStatus.wishlist.length === 1 &&
    params.ownership.value.byStatus.owned.length === 0 && params.ownership.value.byStatus.trade.length === 0 && params.ownership.value.byStatus.missing.length === 0;
}

export function canStartSetWishlistAddMutation(params: {
  ownership: ConfirmedOwnership | undefined;
  hasConflictingRows: boolean;
}): boolean {
  return getSetWishlistCapabilities(params).canAddWishlist;
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
