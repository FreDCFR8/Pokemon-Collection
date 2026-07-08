import { createBrowserSupabaseClient } from '../../lib/supabase';
import { checkCollectionReadiness } from '../collections';
import type { CollectionCardPreviewItem, CollectionCardsPreviewState } from './collectionCardsPreviewTypes';

const PREVIEW_LIMIT = 12;

type CardsCatalogPreviewRow = {
  pokemon: string | null;
  set_name: string | null;
  number: string | null;
  rarity: string | null;
  image_small: string | null;
};

type CollectionCardOwnershipRow = {
  quantity: number | null;
  condition: string | null;
  status: string | null;
  added_at: string | null;
};

type CollectionCardPreviewRow = CardsCatalogPreviewRow & {
  collection_cards: CollectionCardOwnershipRow | CollectionCardOwnershipRow[] | null;
};

function toSafeErrorMessage(message: string | undefined): string {
  if (!message) {
    return 'Onbekende kaartenpreviewfout.';
  }

  return message
    .replace(/https?:\/\/\S+/g, '[url verborgen]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, '[id verborgen]')
    .slice(0, 240);
}

function firstOwnershipRow(
  collectionCards: CollectionCardPreviewRow['collection_cards'],
): CollectionCardOwnershipRow | null {
  if (Array.isArray(collectionCards)) {
    return collectionCards[0] ?? null;
  }

  return collectionCards;
}

function toPreviewItem(row: CollectionCardPreviewRow): CollectionCardPreviewItem {
  const ownership = firstOwnershipRow(row.collection_cards);

  return {
    pokemon: row.pokemon ?? null,
    setName: row.set_name ?? null,
    number: row.number ?? null,
    rarity: row.rarity ?? null,
    quantity: ownership?.quantity ?? null,
    condition: ownership?.condition ?? null,
    status: ownership?.status ?? null,
    imageSmall: row.image_small ?? null,
    addedAt: ownership?.added_at ?? null,
  };
}

export async function loadCollectionCardsPreview(): Promise<CollectionCardsPreviewState> {
  const collectionReadiness = await checkCollectionReadiness();

  if (collectionReadiness.status === 'config-missing') {
    return {
      status: 'config-missing',
      message: collectionReadiness.message,
      totalCount: 0,
      previewCards: [],
    };
  }

  if (collectionReadiness.status === 'signed-out') {
    return {
      status: 'signed-out',
      message: collectionReadiness.message,
      totalCount: 0,
      previewCards: [],
    };
  }

  if (collectionReadiness.status === 'profile-missing') {
    return {
      status: 'profile-missing',
      message: collectionReadiness.message,
      totalCount: 0,
      previewCards: [],
    };
  }

  if (collectionReadiness.status === 'collection-missing') {
    return {
      status: 'collection-missing',
      message: collectionReadiness.message,
      totalCount: 0,
      previewCards: [],
    };
  }

  if (collectionReadiness.status === 'error') {
    return {
      status: 'error',
      message: 'Kaartenpreview kan niet starten omdat de collectiecontrole is mislukt.',
      totalCount: 0,
      previewCards: [],
      errorMessage: toSafeErrorMessage(collectionReadiness.errorMessage),
    };
  }

  const mainCollectionId = collectionReadiness.mainCollection?.id;

  if (!mainCollectionId) {
    return {
      status: 'collection-missing',
      message: 'Er is nog geen hoofdcollectie gekoppeld aan dit profiel.',
      totalCount: 0,
      previewCards: [],
    };
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return {
      status: 'config-missing',
      message: 'Kaartenpreview kan niet starten omdat de publieke Supabase configuratie ontbreekt.',
      totalCount: 0,
      previewCards: [],
    };
  }

  const { count, error: countError } = await supabase
    .from('collection_cards')
    .select('id', { count: 'exact', head: true })
    .eq('collection_id', mainCollectionId);

  if (countError) {
    return {
      status: 'error',
      message: 'Kaartenpreview tellen is mislukt.',
      totalCount: 0,
      previewCards: [],
      errorMessage: toSafeErrorMessage(countError.message),
    };
  }

  const { data, error } = await supabase
    .from('cards_catalog')
    .select(
      `
        pokemon,
        set_name,
        number,
        rarity,
        image_small,
        collection_cards!inner (
          quantity,
          condition,
          status,
          added_at
        )
      `,
    )
    .eq('collection_cards.collection_id', mainCollectionId)
    .order('pokemon', { ascending: true })
    .order('set_name', { ascending: true })
    .order('number', { ascending: true })
    .limit(PREVIEW_LIMIT);

  if (error) {
    return {
      status: 'error',
      message: 'Kaartenpreview laden is mislukt.',
      totalCount: count ?? 0,
      previewCards: [],
      errorMessage: toSafeErrorMessage(error.message),
    };
  }

  return {
    status: 'ready',
    message: count ? 'Kaartenpreview geladen.' : 'Nog geen kaarten in deze collectie.',
    totalCount: count ?? 0,
    previewCards: ((data ?? []) as CollectionCardPreviewRow[]).map(toPreviewItem),
  };
}
