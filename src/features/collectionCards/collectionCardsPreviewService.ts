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

type CollectionCardPreviewRow = {
  quantity: number | null;
  condition: string | null;
  status: string | null;
  added_at: string | null;
  cards_catalog: CardsCatalogPreviewRow | CardsCatalogPreviewRow[] | null;
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

function firstCatalogRow(cardsCatalog: CollectionCardPreviewRow['cards_catalog']): CardsCatalogPreviewRow | null {
  if (Array.isArray(cardsCatalog)) {
    return cardsCatalog[0] ?? null;
  }

  return cardsCatalog;
}

function toPreviewItem(row: CollectionCardPreviewRow): CollectionCardPreviewItem {
  const catalog = firstCatalogRow(row.cards_catalog);

  return {
    pokemon: catalog?.pokemon ?? null,
    setName: catalog?.set_name ?? null,
    number: catalog?.number ?? null,
    rarity: catalog?.rarity ?? null,
    quantity: row.quantity,
    condition: row.condition,
    status: row.status,
    imageSmall: catalog?.image_small ?? null,
    addedAt: row.added_at,
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
    .from('collection_cards')
    .select(
      `
        quantity,
        condition,
        status,
        added_at,
        cards_catalog (
          pokemon,
          set_name,
          number,
          rarity,
          image_small
        )
      `,
    )
    .eq('collection_id', mainCollectionId)
    .order('pokemon', { referencedTable: 'cards_catalog', ascending: true })
    .order('set_name', { referencedTable: 'cards_catalog', ascending: true })
    .order('number', { referencedTable: 'cards_catalog', ascending: true })
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
