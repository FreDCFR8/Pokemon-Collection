export type CollectionCardMutationRecord = {
  collectionCardId: string;
  collectionId: string;
  cardCatalogId: string;
  quantity: number;
  condition: string | null;
  status: string;
};

export type AddOwnedNearMintCollectionCardParams = {
  collectionId: string;
  cardCatalogId: string;
};

export type MutateCollectionCardQuantityParams = {
  collectionId: string;
  collectionCardId: string;
  currentQuantity: number;
};

export type DecreaseCollectionCardQuantityMutationResult =
  | { action: 'updated'; card: CollectionCardMutationRecord }
  | { action: 'deleted'; collectionCardId: string };

export type CollectionCardMutationErrorReason = 'duplicate' | 'stale' | 'invalid-result';

export class CollectionCardMutationError extends Error {
  readonly reason: CollectionCardMutationErrorReason;

  constructor(message: string, reason: CollectionCardMutationErrorReason) {
    super(message);
    this.reason = reason;
    this.name = 'CollectionCardMutationError';
  }
}

type CollectionCardMutationDatabaseRow = {
  id: unknown;
  collection_id: unknown;
  card_catalog_id: unknown;
  quantity: unknown;
  condition: unknown;
  status: unknown;
};

type MutationQueryResult<T> = { data: T | null; error: unknown };

type MutationQueryBuilder<T> = {
  insert(values: unknown): MutationQueryBuilder<T>;
  update(values: unknown): MutationQueryBuilder<T>;
  delete(): MutationQueryBuilder<T>;
  select(columns: string): MutationQueryBuilder<T>;
  eq(column: string, value: unknown): MutationQueryBuilder<T>;
  single(): { returns<U>(): Promise<MutationQueryResult<U>> };
  maybeSingle<U>(): Promise<MutationQueryResult<U>>;
};

type CollectionCardsMutationClient = {
  from(table: 'collection_cards'): MutationQueryBuilder<CollectionCardMutationDatabaseRow>;
};

export type CollectionCardsMutationClientFactory = () => CollectionCardsMutationClient | null;

const COLLECTION_CARD_MUTATION_SELECT = 'id, collection_id, card_catalog_id, quantity, condition, status';

function normalizeRequiredId(value: string, message: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function normalizeAddParams({ collectionId, cardCatalogId }: AddOwnedNearMintCollectionCardParams) {
  return {
    collectionId: normalizeRequiredId(collectionId, 'Geen actieve collectie beschikbaar.'),
    cardCatalogId: normalizeRequiredId(cardCatalogId, 'Geen geldige cataloguskaart gekozen.'),
  };
}

function normalizeQuantityParams({
  collectionId,
  collectionCardId,
  currentQuantity,
}: MutateCollectionCardQuantityParams): MutateCollectionCardQuantityParams {
  return {
    collectionId: normalizeRequiredId(collectionId, 'Geen actieve collectie beschikbaar.'),
    collectionCardId: normalizeRequiredId(collectionCardId, 'Geen geldige collectiekaart gekozen.'),
    currentQuantity: normalizeQuantity(currentQuantity),
  };
}

function normalizeQuantity(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Het huidige aantal moet een positief geheel getal zijn.');
  }

  return quantity;
}

function getMutationClient(createClient: CollectionCardsMutationClientFactory): CollectionCardsMutationClient {
  const supabase = createClient();

  if (!supabase) {
    throw new Error('Collectiekaart bijwerken is niet beschikbaar omdat de publieke Supabase configuratie ontbreekt.');
  }

  return supabase;
}

function isDuplicateCollectionCardErrorLike(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === '23505';
}

export function isDuplicateCollectionCardMutationError(error: unknown): boolean {
  return error instanceof CollectionCardMutationError && error.reason === 'duplicate';
}

export function classifyDuplicateCollectionCardError(error: unknown): CollectionCardMutationError | null {
  return isDuplicateCollectionCardErrorLike(error)
    ? new CollectionCardMutationError('Deze kaart staat al in de collectie.', 'duplicate')
    : null;
}

function mapAndValidateCard(
  row: CollectionCardMutationDatabaseRow | CollectionCardMutationRecord,
  expected: { collectionId: string; cardCatalogId?: string; collectionCardId?: string; quantity: number },
): CollectionCardMutationRecord {
  const card = 'collectionCardId' in row
    ? row
    : {
        collectionCardId: row.id,
        collectionId: row.collection_id,
        cardCatalogId: row.card_catalog_id,
        quantity: row.quantity,
        condition: row.condition,
        status: row.status,
      };

  if (
    typeof card.collectionCardId !== 'string' ||
    !card.collectionCardId.trim() ||
    card.collectionId !== expected.collectionId ||
    (expected.collectionCardId !== undefined && card.collectionCardId !== expected.collectionCardId) ||
    typeof card.cardCatalogId !== 'string' ||
    !card.cardCatalogId.trim() ||
    (expected.cardCatalogId !== undefined && card.cardCatalogId !== expected.cardCatalogId) ||
    card.quantity !== expected.quantity ||
    card.condition !== 'Near Mint' ||
    card.status !== 'owned'
  ) {
    throw new CollectionCardMutationError('De teruggegeven collectiestatus wijkt af van de verwachte wijziging.', 'invalid-result');
  }

  return card as CollectionCardMutationRecord;
}

