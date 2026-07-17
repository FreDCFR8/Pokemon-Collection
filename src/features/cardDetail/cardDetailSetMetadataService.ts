import { createBrowserSupabaseClient } from '../../lib/supabase';

export type CardDetailSetMetadata = {
  series: string | null;
  releaseDate: string | null;
};

type SetMetadataRow = {
  set_code: unknown;
  series: unknown;
  release_date: unknown;
};

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function getCardDetailSetMetadata(setCodes: readonly (string | null | undefined)[]): Promise<Map<string, CardDetailSetMetadata>> {
  const normalizedCodes = [...new Set(setCodes.map((code) => optionalText(code)).filter((code): code is string => Boolean(code)))];
  if (normalizedCodes.length === 0) return new Map();

  const supabase = createBrowserSupabaseClient();
  if (!supabase) return new Map();

  const { data, error } = await supabase
    .from('sets_catalog')
    .select('set_code, series, release_date')
    .in('set_code', normalizedCodes)
    .returns<SetMetadataRow[]>();

  if (error) return new Map();

  return new Map((data ?? []).flatMap((row) => {
    const setCode = optionalText(row.set_code);
    return setCode ? [[setCode, { series: optionalText(row.series), releaseDate: optionalText(row.release_date) }] as const] : [];
  }));
}
