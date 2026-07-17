import type { CardDetailDetails } from './cardDetails';

export type CardDetailMetadataSource = {
  number: string | null;
  rarity: string | null;
  energyType?: string | null;
  set: { releaseDate?: string | null };
  details?: CardDetailDetails | null;
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
  const nationalNumber = card.details?.nationalPokedexNumbers?.filter((number) => Number.isFinite(number)).join(', ');
  const energyType = card.energyType ?? card.details?.types?.filter(Boolean).join(', ');

  return [
    card.details?.artist ? { label: 'Illustrator', value: card.details.artist } : null,
    card.set.releaseDate ? { label: 'Release Date', value: card.set.releaseDate } : null,
    card.rarity ? { label: 'Rarity', value: card.rarity } : null,
    nationalNumber ? { label: 'National Number', value: nationalNumber } : null,
    energyType ? { label: 'Energy Type', value: energyType } : null,
  ].filter((item): item is CardDetailMetadataItem => item !== null);
}
