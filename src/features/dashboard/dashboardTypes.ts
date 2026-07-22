export type DashboardRecentCard = {
  id: string;
  pokemon: string;
  setName: string | null;
  number: string | null;
  imageSmall: string | null;
  quantity: number;
  addedAt: string;
};

export type DashboardSetInsight = {
  setCode: string;
  setName: string;
  ownedCount: number;
  total: number;
  missingCount: number;
  progressPercent: number;
};

export type DashboardRarityInsight = {
  rarity: string;
  uniqueCards: number;
};

export type DashboardSummary = {
  profileId: string;
  displayName: string;
  collectionId: string;
  totalQuantity: number;
  uniqueOwnedCards: number;
  wishlistCards: number;
  duplicateQuantity: number;
  recentCards: DashboardRecentCard[];
  rarityInsights: DashboardRarityInsight[];
  setInsights: DashboardSetInsight[];
  continueCollecting: DashboardSetInsight | null;
};

export type DashboardComparison = {
  combinedQuantity: number;
  combinedUniqueCards: number;
  combinedWishlistCards: number;
  combinedDuplicateQuantity: number;
  leadingCollectorName: string | null;
  leadingCollectorDifference: number;
};

export type DashboardState =
  | { status: 'loading'; message: string; summaries: DashboardSummary[]; comparison: DashboardComparison | null }
  | { status: 'ready'; message: string; summaries: DashboardSummary[]; comparison: DashboardComparison | null }
  | { status: 'empty'; message: string; summaries: DashboardSummary[]; comparison: DashboardComparison | null }
  | { status: 'error'; message: string; summaries: DashboardSummary[]; comparison: DashboardComparison | null };