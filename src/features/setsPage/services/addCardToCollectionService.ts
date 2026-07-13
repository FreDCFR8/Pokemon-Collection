import { createBrowserSupabaseClient } from '../../../lib/supabase';

export type AddedCollectionCard = {
  id: string;
  collection_id: string;
  card_catalog_id: string;
  quantity: number;
  condition: string | null;
  status: string;
};

export type AddCardToCollectionParams = {
  collectionId: string;
  cardCatalogId: string;
};

export function isDuplicateCollectionCardError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

export async function addCardToCollection({
  collectionId,
  cardCatalogId,
}: AddCardToCollectionParams): Promise<AddedCollectionCard> {
  const normalizedCollectionId = collectionId.trim();
  const normalizedCardCatalogId = cardCatalogId.trim();

  if (!normalizedCollectionId) {
    throw new Error('Geen actieve collectie beschikbaar.');
  }

  if (!normalizedCardCatalogId) {
    throw new Error('Geen geldige cataloguskaart gekozen.');
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    throw new Error('Kaart toevoegen is niet beschikbaar omdat de publieke Supabase configuratie ontbreekt.');
  }

  const { data, error } = await supabase
    .from('collection_cards')
    .insert({
      collection_id: normalizedCollectionId,
      card_catalog_id: normalizedCardCatalogId,
      quantity: 1,
      condition: 'Near Mint',
      status: 'owned',
    })
    .select('id, collection_id, card_catalog_id, quantity, condition, status')
    .single()
    .returns<AddedCollectionCard>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Kaart toevoegen is mislukt. Probeer opnieuw.');
  }

  if (
    data.collection_id !== normalizedCollectionId ||
    data.card_catalog_id !== normalizedCardCatalogId ||
    data.quantity !== 1 ||
    data.condition !== 'Near Mint' ||
    data.status !== 'owned'
  ) {
    throw new Error('De toegevoegde kaart kon niet veilig worden bevestigd.');
  }

  return data;
}
