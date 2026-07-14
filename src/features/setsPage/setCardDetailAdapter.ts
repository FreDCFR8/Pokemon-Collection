import type { CardDetailProductCopy } from '../cardDetail';
import type { CollectionStatus, ConfirmedOwnership, OwnershipRecord } from '../collectionCards';

const STATUS_LABELS: Record<CollectionStatus, string> = {
  owned: 'In collectie',
  wishlist: 'Op wishlist',
  trade: 'Voor ruil',
  missing: 'Ontbreekt',
};

const STATUS_ORDER: CollectionStatus[] = ['owned', 'wishlist', 'trade', 'missing'];

export function hasConfirmedPhysicalPresence(ownership: ConfirmedOwnership | undefined): boolean {
  return ownership?.kind === 'snapshot' && ownership.value.physicalPresence === 'present';
}

export function hasConfirmedAbsence(ownership: ConfirmedOwnership | undefined): boolean {
  return ownership?.kind === 'absent';
}

function sumStatusQuantity(records: readonly OwnershipRecord[]): number {
  return records.reduce((total, record) => total + Math.max(0, record.quantity), 0);
}

function hasSingleNormalManageableOwnedNearMintRow(ownership: ConfirmedOwnership): boolean {
  if (ownership.kind !== 'snapshot' || !ownership.value.manageableOwnedNearMintRecord) {
    return false;
  }

  const snapshot = ownership.value;
  const manageableRecord = snapshot.manageableOwnedNearMintRecord;

  if (!manageableRecord) {
    return false;
  }

  return (
    snapshot.byStatus.owned.length === 1 &&
    snapshot.byStatus.wishlist.length === 0 &&
    snapshot.byStatus.trade.length === 0 &&
    snapshot.byStatus.missing.length === 0 &&
    snapshot.byStatus.owned[0]?.collectionCardId === manageableRecord.collectionCardId
  );
}

export function createSetCardDetailProductCopy(params: {
  ownership: ConfirmedOwnership | undefined;
  hasConflictingRows: boolean;
  showManageElsewhere: boolean;
}): CardDetailProductCopy {
  const { ownership, hasConflictingRows, showManageElsewhere } = params;
  const statusItems =
    ownership?.kind === 'snapshot' && !hasSingleNormalManageableOwnedNearMintRow(ownership)
      ? STATUS_ORDER.flatMap((status) => {
          const quantity = sumStatusQuantity(ownership.value.byStatus[status]);

          return quantity > 0
            ? [{ status, label: `${STATUS_LABELS[status]} · ${quantity} ${quantity === 1 ? 'exemplaar' : 'exemplaren'}` }]
            : [];
        })
      : [];

  return {
    statusItems,
    physicalPresenceLabel: hasConfirmedPhysicalPresence(ownership) ? 'In collectie' : undefined,
    managementMessage: showManageElsewhere
      ? 'Beheer via collectie'
      : hasConflictingRows
        ? 'Gegevensconflict'
        : undefined,
  };
}
