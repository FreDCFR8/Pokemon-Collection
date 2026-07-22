import { createBrowserSupabaseClient } from '../../lib/supabase';
import type { DashboardRecentCard, DashboardState, DashboardSummary } from './dashboardTypes';

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
    number: string | null;
    image_small: string | null;
  } | null;
};

function safeErrorState(): DashboardState {
  return { status: 'error', message: 'Het dashboard kon niet veilig worden geladen. Probeer het opnieuw.', summaries: [] };
}

function toSummary(profile: ProfileRow, collection: CollectionRow, rows: CollectionCardRow[]): DashboardSummary {
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

  return {
    profileId: profile.id,
    displayName: profile.display_name,
    collectionId: collection.id,
    totalQuantity: ownedRows.reduce((total, row) => total + row.quantity, 0),
    uniqueOwnedCards: new Set(ownedRows.map((row) => row.cards_catalog?.id).filter(Boolean)).size,
    wishlistCards: wishlistRows.length,
    recentCards,
  };
}

async function loadRows(collectionIds: string[]): Promise<CollectionCardRow[] | null> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase || collectionIds.length === 0) return [];

  const { data, error } = await supabase
    .from('collection_cards')
    .select('id, collection_id, quantity, status, added_at, created_at, cards_catalog(id, pokemon, set_name, number, image_small)')
    .in('collection_id', collectionIds);

  return error ? null : ((data ?? []) as unknown as CollectionCardRow[]);
}

export async function loadChildDashboard(profileId: string, displayName: string, collectionId: string): Promise<DashboardState> {
  const rows = await loadRows([collectionId]);
  if (!rows) return safeErrorState();

  const summary = toSummary({ id: profileId, display_name: displayName }, { id: collectionId, profile_id: profileId }, rows);
  return {
    status: 'ready',
    message: summary.totalQuantity > 0 || summary.wishlistCards > 0 ? 'Dashboard geladen.' : 'Je verzameling is nog leeg.',
    summaries: [summary],
  };
}

export async function loadAdminDashboard(): Promise<DashboardState> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return safeErrorState();

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

  const summaries = profiles.flatMap((profile) => {
    const collection = collectionByProfile.get(profile.id);
    return collection ? [toSummary(profile, collection, rows)] : [];
  });

  return summaries.length > 0
    ? { status: 'ready', message: 'Beheerdashboard geladen.', summaries }
    : { status: 'empty', message: 'Er zijn nog geen kindercollecties beschikbaar.', summaries: [] };
}
