import { createBrowserSupabaseClient } from '../../../lib/supabase';

type CollectionCardStateRow = {
  id: string;
  card_catalog_id: string | null;
  quantity: number;
  condition: string | null;
  status: string | null;
};

export type ManageableOwnedNearMintRow = {
  id: string;
  cardCatalogId: string;
  quantity: number;
};

export type SetCardCollectionInfo = {
  hasAnyRecord: boolean;
  manageableOwnedNearMintRow?: ManageableOwnedNearMintRow;
  hasConflictingManageableRows: boolean;
};

export type GetSetCardCollectionInfoParams = {
  collectionId: string;
  cardCatalogIds: string[];
};

const COLLECTION_CARD_STATE_SELECT = 'id, card_catalog_id, quantity, condition, status';

function createEmptyCollectionInfo(): SetCardCollectionInfo {
  return {
    hasAnyRecord: false,
    hasConflictingManageableRows: false,
  };
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export async function getSetCardCollectionInfoForCatalogCards({
  collectionId,
  cardCatalogIds,
}: GetSetCardCollectionInfoParams): Promise<Map<string, SetCardCollectionInfo>> {
  const normalizedCollectionId = collectionId.trim();
  const uniqueCardCatalogIds = [...new Set(cardCatalogIds.map((cardId) => cardId.trim()).filter(Boolean))];
  const infoByCardCatalogId = new Map(
    uniqueCardCatalogIds.map((cardCatalogId) => [cardCatalogId, createEmptyCollectionInfo()]),
  );

  if (uniqueCardCatalogIds.length === 0) {
    return infoByCardCatalogId;
  }

  if (!normalizedCollectionId) {
    throw new Error('Geen actieve collectie beschikbaar.');
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    throw new Error('Collectiestatus kan niet worden opgehaald omdat de publieke Supabase configuratie ontbreekt.');
  }

  const { data, error } = await supabase
    .from('collection_cards')
    .select(COLLECTION_CARD_STATE_SELECT)
    .eq('collection_id', normalizedCollectionId)
    .in('card_catalog_id', uniqueCardCatalogIds)
    .returns<CollectionCardStateRow[]>();

  if (error) {
    throw new Error(`Collectiestatus ophalen uit public.collection_cards is mislukt: ${error.message}`);
  }

  const rowsByCardCatalogId = new Map<string, CollectionCardStateRow[]>();

  for (const row of data ?? []) {
    if (!row.card_catalog_id || !infoByCardCatalogId.has(row.card_catalog_id)) {
      continue;
    }

    const rows = rowsByCardCatalogId.get(row.card_catalog_id) ?? [];
    rows.push(row);
    rowsByCardCatalogId.set(row.card_catalog_id, rows);
  }

  for (const cardCatalogId of uniqueCardCatalogIds) {
    const rows = rowsByCardCatalogId.get(cardCatalogId) ?? [];
    const manageableRows = rows.filter((row) => row.status === 'owned' && row.condition === 'Near Mint');
    const hasInvalidManageableRow = manageableRows.some(
      (row) => !row.id.trim() || row.card_catalog_id !== cardCatalogId || !isPositiveInteger(row.quantity),
    );
    const hasConflictingManageableRows = manageableRows.length > 1 || hasInvalidManageableRow;
    const manageableRow = !hasConflictingManageableRows && manageableRows.length === 1 ? manageableRows[0] : undefined;

    infoByCardCatalogId.set(cardCatalogId, {
      hasAnyRecord: rows.length > 0,
      manageableOwnedNearMintRow: manageableRow
        ? {
            id: manageableRow.id,
            cardCatalogId,
            quantity: manageableRow.quantity,
          }
        : undefined,
      hasConflictingManageableRows,
    });
  }

  return infoByCardCatalogId;
}
