export type CardDetailMutationStatus = 'idle' | 'pending' | 'success' | 'error' | 'conflict';

export function areCardDetailActionsBlocked(mutation: { status: CardDetailMutationStatus }): boolean {
  return mutation.status === 'pending' || mutation.status === 'conflict';
}

export type CardDetailActionMode = 'read-only' | 'add' | 'wishlist' | 'quantity';

export function getCardDetailActionMode(params: { readOnly: boolean; canAdd: boolean; isWishlistOnly: boolean }): CardDetailActionMode {
  if (params.readOnly) return 'read-only';
  if (params.canAdd) return 'add';
  if (params.isWishlistOnly) return 'wishlist';
  return 'quantity';
}
