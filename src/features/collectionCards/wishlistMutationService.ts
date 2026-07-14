import { createBrowserSupabaseClient } from '../../lib/supabase/supabaseClient.ts';
import { getCollectionCardOwnershipForCatalogCards } from './collectionCardReadService.ts';
import type { ConfirmedOwnership, OwnershipRecord } from './collectionCardOwnershipTypes';

export type AddCardToWishlistParams = {
  collectionId: string;
  cardCatalogId: string;
};

export type WishlistMutationRecord = {
  collectionCardId: string;
  collectionId: string;
  cardCatalogId: string;
  quantity: 1;
  condition: null;
  status: 'wishlist';
};

export type WishlistMutationErrorReason = 'duplicate' | 'invalid-result' | 'not-ready' | 'stale';

export class WishlistMutationError extends Error {
  readonly reason: WishlistMutationErrorReason;

  constructor(message: string, reason: WishlistMutationErrorReason) {
    super(message);
    this.name = 'WishlistMutationError';
    this.reason = reason;
  }
}

type WishlistDatabaseRow = {
  id: unknown;
  collection_id: unknown;
  card_catalog_id: unknown;
  quantity: unknown;
  condition: unknown;
  status: unknown;
};

type WishlistMutationQuery = {
  insert(values: unknown): WishlistMutationQuery;
  delete(): WishlistMutationQuery;
  select(columns: string): WishlistMutationQuery;
  eq(column: string, value: unknown): WishlistMutationQuery;
  is(column: string, value: unknown): WishlistMutationQuery;
  single(): { returns<U>(): Promise<{ data: U | null; error: unknown }> };
  maybeSingle<U>(): Promise<{ data: U | null; error: unknown }>;
};

type WishlistMutationClient = {
  from(table: 'collection_cards'): WishlistMutationQuery;
};

export type WishlistMutationClientFactory = () => WishlistMutationClient | null;
export type WishlistOwnershipReader = (params: AddCardToWishlistParams) => Promise<ConfirmedOwnership>;

const WISHLIST_MUTATION_SELECT = 'id, collection_id, card_catalog_id, quantity, condition, status';

function normalizeId(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new WishlistMutationError(message, 'not-ready');
  return normalized;
}

function mapAndValidateWishlistRow(
  row: WishlistDatabaseRow,
  expected: AddCardToWishlistParams,
  expectedCollectionCardId?: string,
): WishlistMutationRecord {
  if (
    typeof row.id !== 'string' || !row.id.trim() ||
    (expectedCollectionCardId !== undefined && row.id !== expectedCollectionCardId) ||
    row.collection_id !== expected.collectionId ||
    row.card_catalog_id !== expected.cardCatalogId ||
    row.quantity !== 1 || row.condition !== null || row.status !== 'wishlist'
  ) {
    throw new WishlistMutationError('De wishliststatus wijkt af van de verwachte wijziging.', 'invalid-result');
  }

  return {
    collectionCardId: row.id,
    collectionId: expected.collectionId,
    cardCatalogId: expected.cardCatalogId,
    quantity: 1,
    condition: null,
    status: 'wishlist',
  };
}

function isDuplicateError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === '23505';
}

function createWishlistRecordFromOwnershipRow(
  row: OwnershipRecord<'wishlist'>,
  params: AddCardToWishlistParams,
): WishlistMutationRecord {
  if (
    typeof row.collectionCardId !== 'string' || !row.collectionCardId.trim() ||
    row.collectionId !== params.collectionId ||
    row.cardCatalogId !== params.cardCatalogId ||
    row.quantity !== 1 || row.condition !== null || row.status !== 'wishlist'
  ) {
    throw new WishlistMutationError('De bestaande wishliststatus heeft onverwachte gegevens.', 'invalid-result');
  }

  return {
    collectionCardId: row.collectionCardId,
    collectionId: row.collectionId,
    cardCatalogId: row.cardCatalogId,
    quantity: 1,
    condition: null,
    status: 'wishlist',
  };
}

async function readExistingWishlist(
  params: AddCardToWishlistParams,
  readOwnership: WishlistOwnershipReader,
): Promise<WishlistMutationRecord | null> {
  const ownership = await readOwnership(params);

  if (!ownership || ownership.kind === 'conflict') {
    throw new WishlistMutationError('Wishliststatus kon niet veilig worden bevestigd.', 'not-ready');
  }

  const wishlistRows = ownership.kind === 'snapshot' ? ownership.value.byStatus.wishlist : [];
  if (wishlistRows.length === 0) return null;
  if (wishlistRows.length > 1) {
    throw new WishlistMutationError('Meerdere wishlist-rijen voor deze kaart konden niet veilig worden samengevoegd.', 'duplicate');
  }

  return createWishlistRecordFromOwnershipRow(wishlistRows[0], params);
}

