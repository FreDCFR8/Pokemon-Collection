import { createBrowserSupabaseClient } from '../../../lib/supabase';

export const SET_CARDS_BATCH_SIZE = 30;

export type SetCardsSortOption = 'name-asc' | 'name-desc';

export type SetCatalogCard = {
  id: string;
  pokemon: string;
  number: string | null;
  rarity: string | null;
  image_small: string | null;
  image_large: string | null;
};

export type SetCardsResult = {
  cards: SetCatalogCard[];
  totalCount: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export type GetSetCardsParams = {
  setCode: string;
  offset?: number;
  limit?: number;
  searchTerm?: string;
  sortOption?: SetCardsSortOption;
};

const SET_CARDS_SELECT = 'id, pokemon, number, rarity, image_small, image_large';

function normalizeOffset(offset: number | undefined): number {
  if (!Number.isFinite(offset) || !offset || offset < 0) {
    return 0;
  }

  return Math.floor(offset);
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || !limit || limit < 1) {
    return SET_CARDS_BATCH_SIZE;
  }

  return Math.min(SET_CARDS_BATCH_SIZE, Math.floor(limit));
}

function normalizeSearchTerm(searchTerm: string | undefined): string {
  return searchTerm?.trim().replace(/[,%]/g, ' ') ?? '';
}

export async function getSetCards({
  setCode,
  offset,
  limit,
  searchTerm,
  sortOption = 'name-asc',
}: GetSetCardsParams): Promise<SetCardsResult> {
  const normalizedOffset = normalizeOffset(offset);
  const normalizedLimit = normalizeLimit(limit);
  const from = normalizedOffset;
  const to = normalizedOffset + normalizedLimit - 1;
  const normalizedSearchTerm = normalizeSearchTerm(searchTerm);

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    throw new Error('Setkaarten kunnen niet worden opgehaald omdat de publieke Supabase configuratie ontbreekt.');
  }

  let query = supabase
    .from('cards_catalog')
    .select(SET_CARDS_SELECT, { count: 'exact' })
    .eq('set_code', setCode);

  if (normalizedSearchTerm) {
    const searchPattern = `%${normalizedSearchTerm}%`;
    query = query.or(`pokemon.ilike.${searchPattern},number.ilike.${searchPattern}`);
  }

  switch (sortOption) {
    case 'name-desc':
      query = query.order('pokemon', { ascending: false, nullsFirst: false });
      break;
    case 'name-asc':
    default:
      query = query.order('pokemon', { ascending: true, nullsFirst: false });
      break;
  }

  const { data, error, count } = await query.order('id', { ascending: true }).range(from, to).returns<SetCatalogCard[]>();

  if (error) {
    throw new Error(`Cataloguskaarten ophalen uit cards_catalog is mislukt: ${error.message}`);
  }

  const totalCount = count ?? 0;
  const loadedUntil = normalizedOffset + (data?.length ?? 0);

  return {
    cards: data ?? [],
    totalCount,
    offset: normalizedOffset,
    limit: normalizedLimit,
    hasMore: loadedUntil < totalCount,
  };
}
