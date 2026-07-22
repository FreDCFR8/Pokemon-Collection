export type DashboardRecentCard = {
  id: string;
  pokemon: string;
  setName: string | null;
  number: string | null;
  imageSmall: string | null;
  quantity: number;
  addedAt: string;
};

export type DashboardSummary = {
  profileId: string;
  displayName: string;
  collectionId: string;
  totalQuantity: number;
  uniqueOwnedCards: number;
  wishlistCards: number;
  recentCards: DashboardRecentCard[];
};

export type DashboardState =
  | { status: 'loading'; message: string; summaries: DashboardSummary[] }
  | { status: 'ready'; message: string; summaries: DashboardSummary[] }
  | { status: 'empty'; message: string; summaries: DashboardSummary[] }
  | { status: 'error'; message: string; summaries: DashboardSummary[] };
