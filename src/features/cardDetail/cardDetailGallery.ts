export type CardDetailMetadataSource = {
  number: string | null;
  rarity: string | null;
  energyType?: string | null;
  set: { releaseDate?: string | null };
};

export type CardDetailMetadataItem = {
  label: string;
  value: string;
};

export function getCardDetailNavigationState(currentIndex: number, total: number): { canPrevious: boolean; canNext: boolean } {
  const safeIndex = Number.isFinite(currentIndex) ? Math.floor(currentIndex) : 0;
  const safeTotal = Number.isFinite(total) ? Math.floor(total) : 0;

  return {
    canPrevious: safeTotal > 1 && safeIndex > 0,
    canNext: safeTotal > 1 && safeIndex >= 0 && safeIndex < safeTotal - 1,
  };
}

export function getCardDetailMetadata(card: CardDetailMetadataSource): CardDetailMetadataItem[] {
  return [
    card.rarity ? { label: 'Rarity', value: card.rarity } : null,
    card.number ? { label: 'Pokédexnummer', value: `#${card.number}` } : null,
    card.energyType ? { label: 'Energy type', value: card.energyType } : null,
    card.set.releaseDate ? { label: 'Release datum', value: card.set.releaseDate } : null,
  ].filter((item): item is CardDetailMetadataItem => item !== null);
}
