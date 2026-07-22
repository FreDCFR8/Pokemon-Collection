import type { SetsCatalogRow } from '../../services/setsCatalogService';
import type { DashboardRarityInsight, DashboardRecentSet, DashboardSetInsight } from './dashboardTypes';

export type DashboardCollectionCardRow = {
  collection_id: string;
  quantity: number;
  status: string;
  cards_catalog: {
    id: string;
    set_code: string | null;
    rarity: string | null;
  } | null;
};

export function buildRarityInsights(rows: DashboardCollectionCardRow[]): DashboardRarityInsight[] {
  const idsByRarity = new Map<string, Set<string>>();
  for (const row of rows) {
    const card = row.cards_catalog;
    if (!card) continue;
    const rarity = card.rarity?.trim() || 'Onbekend';
    const ids = idsByRarity.get(rarity) ?? new Set<string>();
    ids.add(card.id);
    idsByRarity.set(rarity, ids);
  }
  const ranked = [...idsByRarity.entries()]
    .map(([rarity, ids]) => ({ rarity, uniqueCards: ids.size }))
    .sort((first, second) => second.uniqueCards - first.uniqueCards || first.rarity.localeCompare(second.rarity, 'nl'));
  const grouped = ranked.length > 4
    ? [...ranked.slice(0, 3), { rarity: 'Overig', uniqueCards: ranked.slice(3).reduce((total, insight) => total + insight.uniqueCards, 0) }]
    : ranked;
  const total = grouped.reduce((sum, insight) => sum + insight.uniqueCards, 0);
  const exact = grouped.map((insight) => ({ ...insight, rawPercent: total ? (insight.uniqueCards / total) * 100 : 0 }));
  const remaining = 100 - exact.reduce((sum, insight) => sum + Math.floor(insight.rawPercent), 0);
  const roundedIndexes = [...exact.keys()]
    .sort((first, second) => (exact[second].rawPercent % 1) - (exact[first].rawPercent % 1) || first - second)
    .slice(0, remaining);
  return exact.map((insight, index) => ({ rarity: insight.rarity, uniqueCards: insight.uniqueCards, percent: Math.floor(insight.rawPercent) + (roundedIndexes.includes(index) ? 1 : 0) }));
}

export function buildSetInsights(ownedRows: DashboardCollectionCardRow[], sets: SetsCatalogRow[]): DashboardSetInsight[] {
  const idsBySetCode = new Map<string, Set<string>>();
  for (const row of ownedRows) {
    const card = row.cards_catalog;
    if (!card?.set_code) continue;
    const ids = idsBySetCode.get(card.set_code) ?? new Set<string>();
    ids.add(card.id);
    idsBySetCode.set(card.set_code, ids);
  }
  return sets.flatMap((set) => {
    const total = set.total ?? set.printed_total;
    const ownedCount = idsBySetCode.get(set.set_code)?.size ?? 0;
    if (ownedCount === 0 || total === null || total <= 0) return [];
    const progressPercent = Math.min(100, Math.round((ownedCount / total) * 100));
    return [{ setCode: set.set_code, setName: set.name, ownedCount, total, missingCount: Math.max(0, total - ownedCount), progressPercent }];
  }).sort((first, second) => second.progressPercent - first.progressPercent || second.ownedCount - first.ownedCount || first.setName.localeCompare(second.setName, 'nl'));
}

export function selectVisibleSetInsights(insights: DashboardSetInsight[]): DashboardSetInsight[] {
  return insights.slice(0, 4);
}

export function buildRecentSets(sets: SetsCatalogRow[], setInsights: DashboardSetInsight[]): DashboardRecentSet[] {
  const insightByCode = new Map(setInsights.map((insight) => [insight.setCode, insight]));
  return sets.map((set) => {
    const insight = insightByCode.get(set.set_code);
    return { setCode: set.set_code, name: set.name, releaseDate: set.release_date, total: set.total ?? set.printed_total, logoUrl: set.logo_url, symbolUrl: set.symbol_url, ownedCount: insight?.ownedCount ?? null, progressPercent: insight?.progressPercent ?? null };
  });
}
