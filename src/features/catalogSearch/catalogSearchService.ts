import { createBrowserSupabaseClient } from '../../lib/supabase/index.ts';
import {
  CATALOG_SEARCH_PAGE_SIZE,
  type CatalogSearchCard,
  type CatalogSearchResult,
} from './catalogSearchTypes';
import { getCatalogSearchRange, isCatalogSearchTermValid, normalizeCatalogSearchTerm } from './catalogSearchHelpers';

const CATALOG_SEARCH_SELECT = 'id, pokemon, set_name, set_code, number, rarity, image_small, image_large';

type CatalogSearchDatabaseRow = {
  id: unknown;
  pokemon: unknown;
  set_name: unknown;
  set_code: unknown;
  number: unknown;
  rarity: unknown;
  image_small: unknown;
  image_large: unknown;
};

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mapCatalogSearchCard(row: CatalogSearchDatabaseRow): CatalogSearchCard | null {
  const id = textOrNull(row.id);
  return id ? {
    id,
    pokemon: textOrNull(row.pokemon),
    setName: textOrNull(row.set_name),
    setCode: textOrNull(row.set_code),
    number: textOrNull(row.number),
    rarity: textOrNull(row.rarity),
    imageSmall: textOrNull(row.image_small),
    imageLarge: textOrNull(row.image_large),
  } : null;
}

export async function searchCatalog(searchTerm: string, page: number): Promise<CatalogSearchResult> {
  const normalizedTerm = normalizeCatalogSearchTerm(searchTerm);
  if (!isCatalogSearchTermValid(normalizedTerm)) {
    throw new Error('Gebruik minimaal twee tekens om te zoeken.');
  }

  const supabase = createBrowserSupabaseClient();
  if (!supabase) throw new Error('Zoeken kan niet starten omdat de publieke Supabase-configuratie ontbreekt.');

  const range = getCatalogSearchRange(page);
  const pattern = `%${normalizedTerm}%`;
  const { data, error, count } = await supabase
    .from('cards_catalog')
    .select(CATALOG_SEARCH_SELECT, { count: 'exact' })
    .or(`pokemon.ilike.${pattern},set_name.ilike.${pattern},number.ilike.${pattern}`)
    .order('pokemon', { ascending: true, nullsFirst: false })
    .order('set_name', { ascending: true, nullsFirst: false })
    .order('number', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .range(range.from, range.to)
    .returns<CatalogSearchDatabaseRow[]>();

  if (error) throw new Error(`Catalogus zoeken is mislukt: ${error.message}`);

  return {
    cards: (data ?? []).map(mapCatalogSearchCard).filter((card): card is CatalogSearchCard => card !== null),
    totalCount: count ?? 0,
    page: range.page,
    pageSize: CATALOG_SEARCH_PAGE_SIZE,
  };
}
