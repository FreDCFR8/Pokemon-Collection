export type CardDetailMutationStatus = 'idle' | 'pending' | 'success' | 'error' | 'conflict';

export function areCardDetailActionsBlocked(mutation: { status: CardDetailMutationStatus }): boolean {
  return mutation.status === 'pending' || mutation.status === 'conflict';
}
