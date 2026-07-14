import {
  addOwnedNearMintCollectionCard,
  classifyDuplicateCollectionCardError,
  isDuplicateCollectionCardMutationError,
  type AddOwnedNearMintCollectionCardParams,
} from '../../collectionCards/collectionCardMutationService';

export type AddedCollectionCard = {
  id: string;
  collection_id: string;
  card_catalog_id: string;
  quantity: number;
  condition: string | null;
  status: string;
};

export type AddCardToCollectionParams = AddOwnedNearMintCollectionCardParams;

export function isDuplicateCollectionCardError(error: unknown): boolean {
  return isDuplicateCollectionCardMutationError(error) || classifyDuplicateCollectionCardError(error) !== null;
}

export async function addCardToCollection(params: AddCardToCollectionParams): Promise<AddedCollectionCard> {
  const card = await addOwnedNearMintCollectionCard(params);

  return {
    id: card.collectionCardId,
    collection_id: card.collectionId,
    card_catalog_id: card.cardCatalogId,
    quantity: card.quantity,
    condition: card.condition,
    status: card.status,
  };
}
