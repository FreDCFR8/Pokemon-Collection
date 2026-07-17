import type { CardDetailDetails } from './cardDetails';

export type CardDetailMetadataSource = {
  number: string | null;
  rarity: string | null;
  energyType?: string | null;
  set: { setCode?: string | null; name?: string | null; series?: string | null; releaseDate?: string | null };
  details?: CardDetailDetails | null;
};

export type CardDetailMetadataItem = {
  label: string;
  value: string;
  icons: CardDetailMetadataIcon[];
};

export type CardDetailMetadataIcon =
  | 'energy-colorless'
  | 'energy-darkness'
  | 'energy-fire'
  | 'energy-grass'
  | 'energy-lightning'
  | 'energy-fighting'
  | 'energy-metal'
  | 'energy-fairy'
  | 'energy-dragon'
  | 'energy-unknown'
  | 'energy-psychic'
  | 'energy-water'
  | 'rarity-common'
  | 'rarity-uncommon'
  | 'rarity-rare'
  | 'rarity-rare-holo'
  | 'rarity-double'
  | 'rarity-ultra'
  | 'rarity-illustration'
  | 'rarity-special'
  | 'rarity-secret'
  | 'rarity-hyper'
  | 'rarity-unknown'
  | 'pokedex'
  | 'release-date'
  | 'illustrator';

const DUTCH_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function formatCardDetailReleaseDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return value;
  return `${day} ${DUTCH_MONTHS[month - 1]} ${year}`;
}

function getEnergyIcon(value: string): CardDetailMetadataIcon {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('psychic')) return 'energy-psychic';
  if (normalized.includes('darkness') || normalized.includes('dark')) return 'energy-darkness';
  if (normalized.includes('fire')) return 'energy-fire';
  if (normalized.includes('water')) return 'energy-water';
  if (normalized.includes('grass')) return 'energy-grass';
  if (normalized.includes('lightning') || normalized.includes('electric')) return 'energy-lightning';
  if (normalized.includes('colorless') || normalized.includes('colourless')) return 'energy-colorless';
  if (normalized.includes('fighting')) return 'energy-fighting';
  if (normalized.includes('metal') || normalized.includes('steel')) return 'energy-metal';
  if (normalized.includes('fairy')) return 'energy-fairy';
  if (normalized.includes('dragon')) return 'energy-dragon';
  return 'energy-unknown';
}

function getRarityIcon(value: string): CardDetailMetadataIcon {
  const normalized = value.toLowerCase();
  if (normalized.includes('special illustration')) return 'rarity-special';
  if (normalized.includes('illustration rare')) return 'rarity-illustration';
  if (normalized.includes('hyper')) return 'rarity-hyper';
  if (normalized.includes('secret')) return 'rarity-secret';
  if (normalized.includes('double rare')) return 'rarity-double';
  if (normalized.includes('ultra')) return 'rarity-ultra';
  if (normalized.includes('rare holo') || normalized.includes('holo rare')) return 'rarity-rare-holo';
  if (normalized.includes('uncommon')) return 'rarity-uncommon';
  if (normalized.includes('common')) return 'rarity-common';
  if (normalized === 'rare') return 'rarity-rare';
  return 'rarity-unknown';
}

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
  const detailTypes = card.details?.types?.map((type) => type.trim()).filter(Boolean) ?? [];
  const fallbackTypes = card.energyType?.split(/\s*[,/]\s*/).map((type) => type.trim()).filter(Boolean) ?? [];
  const energyTypes = detailTypes.length > 0 ? detailTypes : fallbackTypes;
  const energyType = energyTypes.join(', ');

  return [
    energyType ? { label: 'Energy Type', value: energyType, icons: energyTypes.map(getEnergyIcon) } : null,
    card.rarity ? { label: 'Rarity', value: card.rarity, icons: [getRarityIcon(card.rarity)] } : null,
    nationalNumber ? { label: 'Pokédex Number', value: nationalNumber, icons: ['pokedex'] } : null,
    card.set.releaseDate ? { label: 'Release Date', value: formatCardDetailReleaseDate(card.set.releaseDate), icons: ['release-date'] } : null,
    card.details?.artist ? { label: 'Illustrator', value: card.details.artist, icons: ['illustrator'] } : null,
  ].filter((item): item is CardDetailMetadataItem => item !== null);
}
