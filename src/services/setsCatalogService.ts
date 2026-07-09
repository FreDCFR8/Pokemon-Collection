import { createBrowserSupabaseClient } from '../lib/supabase';

export type SetsCatalogRow = {
  id: string;
  set_code: string;
  name: string;
  series: string | null;
  generation: string | null;
  release_date: string | null;
  printed_total: number | null;
  total: number | null;
  symbol_url: string | null;
  logo_url: string | null;
  source: string | null;
  source_id: string | null;
};

const SETS_CATALOG_SELECT = [
  'id',
  'set_code',
  'name',
  'series',
  'generation',
  'release_date',
  'printed_total',
  'total',
  'symbol_url',
  'logo_url',
  'source',
  'source_id',
].join(', ');

export async function getSetsCatalog(): Promise<SetsCatalogRow[]> {
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    throw new Error('Sets catalog kan niet worden opgehaald omdat de publieke Supabase configuratie ontbreekt.');
  }

  const { data, error } = await supabase
    .from('sets_catalog')
    .select(SETS_CATALOG_SELECT)
    .returns<SetsCatalogRow[]>()
    .order('release_date', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Sets catalog ophalen uit public.sets_catalog is mislukt: ${error.message}`);
  }

  return data ?? [];
}
