import { createBrowserSupabaseClient } from '../../../lib/supabase';

export const SET_CARDS_PAGE_SIZE = 24;

export type SetCatalogCard = {
  id: string;
  pokemon: string;
  number: string | null;
  rarity: string | null;
  image_small: string | null;
};

export type SetCardsPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type SetCardsResult = SetCardsPagination & {
  cards: SetCatalogCard[];
};

const SET_CARDS_SELECT = 'id, pokemon, number, rarity, image_small';

function normalizePage(page: number): number {
  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

function normalizePageSize(pageSize: number): number {
  if (!Number.isFinite(pageSize) || pageSize < 1) {
    return SET_CARDS_PAGE_SIZE;
  }

  return Math.min(SET_CARDS_PAGE_SIZE, Math.floor(pageSize));
}

export async function getSetCards(setCode: string, page: number, pageSize = SET_CARDS_PAGE_SIZE): Promise<SetCardsResult> {
  const normalizedPage = normalizePage(page);
  const normalizedPageSize = normalizePageSize(pageSize);
  const from = (normalizedPage - 1) * normalizedPageSize;
  const to = from + normalizedPageSize - 1;

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    throw new Error('Setkaarten kunnen niet worden opgehaald omdat de publieke Supabase configuratie ontbreekt.');
  }

  const { data, error, count } = await supabase
    .from('cards_catalog')
    .select(SET_CARDS_SELECT, { count: 'exact' })
    .eq('set_code', setCode)
    .order('number', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .range(from, to)
    .returns<SetCatalogCard[]>();

  if (error) {
    throw new Error(`Cataloguskaarten ophalen uit public.cards_catalog is mislukt: ${error.message}`);
  }

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / normalizedPageSize);

  return {
    cards: data ?? [],
    totalCount,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalPages,
  };
}
