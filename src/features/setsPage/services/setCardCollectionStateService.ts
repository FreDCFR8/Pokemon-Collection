import { createBrowserSupabaseClient } from '../../../lib/supabase';

type CollectionCardCatalogIdRow = {
  id: string;
  card_catalog_id: string | null;
};

export type GetCollectionCardIdsForCatalogCardsParams = {
  collectionId: string;
  cardCatalogIds: string[];
};

const COLLECTION_CARD_CATALOG_ID_SELECT = 'id, card_catalog_id';

export async function getCollectionCardIdsForCatalogCards({
  collectionId,
  cardCatalogIds,
}: GetCollectionCardIdsForCatalogCardsParams): Promise<Set<string>> {
  const normalizedCollectionId = collectionId.trim();
  const uniqueCardCatalogIds = [...new Set(cardCatalogIds.map((cardId) => cardId.trim()).filter(Boolean))];

  if (!normalizedCollectionId || uniqueCardCatalogIds.length === 0) {
    return new Set();
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    throw new Error('Collectiestatus kan niet worden opgehaald omdat de publieke Supabase configuratie ontbreekt.');
  }

  const { data, error } = await supabase
    .from('collection_cards')
    .select(COLLECTION_CARD_CATALOG_ID_SELECT)
    .eq('collection_id', normalizedCollectionId)
    .in('card_catalog_id', uniqueCardCatalogIds)
    .returns<CollectionCardCatalogIdRow[]>();

  if (error) {
    throw new Error(`Collectiestatus ophalen uit public.collection_cards is mislukt: ${error.message}`);
  }

  return new Set((data ?? []).flatMap((row) => (row.card_catalog_id ? [row.card_catalog_id] : [])));
}
