import type { CardDetailCard } from '../cardDetail';
import type { CatalogSearchCard } from './catalogSearchTypes';

export function toCatalogSearchCardDetailCard(card: CatalogSearchCard): CardDetailCard {
  return {
    cardCatalogId: card.id,
    name: card.pokemon?.trim() || 'Onbekende kaart',
    number: card.number,
    set: { setCode: card.setCode, name: card.setName },
    rarity: card.rarity,
    images: { small: card.imageSmall, large: card.imageLarge },
  };
}
