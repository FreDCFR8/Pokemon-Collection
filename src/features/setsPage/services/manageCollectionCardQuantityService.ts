import {
  CollectionCardMutationError,
  decreaseCollectionCardQuantity as decreaseSharedCollectionCardQuantity,
  increaseCollectionCardQuantity as increaseSharedCollectionCardQuantity,
  type CollectionCardMutationErrorReason,
  type CollectionCardMutationRecord,
  type MutateCollectionCardQuantityParams,
} from '../../collectionCards/collectionCardMutationService';

export type ManagedCollectionCard = {
  id: string;
  collection_id: string;
  card_catalog_id: string;
  quantity: number;
  condition: string | null;
  status: string;
};

export type ManageCollectionCardQuantityParams = MutateCollectionCardQuantityParams;

export type DecreaseCollectionCardQuantityResult =
  | { action: 'updated'; card: ManagedCollectionCard }
  | { action: 'deleted'; collectionCardId: string };

export class CollectionCardQuantityStateError extends CollectionCardMutationError {
  constructor(message: string, reason: Exclude<CollectionCardMutationErrorReason, 'duplicate'>) {
    super(message, reason);
    this.name = 'CollectionCardQuantityStateError';
  }
}

function toManagedCollectionCard(card: CollectionCardMutationRecord): ManagedCollectionCard {
  return {
    id: card.collectionCardId,
    collection_id: card.collectionId,
    card_catalog_id: card.cardCatalogId,
    quantity: card.quantity,
    condition: card.condition,
    status: card.status,
  };
}

function wrapQuantityError(error: unknown): never {
  if (error instanceof CollectionCardMutationError && error.reason !== 'duplicate') {
    throw new CollectionCardQuantityStateError(error.message, error.reason);
  }

  throw error;
}

export async function increaseCollectionCardQuantity(
  params: ManageCollectionCardQuantityParams,
): Promise<ManagedCollectionCard> {
  try {
    return toManagedCollectionCard(await increaseSharedCollectionCardQuantity(params));
  } catch (error) {
    wrapQuantityError(error);
  }
}

export async function decreaseCollectionCardQuantity(
  params: ManageCollectionCardQuantityParams,
): Promise<DecreaseCollectionCardQuantityResult> {
  try {
    const result = await decreaseSharedCollectionCardQuantity(params);

    return result.action === 'updated'
      ? { action: 'updated', card: toManagedCollectionCard(result.card) }
      : result;
  } catch (error) {
    wrapQuantityError(error);
  }
}
