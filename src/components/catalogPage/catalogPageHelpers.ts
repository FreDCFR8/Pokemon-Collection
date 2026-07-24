export type ExpansionProgressFilter = '' | 'not-started' | 'started' | 'complete';

type ExpansionSet = { name: string; set_code: string; series: string | null; total: number | null; printed_total: number | null };
type ExpansionProgress = { ownedCount: number };

function getEffectiveSetTotal(set: ExpansionSet) {
  return set.total ?? set.printed_total;
}

export function isExpansionComplete(set: ExpansionSet, progress: ExpansionProgress | undefined) {
  const total = getEffectiveSetTotal(set);
  return typeof total === 'number' && total > 0 && (progress?.ownedCount ?? 0) >= total;
}

export function filterExpansions<T extends ExpansionSet>(
  sets: T[],
  progressBySetCode: Map<string, ExpansionProgress>,
  { searchTerm, series, progress }: { searchTerm: string; series: string; progress: ExpansionProgressFilter },
): T[] {
  const term = searchTerm.trim().toLowerCase();

  return sets.filter((set) => {
    const setProgress = progressBySetCode.get(set.set_code);
    const ownedCount = setProgress?.ownedCount ?? 0;
    const matchesSearch = !term || [set.name, set.set_code, set.series ?? ''].some((value) => value.toLowerCase().includes(term));
    const matchesSeries = !series || set.series === series;
    const matchesProgress = progress === ''
      || (progress === 'not-started' && ownedCount === 0)
      || (progress === 'started' && ownedCount > 0 && !isExpansionComplete(set, setProgress))
      || (progress === 'complete' && isExpansionComplete(set, setProgress));

    return matchesSearch && matchesSeries && matchesProgress;
  });
}
