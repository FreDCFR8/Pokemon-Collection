import { getCollectionCardOwnershipForCatalogCards, type ConfirmedOwnership, type OwnershipSnapshot } from '../../collectionCards';

export type ManageableOwnedNearMintRow = {
  id: string;
  cardCatalogId: string;
  quantity: number;
};

export type SetCardCollectionInfo = {
  hasAnyRecord: boolean;
  manageableOwnedNearMintRow?: ManageableOwnedNearMintRow;
  hasConflictingManageableRows: boolean;
  ownership: ConfirmedOwnership;
};

export type GetSetCardCollectionInfoParams = {
  collectionId: string;
  cardCatalogIds: string[];
};

function createEmptyCollectionInfo(): SetCardCollectionInfo {
  return {
    hasAnyRecord: false,
    hasConflictingManageableRows: false,
    ownership: { kind: 'absent' },
  };
}

function countSnapshotRecords(snapshot: OwnershipSnapshot): number {
  return Object.values(snapshot.byStatus).reduce((recordCount, records) => recordCount + records.length, 0);
}

function mapOwnershipToSetCardCollectionInfo(ownership: ConfirmedOwnership): SetCardCollectionInfo {
  if (ownership.kind === 'absent') {
    return createEmptyCollectionInfo();
  }

  if (ownership.kind === 'conflict') {
    return {
      hasAnyRecord: true,
      hasConflictingManageableRows: true,
      ownership,
    };
  }

  const manageableRecord = ownership.value.manageableOwnedNearMintRecord;

  return {
    hasAnyRecord: countSnapshotRecords(ownership.value) > 0,
    manageableOwnedNearMintRow: manageableRecord
      ? {
          id: manageableRecord.collectionCardId,
          cardCatalogId: manageableRecord.cardCatalogId,
          quantity: manageableRecord.quantity,
        }
      : undefined,
    hasConflictingManageableRows: false,
    ownership,
  };
}

export async function getSetCardCollectionInfoForCatalogCards({
  collectionId,
  cardCatalogIds,
}: GetSetCardCollectionInfoParams): Promise<Map<string, SetCardCollectionInfo>> {
  const uniqueCardCatalogIds = [...new Set(cardCatalogIds.map((cardId) => cardId.trim()).filter(Boolean))];
  const ownershipByCardCatalogId = await getCollectionCardOwnershipForCatalogCards({
    collectionId,
    cardCatalogIds: uniqueCardCatalogIds,
  });

  return new Map(
    uniqueCardCatalogIds.map((cardCatalogId) => [
      cardCatalogId,
      mapOwnershipToSetCardCollectionInfo(
        ownershipByCardCatalogId.get(cardCatalogId) ?? {
          kind: 'conflict',
          reason: 'Requested card has no confirmed ownership result.',
        },
      ),
    ]),
  );
}