export async function addOwnedNearMintCollectionCard(
  rawParams: AddOwnedNearMintCollectionCardParams,
  createClient: CollectionCardsMutationClientFactory,
): Promise<CollectionCardMutationRecord> {
  const params = normalizeAddParams(rawParams);
  const supabase = getMutationClient(createClient);
  const { data, error } = await supabase
    .from('collection_cards')
    .insert({
      collection_id: params.collectionId,
      card_catalog_id: params.cardCatalogId,
      quantity: 1,
      condition: 'Near Mint',
      status: 'owned',
    })
    .select(COLLECTION_CARD_MUTATION_SELECT)
    .single()
    .returns<CollectionCardMutationDatabaseRow>();

  if (error) {
    throw classifyDuplicateCollectionCardError(error) ?? error;
  }

  if (!data) {
    throw new CollectionCardMutationError('Kaart toevoegen is mislukt. Probeer opnieuw.', 'invalid-result');
  }

  return mapAndValidateCard(data, { collectionId: params.collectionId, cardCatalogId: params.cardCatalogId, quantity: 1 });
}

export async function increaseCollectionCardQuantity(
  rawParams: MutateCollectionCardQuantityParams,
  createClient: CollectionCardsMutationClientFactory,
): Promise<CollectionCardMutationRecord> {
  const params = normalizeQuantityParams(rawParams);
  const expectedQuantity = params.currentQuantity + 1;
  const supabase = getMutationClient(createClient);
  const { data, error } = await supabase
    .from('collection_cards')
    .update({ quantity: expectedQuantity })
    .eq('id', params.collectionCardId)
    .eq('collection_id', params.collectionId)
    .eq('quantity', params.currentQuantity)
    .select(COLLECTION_CARD_MUTATION_SELECT)
    .maybeSingle<CollectionCardMutationDatabaseRow>();

  if (error) throw error;
  if (!data) throw new CollectionCardMutationError('De quantity is intussen gewijzigd.', 'stale');

  return mapAndValidateCard(data, { collectionId: params.collectionId, collectionCardId: params.collectionCardId, quantity: expectedQuantity });
}

export async function decreaseCollectionCardQuantity(
  rawParams: MutateCollectionCardQuantityParams,
  createClient: CollectionCardsMutationClientFactory,
): Promise<DecreaseCollectionCardQuantityMutationResult> {
  const params = normalizeQuantityParams(rawParams);
  const supabase = getMutationClient(createClient);

  if (params.currentQuantity === 1) {
    const { data, error } = await supabase
      .from('collection_cards')
      .delete()
      .eq('id', params.collectionCardId)
      .eq('collection_id', params.collectionId)
      .eq('quantity', 1)
      .select(COLLECTION_CARD_MUTATION_SELECT)
      .maybeSingle<CollectionCardMutationDatabaseRow>();

    if (error) throw error;
    if (!data) throw new CollectionCardMutationError('De quantity is intussen gewijzigd.', 'stale');

    const deletedCard = mapAndValidateCard(data, { collectionId: params.collectionId, collectionCardId: params.collectionCardId, quantity: 1 });
    return { action: 'deleted', collectionCardId: deletedCard.collectionCardId };
  }

  const expectedQuantity = params.currentQuantity - 1;
  const { data, error } = await supabase
    .from('collection_cards')
    .update({ quantity: expectedQuantity })
    .eq('id', params.collectionCardId)
    .eq('collection_id', params.collectionId)
    .eq('quantity', params.currentQuantity)
    .select(COLLECTION_CARD_MUTATION_SELECT)
    .maybeSingle<CollectionCardMutationDatabaseRow>();

  if (error) throw error;
  if (!data) throw new CollectionCardMutationError('De quantity is intussen gewijzigd.', 'stale');

  return { action: 'updated', card: mapAndValidateCard(data, { collectionId: params.collectionId, collectionCardId: params.collectionCardId, quantity: expectedQuantity }) };
}

export const __collectionCardMutationServiceTestUtils = {
  COLLECTION_CARD_MUTATION_SELECT,
  normalizeAddParams,
  normalizeQuantityParams,
  mapAndValidateCard,
  classifyDuplicateCollectionCardError,
};
