import { createBrowserSupabaseClient } from '../../lib/supabase/supabaseClient.ts';
import { projectCollectionOwnershipBatch } from './collectionCardOwnershipProjector.ts';
import { createCollectionCardReadBatches } from './collectionCardReadBatching.ts';
import type { ConfirmedOwnership, OwnershipRecordInput } from './collectionCardOwnershipTypes';

type CollectionCardStateDatabaseRow = {
  id: unknown;
  collection_id: unknown;
  card_catalog_id: unknown;
  quantity: unknown;
  condition: unknown;
  status: unknown;
};

export type GetCollectionCardOwnershipParams = {
  collectionId: string;
  cardCatalogIds: string[];
};

const COLLECTION_CARD_STATE_SELECT = 'id, collection_id, card_catalog_id, quantity, condition, status';

function mapDatabaseRow(row: CollectionCardStateDatabaseRow): OwnershipRecordInput {
  return {
    collectionCardId: row.id,
    collectionId: row.collection_id,
    cardCatalogId: row.card_catalog_id,
    quantity: row.quantity,
    condition: row.condition,
    status: row.status,
  };
}

export async function getCollectionCardOwnershipForCatalogCards({
  collectionId,
  cardCatalogIds,
}: GetCollectionCardOwnershipParams): Promise<Map<string, ConfirmedOwnership>> {
  const normalizedCollectionId = collectionId.trim();
  const cardCatalogIdBatches = createCollectionCardReadBatches(cardCatalogIds);
  const uniqueCardCatalogIds = cardCatalogIdBatches.flat();

  if (uniqueCardCatalogIds.length === 0) {
    return new Map();
  }

  if (!normalizedCollectionId) {
    throw new Error('Geen actieve collectie beschikbaar.');
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    throw new Error('Collectiestatus kan niet worden opgehaald omdat de publieke Supabase configuratie ontbreekt.');
  }

  const databaseRowsByBatch = await Promise.all(
    cardCatalogIdBatches.map(async (cardCatalogIdBatch) => {
      const { data, error } = await supabase
        .from('collection_cards')
        .select(COLLECTION_CARD_STATE_SELECT)
        .eq('collection_id', normalizedCollectionId)
        .in('card_catalog_id', cardCatalogIdBatch)
        .returns<CollectionCardStateDatabaseRow[]>();

      if (error) {
        throw new Error(`Collectiestatus ophalen uit public.collection_cards is mislukt: ${error.message}`);
      }

      return data ?? [];
    }),
  );

  return projectCollectionOwnershipBatch({
    collectionId: normalizedCollectionId,
    cardCatalogIds: uniqueCardCatalogIds,
    records: databaseRowsByBatch.flat().map(mapDatabaseRow),
  });
}
