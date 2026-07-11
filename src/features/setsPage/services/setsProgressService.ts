import { createBrowserSupabaseClient } from '../../../lib/supabase';

import { calculateSetProgressPercent, getEffectiveSetTotal } from './setTotals';

export type SetProgress = {
  setCode: string;
  ownedCount: number;
  total: number | null;
  printedTotal: number | null;
  progressPercent: number | null;
};

type CollectionCardSetCodeRelation = {
  set_code: string | null;
};

type CollectionCardSetCodeRow = {
  cards_catalog: CollectionCardSetCodeRelation | CollectionCardSetCodeRelation[] | null;
};

type SetsCatalogTotalsRow = {
  set_code: string;
  total: number | null;
  printed_total: number | null;
};

const COLLECTION_CARD_SET_CODE_SELECT = `
  cards_catalog!inner (
    set_code
  )
`;

const SETS_CATALOG_TOTALS_SELECT = 'set_code, total, printed_total';
const COLLECTION_CARD_SET_CODE_BATCH_SIZE = 500;

function getSetCodeFromCollectionCardRow(row: CollectionCardSetCodeRow): string | null {
  const relation = Array.isArray(row.cards_catalog) ? row.cards_catalog[0] : row.cards_catalog;

  return relation?.set_code ?? null;
}

async function fetchAllCollectionCardSetCodeRows(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  collectionId: string,
): Promise<CollectionCardSetCodeRow[]> {
  const allRows: CollectionCardSetCodeRow[] = [];
  let from = 0;

  while (true) {
    const to = from + COLLECTION_CARD_SET_CODE_BATCH_SIZE - 1;
    const { data, error } = await supabase
      .from('collection_cards')
      .select(COLLECTION_CARD_SET_CODE_SELECT)
      .eq('collection_id', collectionId)
      .range(from, to)
      .returns<CollectionCardSetCodeRow[]>();

    if (error) {
      throw new Error(`Setvoortgang ophalen uit public.collection_cards is mislukt: ${error.message}`);
    }

    const batchRows = data ?? [];
    allRows.push(...batchRows);

    if (batchRows.length < COLLECTION_CARD_SET_CODE_BATCH_SIZE) {
      break;
    }

    from += COLLECTION_CARD_SET_CODE_BATCH_SIZE;
  }

  return allRows;
}

export async function getSetProgressForCollection(collectionId: string): Promise<SetProgress[]> {
  if (!collectionId) {
    return [];
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    throw new Error('Setvoortgang kan niet worden opgehaald omdat de publieke Supabase configuratie ontbreekt.');
  }

  const ownershipRows = await fetchAllCollectionCardSetCodeRows(supabase, collectionId);

  const ownedCountsBySetCode = new Map<string, number>();

  for (const row of ownershipRows) {
    const setCode = getSetCodeFromCollectionCardRow(row);

    if (!setCode) {
      continue;
    }

    ownedCountsBySetCode.set(setCode, (ownedCountsBySetCode.get(setCode) ?? 0) + 1);
  }

  const setCodes = [...ownedCountsBySetCode.keys()].sort((a, b) => a.localeCompare(b));

  if (setCodes.length === 0) {
    return [];
  }

  const { data: setTotalsRows, error: setTotalsError } = await supabase
    .from('sets_catalog')
    .select(SETS_CATALOG_TOTALS_SELECT)
    .in('set_code', setCodes)
    .returns<SetsCatalogTotalsRow[]>();

  if (setTotalsError) {
    throw new Error(`Settotalen ophalen uit public.sets_catalog is mislukt: ${setTotalsError.message}`);
  }

  const totalsBySetCode = new Map((setTotalsRows ?? []).map((row) => [row.set_code, row]));

  return setCodes.map((setCode) => {
    const ownedCount = ownedCountsBySetCode.get(setCode) ?? 0;
    const totals = totalsBySetCode.get(setCode);
    const total = totals?.total ?? null;
    const printedTotal = totals?.printed_total ?? null;
    const effectiveTotal = getEffectiveSetTotal({ total, printed_total: printedTotal });

    return {
      setCode,
      ownedCount,
      total,
      printedTotal,
      progressPercent: calculateSetProgressPercent(ownedCount, effectiveTotal),
    };
  });
}
