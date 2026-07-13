import type {
  CollectionStatus,
  ConfirmedOwnership,
  OwnershipByStatus,
  OwnershipRecord,
  OwnershipRecordInput,
  OwnershipSnapshot,
} from './collectionCardOwnershipTypes';

export type ProjectCollectionOwnershipParams = {
  collectionId: string;
  cardCatalogId: string;
  records: readonly OwnershipRecordInput[];
};

export type ProjectCollectionOwnershipBatchParams = {
  collectionId: string;
  cardCatalogIds: readonly string[];
  records: readonly OwnershipRecordInput[];
};

const COLLECTION_STATUSES = new Set<CollectionStatus>(['owned', 'wishlist', 'trade', 'missing']);

function emptyByStatus(): OwnershipByStatus {
  return {
    owned: [],
    wishlist: [],
    trade: [],
    missing: [],
  };
}

function normalizeRequiredId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeCondition(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeStatus(value: unknown): CollectionStatus | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return COLLECTION_STATUSES.has(normalized as CollectionStatus) ? (normalized as CollectionStatus) : null;
}

function normalizeRecord(
  input: OwnershipRecordInput,
  expectedCollectionId: string,
  expectedCardCatalogId: string,
): OwnershipRecord | null {
  const collectionCardId = normalizeRequiredId(input.collectionCardId);
  const collectionId = normalizeRequiredId(input.collectionId);
  const cardCatalogId = normalizeRequiredId(input.cardCatalogId);
  const condition = normalizeCondition(input.condition);
  const status = normalizeStatus(input.status);

  if (
    !collectionCardId ||
    collectionId !== expectedCollectionId ||
    cardCatalogId !== expectedCardCatalogId ||
    !Number.isInteger(input.quantity) ||
    (input.quantity as number) <= 0 ||
    condition === undefined ||
    !status
  ) {
    return null;
  }

  return {
    collectionCardId,
    collectionId,
    cardCatalogId,
    quantity: input.quantity as number,
    condition,
    status,
  };
}

function createSnapshot(byStatus: OwnershipByStatus): OwnershipSnapshot {
  const manageableRecords = byStatus.owned.filter((record) => record.condition === 'Near Mint');
  const physicalPresence = byStatus.owned.length > 0 || byStatus.trade.length > 0 ? 'present' : 'absent';

  return {
    byStatus,
    physicalPresence,
    manageableOwnedNearMintRecord: manageableRecords.length === 1 ? manageableRecords[0] : undefined,
  };
}

function withoutManageableRecord(snapshot: OwnershipSnapshot): OwnershipSnapshot {
  const { manageableOwnedNearMintRecord: _unsafeManageableRecord, ...safeSnapshot } = snapshot;
  return safeSnapshot;
}

export function projectCollectionOwnership({
  collectionId,
  cardCatalogId,
  records,
}: ProjectCollectionOwnershipParams): ConfirmedOwnership {
  const normalizedCollectionId = collectionId.trim();
  const normalizedCardCatalogId = cardCatalogId.trim();

  if (!normalizedCollectionId || !normalizedCardCatalogId) {
    throw new Error('Collection ownership projection requires non-empty collection and card catalog IDs.');
  }

  if (records.length === 0) {
    return { kind: 'absent' };
  }

  const byStatus = emptyByStatus();
  let invalidRecordCount = 0;

  for (const input of records) {
    const record = normalizeRecord(input, normalizedCollectionId, normalizedCardCatalogId);

    if (!record) {
      invalidRecordCount += 1;
      continue;
    }

    if (record.status === 'owned') {
      byStatus.owned.push(record as OwnershipRecord<'owned'>);
    } else if (record.status === 'wishlist') {
      byStatus.wishlist.push(record as OwnershipRecord<'wishlist'>);
    } else if (record.status === 'trade') {
      byStatus.trade.push(record as OwnershipRecord<'trade'>);
    } else {
      byStatus.missing.push(record as OwnershipRecord<'missing'>);
    }
  }

  const snapshot = createSnapshot(byStatus);
  const manageableRecordCount = byStatus.owned.filter((record) => record.condition === 'Near Mint').length;

  if (invalidRecordCount > 0) {
    return {
      kind: 'conflict',
      value: withoutManageableRecord(snapshot),
      reason: `${invalidRecordCount} unknown or invalid collection-state row(s).`,
    };
  }

  if (manageableRecordCount > 1) {
    return {
      kind: 'conflict',
      value: withoutManageableRecord(snapshot),
      reason: 'Multiple manageable owned Near Mint collection-state rows.',
    };
  }

  return { kind: 'snapshot', value: snapshot };
}

export function projectCollectionOwnershipBatch({
  collectionId,
  cardCatalogIds,
  records,
}: ProjectCollectionOwnershipBatchParams): Map<string, ConfirmedOwnership> {
  const normalizedCollectionId = collectionId.trim();
  const uniqueCardCatalogIds = [...new Set(cardCatalogIds.map((cardCatalogId) => cardCatalogId.trim()).filter(Boolean))];
  const recordsByCardCatalogId = new Map<string, OwnershipRecordInput[]>();
  let unassignedRecordCount = 0;

  for (const cardCatalogId of uniqueCardCatalogIds) {
    recordsByCardCatalogId.set(cardCatalogId, []);
  }

  for (const record of records) {
    const cardCatalogId = normalizeRequiredId(record.cardCatalogId);

    if (!cardCatalogId || !recordsByCardCatalogId.has(cardCatalogId)) {
      unassignedRecordCount += 1;
      continue;
    }

    recordsByCardCatalogId.get(cardCatalogId)?.push(record);
  }

  const projectedOwnership = new Map(
    uniqueCardCatalogIds.map((cardCatalogId) => [
      cardCatalogId,
      projectCollectionOwnership({
        collectionId: normalizedCollectionId,
        cardCatalogId,
        records: recordsByCardCatalogId.get(cardCatalogId) ?? [],
      }),
    ]),
  );

  if (unassignedRecordCount === 0) {
    return projectedOwnership;
  }

  return new Map(
    [...projectedOwnership].map(([cardCatalogId, ownership]) => [
      cardCatalogId,
      {
        kind: 'conflict',
        value:
          ownership.kind === 'snapshot'
            ? withoutManageableRecord(ownership.value)
            : ownership.kind === 'conflict' && ownership.value
              ? withoutManageableRecord(ownership.value)
              : undefined,
        reason: `${unassignedRecordCount} collection-state row(s) could not be assigned to a requested card.`,
      },
    ]),
  );
}