export async function removeCardFromWishlist(
  rawParams: AddCardToWishlistParams,
  createClient: WishlistMutationClientFactory = () => createBrowserSupabaseClient() as unknown as WishlistMutationClient | null,
  readOwnership: WishlistOwnershipReader = async ({ collectionId, cardCatalogId }) => {
    const ownershipByCard = await getCollectionCardOwnershipForCatalogCards({ collectionId, cardCatalogIds: [cardCatalogId] });
    return ownershipByCard.get(cardCatalogId) ?? { kind: 'conflict', reason: 'Geen bevestigde ownershiprespons.' };
  },
): Promise<WishlistMutationRecord> {
  const params = {
    collectionId: normalizeId(rawParams.collectionId, 'Geen actieve collectie beschikbaar.'),
    cardCatalogId: normalizeId(rawParams.cardCatalogId, 'Geen geldige cataloguskaart gekozen.'),
  };
  const existing = await readExistingWishlist(params, readOwnership);
  if (!existing) {
    throw new WishlistMutationError('De wishlistrij bestaat niet meer.', 'stale');
  }

  const supabase = createClient();
  if (!supabase) {
    throw new WishlistMutationError('Wishlist bijwerken is niet beschikbaar omdat de publieke Supabase configuratie ontbreekt.', 'not-ready');
  }

  const { data, error } = await supabase
    .from('collection_cards')
    .delete()
    .eq('id', existing.collectionCardId)
    .eq('collection_id', params.collectionId)
    .eq('card_catalog_id', params.cardCatalogId)
    .eq('status', 'wishlist')
    .eq('quantity', 1)
    .is('condition', null)
    .select(WISHLIST_MUTATION_SELECT)
    .maybeSingle<WishlistDatabaseRow>();

  if (error) throw error;
  if (!data) throw new WishlistMutationError('De wishlistrij is intussen gewijzigd.', 'stale');
  return mapAndValidateWishlistRow(data, params, existing.collectionCardId);
}

export async function addCardToWishlist(
  rawParams: AddCardToWishlistParams,
  createClient: WishlistMutationClientFactory = () => createBrowserSupabaseClient() as unknown as WishlistMutationClient | null,
  readOwnership: WishlistOwnershipReader = async ({ collectionId, cardCatalogId }) => {
    const ownershipByCard = await getCollectionCardOwnershipForCatalogCards({ collectionId, cardCatalogIds: [cardCatalogId] });
    return ownershipByCard.get(cardCatalogId) ?? { kind: 'conflict', reason: 'Geen bevestigde ownershiprespons.' };
  },
): Promise<WishlistMutationRecord> {
  const params = {
    collectionId: normalizeId(rawParams.collectionId, 'Geen actieve collectie beschikbaar.'),
    cardCatalogId: normalizeId(rawParams.cardCatalogId, 'Geen geldige cataloguskaart gekozen.'),
  };

  const existing = await readExistingWishlist(params, readOwnership);
  if (existing) return existing;

  const supabase = createClient();
  if (!supabase) {
    throw new WishlistMutationError('Wishlist bijwerken is niet beschikbaar omdat de publieke Supabase configuratie ontbreekt.', 'not-ready');
  }

  const { data, error } = await supabase
    .from('collection_cards')
    .insert({ collection_id: params.collectionId, card_catalog_id: params.cardCatalogId, quantity: 1, condition: null, status: 'wishlist' })
    .select(WISHLIST_MUTATION_SELECT)
    .single()
    .returns<WishlistDatabaseRow>();

  if (error) {
    if (isDuplicateError(error)) {
      const duplicate = await readExistingWishlist(params, readOwnership);
      if (duplicate) return duplicate;
      throw new WishlistMutationError('Deze kaart staat al op de wishlist, maar de status kon niet worden bevestigd.', 'duplicate');
    }
    throw error;
  }

  if (!data) throw new WishlistMutationError('Wishlist toevoegen gaf geen bevestigde serverresponse.', 'invalid-result');
  return mapAndValidateWishlistRow(data, params);
}

export const __wishlistMutationServiceTestUtils = {
  WISHLIST_MUTATION_SELECT,
  mapAndValidateWishlistRow,
  isDuplicateError,
  readExistingWishlist,
  createWishlistRecordFromOwnershipRow,
};
