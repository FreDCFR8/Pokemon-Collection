import { createBrowserSupabaseClient } from '../../../lib/supabase';

export type ManagedCollectionCard = {
  id: string;
  collection_id: string;
  card_catalog_id: string;
  quantity: number;
  condition: string | null;
  status: string;
};

export type ManageCollectionCardQuantityParams = {
  collectionId: string;
  collectionCardId: string;
  currentQuantity: number;
};

export type DecreaseCollectionCardQuantityResult =
  | { action: 'updated'; card: ManagedCollectionCard }
  | { action: 'deleted'; collectionCardId: string };

export class CollectionCardQuantityStateError extends Error {
  constructor(
    message: string,
    readonly reason: 'stale' | 'invalid-result',
  ) {
    super(message);
    this.name = 'CollectionCardQuantityStateError';
  }
}

const MANAGED_COLLECTION_CARD_SELECT = 'id, collection_id, card_catalog_id, quantity, condition, status';

function normalizeParams({
  collectionId,
  collectionCardId,
  currentQuantity,
}: ManageCollectionCardQuantityParams): ManageCollectionCardQuantityParams {
  const normalizedCollectionId = collectionId.trim();
  const normalizedCollectionCardId = collectionCardId.trim();

  if (!normalizedCollectionId) {
    throw new Error('Geen actieve collectie beschikbaar.');
  }

  if (!normalizedCollectionCardId) {
    throw new Error('Geen geldige collectiekaart gekozen.');
  }

  if (!Number.isInteger(currentQuantity) || currentQuantity < 1) {
    throw new Error('Het huidige aantal moet een positief geheel getal zijn.');
  }

  return {
    collectionId: normalizedCollectionId,
    collectionCardId: normalizedCollectionCardId,
    currentQuantity,
  };
}

function validateReturnedCard(
  card: ManagedCollectionCard,
  params: ManageCollectionCardQuantityParams,
  expectedQuantity: number,
): ManagedCollectionCard {
  if (
    card.id !== params.collectionCardId ||
    card.collection_id !== params.collectionId ||
    !card.card_catalog_id ||
    card.condition !== 'Near Mint' ||
    card.status !== 'owned' ||
    card.quantity !== expectedQuantity
  ) {
    throw new CollectionCardQuantityStateError(
      'De teruggegeven collectiestatus wijkt af van de verwachte wijziging.',
      'invalid-result',
    );
  }

  return card;
}

export async function increaseCollectionCardQuantity(
  rawParams: ManageCollectionCardQuantityParams,
): Promise<ManagedCollectionCard> {
  const params = normalizeParams(rawParams);
  const expectedQuantity = params.currentQuantity + 1;
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    throw new Error('Aantal bijwerken is niet beschikbaar omdat de publieke Supabase configuratie ontbreekt.');
  }

  const { data, error } = await supabase
    .from('collection_cards')
    .update({ quantity: expectedQuantity })
    .eq('id', params.collectionCardId)
    .eq('collection_id', params.collectionId)
    .eq('quantity', params.currentQuantity)
    .select(MANAGED_COLLECTION_CARD_SELECT)
    .maybeSingle<ManagedCollectionCard>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new CollectionCardQuantityStateError('De quantity is intussen gewijzigd.', 'stale');
  }

  return validateReturnedCard(data, params, expectedQuantity);
}

export async function decreaseCollectionCardQuantity(
  rawParams: ManageCollectionCardQuantityParams,
): Promise<DecreaseCollectionCardQuantityResult> {
  const params = normalizeParams(rawParams);
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    throw new Error('Aantal bijwerken is niet beschikbaar omdat de publieke Supabase configuratie ontbreekt.');
  }

  if (params.currentQuantity === 1) {
    const { data, error } = await supabase
      .from('collection_cards')
      .delete()
      .eq('id', params.collectionCardId)
      .eq('collection_id', params.collectionId)
      .eq('quantity', 1)
      .select(MANAGED_COLLECTION_CARD_SELECT)
      .maybeSingle<ManagedCollectionCard>();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new CollectionCardQuantityStateError('De quantity is intussen gewijzigd.', 'stale');
    }

    validateReturnedCard(data, params, 1);

    return { action: 'deleted', collectionCardId: data.id };
  }

  const expectedQuantity = params.currentQuantity - 1;
  const { data, error } = await supabase
    .from('collection_cards')
    .update({ quantity: expectedQuantity })
    .eq('id', params.collectionCardId)
    .eq('collection_id', params.collectionId)
    .eq('quantity', params.currentQuantity)
    .select(MANAGED_COLLECTION_CARD_SELECT)
    .maybeSingle<ManagedCollectionCard>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new CollectionCardQuantityStateError('De quantity is intussen gewijzigd.', 'stale');
  }

  return { action: 'updated', card: validateReturnedCard(data, params, expectedQuantity) };
}
