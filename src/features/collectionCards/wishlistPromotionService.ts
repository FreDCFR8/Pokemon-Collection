import { createBrowserSupabaseClient } from '../../lib/supabase/supabaseClient.ts';

export type PromoteWishlistToOwnedParams = {
  collectionId: string;
  cardCatalogId: string;
};

export type PromotedWishlistRecord = {
  collectionCardId: string;
  collectionId: string;
  cardCatalogId: string;
  quantity: 1;
  condition: 'Near Mint';
  status: 'owned';
};

export type WishlistPromotionErrorReason = 'not-ready' | 'stale' | 'conflict' | 'invalid-result';

export class WishlistPromotionError extends Error {
  readonly reason: WishlistPromotionErrorReason;

  constructor(message: string, reason: WishlistPromotionErrorReason) {
    super(message);
    this.name = 'WishlistPromotionError';
    this.reason = reason;
  }
}

type PromotionDatabaseRow = {
  id: unknown;
  collection_id: unknown;
  card_catalog_id: unknown;
  quantity: unknown;
  condition: unknown;
  status: unknown;
};

type PromotionClient = {
  rpc(name: 'promote_wishlist_to_owned', params: { p_collection_id: string; p_card_catalog_id: string }): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export type WishlistPromotionClientFactory = () => PromotionClient | null;

const PROMOTION_RPC_NAME = 'promote_wishlist_to_owned';

function normalizeId(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new WishlistPromotionError(message, 'not-ready');
  return normalized;
}

function mapAndValidatePromotionRow(row: PromotionDatabaseRow, params: PromoteWishlistToOwnedParams): PromotedWishlistRecord {
  if (
    typeof row.id !== 'string' || !row.id.trim() ||
    row.collection_id !== params.collectionId ||
    row.card_catalog_id !== params.cardCatalogId ||
    row.quantity !== 1 || row.condition !== 'Near Mint' || row.status !== 'owned'
  ) {
    throw new WishlistPromotionError('De promotierespons kon niet veilig worden bevestigd.', 'invalid-result');
  }

  return {
    collectionCardId: row.id,
    collectionId: params.collectionId,
    cardCatalogId: params.cardCatalogId,
    quantity: 1,
    condition: 'Near Mint',
    status: 'owned',
  };
}

function classifyPromotionError(error: { message?: string } | null): WishlistPromotionError | null {
  if (!error) return null;
  const message = error.message ?? '';
  if (/actieve collectie|ingelogde gebruiker|authenticatie/i.test(message)) {
    return new WishlistPromotionError('Promotie is niet beschikbaar voor deze collectie.', 'not-ready');
  }
  if (/conflicterende|exact één|wishlistrij|promotie-eigenschappen/i.test(message)) {
    return new WishlistPromotionError('Wishliststatus is intussen gewijzigd of conflicteert met collectiegegevens.', 'conflict');
  }
  return null;
}

export async function promoteWishlistToOwned(
  rawParams: PromoteWishlistToOwnedParams,
  createClient: WishlistPromotionClientFactory = () => createBrowserSupabaseClient() as unknown as PromotionClient | null,
): Promise<PromotedWishlistRecord> {
  const params = {
    collectionId: normalizeId(rawParams.collectionId, 'Geen actieve collectie beschikbaar.'),
    cardCatalogId: normalizeId(rawParams.cardCatalogId, 'Geen geldige cataloguskaart gekozen.'),
  };
  const client = createClient();
  if (!client) throw new WishlistPromotionError('Kaartpromotie is niet beschikbaar omdat de publieke Supabase configuratie ontbreekt.', 'not-ready');

  const { data, error } = await client.rpc(PROMOTION_RPC_NAME, {
    p_collection_id: params.collectionId,
    p_card_catalog_id: params.cardCatalogId,
  });
  if (error) throw classifyPromotionError(error) ?? error;

  if (!Array.isArray(data) || data.length !== 1) {
    throw new WishlistPromotionError('De promotierespons bevat niet exact één collectierij.', 'invalid-result');
  }

  return mapAndValidatePromotionRow(data[0] as PromotionDatabaseRow, params);
}

export const __wishlistPromotionServiceTestUtils = {
  PROMOTION_RPC_NAME,
  mapAndValidatePromotionRow,
  classifyPromotionError,
};
