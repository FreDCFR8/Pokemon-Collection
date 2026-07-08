export type CollectionType = 'main' | 'wishlist' | 'trade' | 'binder' | 'custom';

export type CollectionReadinessStatus =
  | 'loading'
  | 'config-missing'
  | 'signed-out'
  | 'profile-missing'
  | 'collection-ready'
  | 'collection-missing'
  | 'error';

export type AppCollection = {
  id: string;
  profileId: string;
  name: string;
  type: CollectionType;
  createdAt: string;
  updatedAt: string;
};

export type CollectionReadinessState = {
  status: CollectionReadinessStatus;
  message: string;
  collections: AppCollection[];
  mainCollection: AppCollection | null;
  errorMessage?: string;
};
