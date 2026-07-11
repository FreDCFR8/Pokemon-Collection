export type SetTotalSource = {
  total: number | null;
  printed_total: number | null;
};

export function getEffectiveSetTotal({ total, printed_total }: SetTotalSource): number | null {
  if (typeof total === 'number' && total > 0) {
    return total;
  }

  if (typeof printed_total === 'number' && printed_total > 0) {
    return printed_total;
  }

  return null;
}

export function hasKnownSetTotal(total: number | null): total is number {
  return total !== null && total > 0;
}

export function calculateSetProgressPercent(ownedCount: number, effectiveTotal: number | null): number | null {
  if (!hasKnownSetTotal(effectiveTotal)) {
    return null;
  }

  return Math.min(100, Math.round((ownedCount / effectiveTotal) * 100));
}
