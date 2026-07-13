export type CollectionStatus = 'owned' | 'wishlist' | 'trade' | 'missing';

export type OwnershipRecord<S extends CollectionStatus = CollectionStatus> = {
  collectionCardId: string;
  collectionId: string;
  cardCatalogId: string;
  quantity: number;
  condition: string | null;
  status: S;
};

export type OwnershipByStatus = {
  owned: OwnershipRecord<'owned'>[];
  wishlist: OwnershipRecord<'wishlist'>[];
  trade: OwnershipRecord<'trade'>[];
  missing: OwnershipRecord<'missing'>[];
};

export type OwnershipSnapshot = {
  byStatus: OwnershipByStatus;
  physicalPresence: 'present' | 'absent';
  manageableOwnedNearMintRecord?: OwnershipRecord<'owned'>;
};

export type ConfirmedOwnership =
  | { kind: 'absent' }
  | { kind: 'snapshot'; value: OwnershipSnapshot }
  | { kind: 'conflict'; value?: OwnershipSnapshot; reason: string };

export type CollectionOwnershipState =
  | { status: 'idle' }
  | { status: 'loading'; previous?: ConfirmedOwnership }
  | { status: 'ready'; value: ConfirmedOwnership }
  | { status: 'error'; previous?: ConfirmedOwnership; retryable: boolean };

export type OwnershipRecordInput = {
  collectionCardId: unknown;
  collectionId: unknown;
  cardCatalogId: unknown;
  quantity: unknown;
  condition: unknown;
  status: unknown;
};
