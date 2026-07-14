import type { CollectionStatus, ConfirmedOwnership, OwnershipRecord, OwnershipSnapshot } from '../collectionCards';
import type { CardDetailProductCopy } from './CardDetailDialog';

const STATUS_LABELS: Record<CollectionStatus, string> = {
  owned: 'In collectie',
  wishlist: 'Op wishlist',
  trade: 'Voor ruil',
  missing: 'Ontbreekt',
};

const STATUS_ORDER: CollectionStatus[] = ['owned', 'wishlist', 'trade', 'missing'];

export type CardDetailOwnershipPresentation = {
  statusItems: CardDetailProductCopy['statusItems'];
  physicalPresenceLabel?: string;
  conflictMessage?: string;
};

export function hasConfirmedPhysicalPresence(ownership: ConfirmedOwnership | undefined): boolean {
  return ownership?.kind === 'snapshot' &&
    (ownership.value.byStatus.owned.length > 0 || ownership.value.byStatus.trade.length > 0);
}

export function hasConfirmedAbsence(ownership: ConfirmedOwnership | undefined): boolean {
  return ownership?.kind === 'absent';
}

function sumStatusQuantity(records: readonly OwnershipRecord[]): number {
  return records.reduce((total, record) => total + Math.max(0, record.quantity), 0);
}

function hasSingleNormalManageableOwnedNearMintRow(snapshot: OwnershipSnapshot): boolean {
  const manageableRecord = snapshot.manageableOwnedNearMintRecord;

  return Boolean(
    manageableRecord &&
      snapshot.byStatus.owned.length === 1 &&
      snapshot.byStatus.wishlist.length === 0 &&
      snapshot.byStatus.trade.length === 0 &&
      snapshot.byStatus.missing.length === 0 &&
      snapshot.byStatus.owned[0]?.collectionCardId === manageableRecord.collectionCardId,
  );
}

export function createCardDetailOwnershipPresentation(params: {
  ownership: ConfirmedOwnership | undefined;
  hasConflict?: boolean;
  includeConflictSnapshotStatusItems?: boolean;
}): CardDetailOwnershipPresentation {
  const {
    ownership,
    hasConflict = ownership?.kind === 'conflict',
    includeConflictSnapshotStatusItems = false,
  } = params;
  const snapshot = ownership?.kind === 'snapshot'
    ? ownership.value
    : includeConflictSnapshotStatusItems && ownership?.kind === 'conflict'
      ? ownership.value
      : undefined;
  const suppressNormalOwnedStatus = snapshot ? hasSingleNormalManageableOwnedNearMintRow(snapshot) : false;
  const statusItems = snapshot
    ? STATUS_ORDER.flatMap((status) => {
        if (status === 'owned' && suppressNormalOwnedStatus) {
          return [];
        }

        const quantity = sumStatusQuantity(snapshot.byStatus[status]);

        return quantity > 0
          ? [{ status, label: `${STATUS_LABELS[status]} · ${quantity} ${quantity === 1 ? 'exemplaar' : 'exemplaren'}` }]
          : [];
      })
    : [];

  return {
    statusItems,
    physicalPresenceLabel: hasConfirmedPhysicalPresence(ownership) ? 'In collectie' : undefined,
    conflictMessage: hasConflict ? 'Gegevensconflict' : undefined,
  };
}
