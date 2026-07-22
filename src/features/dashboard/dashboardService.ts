import { createBrowserSupabaseClient } from '../../lib/supabase';
import { getRecentSetsCatalog, getSetsCatalog, type SetsCatalogRow } from '../../services/setsCatalogService';
import type {
  DashboardComparison,
  DashboardRecentCard,
  DashboardRarityInsight,
  DashboardRecentSet,
  DashboardSetInsight,
  DashboardState,
  DashboardSummary,
} from './dashboardTypes';
import { buildRarityInsights, buildRecentSets, buildSetInsights, selectVisibleSetInsights } from './dashboardInsights';
export { buildRarityInsights, buildRecentSets, buildSetInsights, selectVisibleSetInsights } from './dashboardInsights';

type ProfileRow = { id: string; display_name: string };
type CollectionRow = { id: string; profile_id: string };
type CollectionCardRow = {
  id: string;
  collection_id: string;
  quantity: number;
  status: string;
  added_at: string;
  created_at: string;
  cards_catalog: {
    id: string;
    pokemon: string;
    set_name: string | null;
    set_code: string | null;
    number: string | null;
    rarity: string | null;
    image_small: string | null;
  } | null;
};

function safeErrorState(): DashboardState {
  return { status: 'error', message: 'Het dashboard kon niet veilig worden geladen. Probeer het opnieuw.', summaries: [], comparison: null };
}


function toSummary(profile: ProfileRow, collection: CollectionRow, rows: CollectionCardRow[], sets: SetsCatalogRow[], recentSets: SetsCatalogRow[] = [], recentSetsStatus: 'ready' | 'unavailable' = 'ready'): DashboardSummary {
  const collectionRows = rows.filter((row) => row.collection_id === collection.id);
  const ownedRows = collectionRows.filter((row) => row.status === 'owned');
  const wishlistRows = collectionRows.filter((row) => row.status === 'wishlist');
  const ownedCardIds = [...new Set(ownedRows.map((row) => row.cards_catalog?.id).filter((id): id is string => Boolean(id)))];
  const recentCards: DashboardRecentCard[] = ownedRows
    .filter((row) => row.cards_catalog)
    .sort((first, second) => `${second.added_at}-${second.created_at}`.localeCompare(`${first.added_at}-${first.created_at}`))
    .slice(0, 8)
    .map((row) => ({
      id: row.cards_catalog!.id,
      pokemon: row.cards_catalog!.pokemon,
      setName: row.cards_catalog!.set_name,
      number: row.cards_catalog!.number,
      imageSmall: row.cards_catalog!.image_small,
      quantity: row.quantity,
      addedAt: row.added_at,
    }));
  const allSetInsights = buildSetInsights(ownedRows, sets);
  const setInsights = selectVisibleSetInsights(allSetInsights);
  const duplicateQuantity = ownedRows.reduce((total, row) => total + Math.max(0, row.quantity - 1), 0);

  return {
    profileId: profile.id,
    displayName: profile.display_name,
    collectionId: collection.id,
    totalQuantity: ownedRows.reduce((total, row) => total + row.quantity, 0),
    uniqueOwnedCards: ownedCardIds.length,
    wishlistCards: wishlistRows.length,
    duplicateQuantity,
    duplicatePercent: ownedCardIds.length + duplicateQuantity > 0 ? Math.round((duplicateQuantity / (ownedCardIds.length + duplicateQuantity)) * 100) : 0,
    ownedCardIds,
    recentCards,
    rarityInsights: buildRarityInsights(ownedRows),
    setInsights,
    continueCollecting: allSetInsights.find((set) => set.missingCount > 0) ?? null,
    recentSets: buildRecentSets(recentSets, allSetInsights),
    recentSetsStatus,
  };
}

function buildComparison(summaries: DashboardSummary[]): DashboardComparison | null {
  if (summaries.length === 0) return null;
  const sorted = [...summaries].sort((first, second) => second.uniqueOwnedCards - first.uniqueOwnedCards);
  const leader = sorted[0];
  const runnerUp = sorted[1];

  return {
    combinedQuantity: summaries.reduce((total, summary) => total + summary.totalQuantity, 0),
    combinedUniqueCards: new Set(summaries.flatMap((summary) => summary.ownedCardIds)).size,
    combinedWishlistCards: summaries.reduce((total, summary) => total + summary.wishlistCards, 0),
    combinedDuplicateQuantity: summaries.reduce((total, summary) => total + summary.duplicateQuantity, 0),
    leadingCollectorName: runnerUp && leader.uniqueOwnedCards !== runnerUp.uniqueOwnedCards ? leader.displayName : null,
    leadingCollectorDifference: runnerUp ? Math.abs(leader.uniqueOwnedCards - runnerUp.uniqueOwnedCards) : 0,
  };
}

async function loadRows(collectionIds: string[]): Promise<CollectionCardRow[] | null> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase || collectionIds.length === 0) return [];

  const { data, error } = await supabase
    .from('collection_cards')
    .select('id, collection_id, quantity, status, added_at, created_at, cards_catalog(id, pokemon, set_name, set_code, number, rarity, image_small)')
    .in('collection_id', collectionIds);

  return error ? null : ((data ?? []) as unknown as CollectionCardRow[]);
}

export async function loadChildDashboard(profileId: string, displayName: string, collectionId: string): Promise<DashboardState> {
  try {
    const [rows, sets, recentSetsResult] = await Promise.all([
      loadRows([collectionId]),
      getSetsCatalog(),
      getRecentSetsCatalog().then((recentSets) => ({ recentSets, status: 'ready' as const })).catch(() => ({ recentSets: [], status: 'unavailable' as const })),
    ]);
    if (!rows) return safeErrorState();
    const summary = toSummary({ id: profileId, display_name: displayName }, { id: collectionId, profile_id: profileId }, rows, sets, recentSetsResult.recentSets, recentSetsResult.status);
    return {
      status: 'ready',
      message: summary.totalQuantity > 0 || summary.wishlistCards > 0 ? 'Dashboard geladen.' : 'Je verzameling is nog leeg.',
      summaries: [summary],
      comparison: null,
    };
  } catch {
    return safeErrorState();
  }
}

export async function loadAdminDashboard(): Promise<DashboardState> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return safeErrorState();

  try {
    const [profilesResult, collectionsResult, sets] = await Promise.all([
      supabase.from('profiles').select('id, display_name').eq('role', 'child').order('display_name', { ascending: true }),
      supabase.from('collections').select('id, profile_id').eq('type', 'main'),
      getSetsCatalog(),
    ]);
    if (profilesResult.error || collectionsResult.error) return safeErrorState();

    const profiles = (profilesResult.data ?? []) as ProfileRow[];
    const collections = (collectionsResult.data ?? []) as CollectionRow[];
    const collectionByProfile = new Map(collections.map((collection) => [collection.profile_id, collection]));
    const relevantCollections = profiles.flatMap((profile) => {
      const collection = collectionByProfile.get(profile.id);
      return collection ? [collection] : [];
    });
    const rows = await loadRows(relevantCollections.map((collection) => collection.id));
    if (!rows) return safeErrorState();

    const summaries = profiles.flatMap((profile) => {
      const collection = collectionByProfile.get(profile.id);
      return collection ? [toSummary(profile, collection, rows, sets)] : [];
    });

    return summaries.length > 0
      ? { status: 'ready', message: 'Beheerdashboard geladen.', summaries, comparison: buildComparison(summaries) }
      : { status: 'empty', message: 'Er zijn nog geen kindercollecties beschikbaar.', summaries: [], comparison: null };
  } catch {
    return safeErrorState();
  }
}
