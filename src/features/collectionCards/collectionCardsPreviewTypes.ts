export type CollectionCardsPreviewStatus =
  | 'loading'
  | 'config-missing'
  | 'signed-out'
  | 'profile-missing'
  | 'collection-missing'
  | 'ready'
  | 'error';

export type CollectionCardPreviewItem = {
  pokemon: string | null;
  setName: string | null;
  number: string | null;
  rarity: string | null;
  quantity: number | null;
  condition: string | null;
  status: string | null;
  imageSmall: string | null;
  addedAt: string | null;
};

export type CollectionCardsPreviewState = {
  status: CollectionCardsPreviewStatus;
  message: string;
  totalCount: number;
  previewCards: CollectionCardPreviewItem[];
  errorMessage?: string;
};
