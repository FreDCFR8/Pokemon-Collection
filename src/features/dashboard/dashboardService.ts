import { createBrowserSupabaseClient } from '../../lib/supabase';
import { getSetsCatalog } from '../../services/setsCatalogService';
import { getSetProgressForCollection } from '../setsPage/services/setsProgressService';
import type {
  DashboardComparison,
  DashboardRecentCard,
  DashboardRarityInsight,
  DashboardSetInsight,
  DashboardState,
  DashboardSummary,
} from './dashboardTypes';

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

function buildRarityInsights(rows: CollectionCardRow[]): DashboardRarityInsight[] {
  const idsByRarity = new Map<string, Set<string>>();

  for (const row of rows) {
    const card = row.cards_catalog;
    if (!card) continue;
    const rarity = card.rarity?.trim() || 'Onbekend';
    const ids = idsByRarity.get(rarity) ?? new Set<string>();
    ids.add(card.id);
    idsByRarity.set(rarity, ids);
  }

  return [...idsByRarity.entries()]
    .map(([rarity, ids]) => ({ rarity, uniqueCards: ids.size }))
    .sort((first, second) => second.uniqueCards - first.uniqueCards || first.rarity.localeCompare(second.rarity, 'nl'))
    .slice(0, 4);
}

async function buildSetInsights(collectionId: string): Promise<DashboardSetInsight[]> {
  const [progressRows, sets] = await Promise.all([getSetProgressForCollection(collectionId), getSetsCatalog()]);
  const setsByCode = new Map(sets.map((set) => [set.set_code, set]));

  return progressRows
    .flatMap((progress) => {
      const set = setsByCode.get(progress.setCode);
      const total = progress.total ?? progress.printedTotal;
      if (!set || total === null || total <= 0 || progress.progressPercent === null) return [];
      return [{
        setCode: progress.setCode,
        setName: set.name,
        ownedCount: progress.ownedCount,
        total,
        missingCount: Math.max(0, total - progress.ownedCount),
        progressPercent: progress.progressPercent,
      }];
    })
    .sort((first, second) => second.progressPercent - first.progressPercent || second.ownedCount - first.ownedCount || first.setName.localeCompare(second.setName, 'nl'))
    .slice(0, 4);
}

async function toSummary(profile: ProfileRow, collection: CollectionRow, rows: CollectionCardRow[]): Promise<DashboardSummary> {
  const collectionRows = rows.filter((row) => row.collection_id === collection.id);
  const ownedRows = collectionRows.filter((row) => row.status === 'owned');
  const wishlistRows = collectionRows.filter((row) => row.status === 'wishlist');
  const recentCards: DashboardRecentCard[] = ownedRows
    .filter((row) => row.cards_catalog)
    .sort((first, second) => `${second.added_at}-${second.created_at}`.localeCompare(`${first.added_at}-${first.created_at}`))
    .slice(0, 4)
    .map((row) => ({
      id: row.cards_catalog!.id,
      pokemon: row.cards_catalog!.pokemon,
      setName: row.cards_catalog!.set_name,
      number: row.cards_catalog!.number,
      imageSmall: row.cards_catalog!.image_small,
      quantity: row.quantity,
      addedAt: row.added_at,
    }));
  const setInsights = await buildSetInsights(collection.id);

  return {
    profileId: profile.id,
    displayName: profile.display_name,
    collectionId: collection.id,
    totalQuantity: ownedRows.reduce((total, row) => total + row.quantity, 0),
    uniqueOwnedCards: new Set(ownedRows.map((row) => row.cards_catalog?.id).filter(Boolean)).size,
    wishlistCards: wishlistRows.length,
    duplicateQuantity: ownedRows.reduce((total, row) => total + Math.max(0, row.quantity - 1), 0),
    recentCards,
    rarityInsights: buildRarityInsights(ownedRows),
    setInsights,
    continueCollecting: setInsights.find((set) => set.missingCount > 0) ?? null,
  };
}

function buildComparison(summaries: DashboardSummary[]): DashboardComparison | null {
  if (summaries.length === 0) return null;
  const sorted = [...summaries].sort((first, second) => second.uniqueOwnedCards - first.uniqueOwnedCards);
  const leader = sorted[0];
  const runnerUp = sorted[1];

  return {
    combinedQuantity: summaries.reduce((total, summary) => total + summary.totalQuantity, 0),
    combinedUniqueCards: new Set(summaries.flatMap((summary) => summary.recentCards.map((card) => card.id))).size,
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
    const rows = await loadRows([collectionId]);
    if (!rows) return safeErrorState();
    const summary = await toSummary({ id: profileId, display_name: displayName }, { id: collectionId, profile_id: profileId }, rows);
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
    const [profilesResult, collectionsResult] = await Promise.all([
      supabase.from('profiles').select('id, display_name').eq('role', 'child').order('display_name', { ascending: true }),
      supabase.from('collections').select('id, profile_id').eq('type', 'main'),
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

    const summaries = await Promise.all(profiles.flatMap((profile) => {
      const collection = collectionByProfile.get(profile.id);
      return collection ? [toSummary(profile, collection, rows)] : [];
    }));

    return summaries.length > 0
      ? { status: 'ready', message: 'Beheerdashboard geladen.', summaries, comparison: buildComparison(summaries) }
      : { status: 'empty', message: 'Er zijn nog geen kindercollecties beschikbaar.', summaries: [], comparison: null };
  } catch {
    return safeErrorState();
  }
}