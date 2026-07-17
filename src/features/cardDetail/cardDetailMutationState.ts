import type { ConfirmedOwnership } from '../collectionCards';

export type CardDetailMutationStatus = 'idle' | 'pending' | 'success' | 'error' | 'conflict';

export function areCardDetailActionsBlocked(mutation: { status: CardDetailMutationStatus }): boolean {
  return mutation.status === 'pending' || mutation.status === 'conflict';
}

export function getCardDetailWishlistAction(capabilities: { canAddWishlist?: boolean; canRemoveWishlist?: boolean }): 'add' | 'remove' | null {
  if (capabilities.canAddWishlist) return 'add';
  if (capabilities.canRemoveWishlist) return 'remove';
  return null;
}

export type CardDetailActionMode = 'read-only' | 'add' | 'wishlist' | 'quantity' | 'unavailable';

export function getCardDetailActionMode(params: { readOnly: boolean; ownership: ConfirmedOwnership | undefined }): CardDetailActionMode {
  if (params.readOnly) return 'read-only';
  if (params.ownership?.kind === 'absent') return 'add';
  if (params.ownership?.kind !== 'snapshot') return 'unavailable';
  if (params.ownership.value.byStatus.wishlist.length > 0 &&
      params.ownership.value.byStatus.owned.length === 0 &&
      params.ownership.value.byStatus.trade.length === 0 &&
      params.ownership.value.byStatus.missing.length === 0) return 'wishlist';
  if (params.ownership.value.manageableOwnedNearMintRecord) return 'quantity';
  return 'unavailable';
}
