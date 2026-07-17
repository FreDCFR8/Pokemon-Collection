import type { CardDetailDetails } from './cardDetails';

export type CardDetailMetadataSource = {
  number: string | null;
  rarity: string | null;
  energyType?: string | null;
  set: { setCode?: string | null; releaseDate?: string | null };
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
    energyType ? { label: 'Energy Type', value: energyType } : null,
    card.rarity ? { label: 'Rarity', value: card.rarity } : null,
    nationalNumber ? { label: 'Pokédex Number', value: nationalNumber } : null,
    card.set.setCode ? { label: 'Genset', value: card.set.setCode } : null,
    card.set.releaseDate ? { label: 'Release Date', value: card.set.releaseDate } : null,
    card.details?.artist ? { label: 'Illustrator', value: card.details.artist } : null,
  ].filter((item): item is CardDetailMetadataItem => item !== null);
}
