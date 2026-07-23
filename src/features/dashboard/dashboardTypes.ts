export type DashboardRecentCard = {
  id: string;
  pokemon: string;
  setName: string | null;
  setCode: string | null;
  series: string | null;
  releaseDate: string | null;
  number: string | null;
  rarity: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
  cardDetails: Record<string, unknown> | null;
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
  percent: number;
};

export type DashboardRecentSet = {
  setCode: string;
  name: string;
  releaseDate: string | null;
  total: number | null;
  logoUrl: string | null;
  symbolUrl: string | null;
  ownedCount: number | null;
  progressPercent: number | null;
};

export type DashboardSummary = {
  profileId: string;
  displayName: string;
  collectionId: string;
  totalQuantity: number;
  uniqueOwnedCards: number;
  wishlistCards: number;
  duplicateQuantity: number;
  duplicatePercent: number;
  ownedCardIds: string[];
  recentCards: DashboardRecentCard[];
  rarityInsights: DashboardRarityInsight[];
  setInsights: DashboardSetInsight[];
  continueCollecting: DashboardSetInsight | null;
  recentSets: DashboardRecentSet[];
  recentSetsStatus: 'ready' | 'unavailable';
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