import type { CardDetailCard, CardDetailProductCopy } from '../cardDetail';
import { createCardDetailOwnershipPresentation } from '../cardDetail/cardDetailOwnershipPresentation.ts';
import type { ConfirmedOwnership, CollectionOwnershipState } from '../collectionCards';
import type { WishlistPageCard } from './wishlistPageTypes';

export function toWishlistCardDetailCard(card: WishlistPageCard): CardDetailCard | null {
  const cardCatalogId = card.cardCatalogId.trim();
  if (!cardCatalogId) return null;

  return {
    cardCatalogId,
    name: card.pokemon?.trim() || 'Onbekende kaart',
    number: card.number,
    set: { setCode: card.setCode, name: card.setName, ...(card.series ? { series: card.series } : {}), ...(card.releaseDate ? { releaseDate: card.releaseDate } : {}) },
    rarity: card.rarity,
    images: { small: card.imageSmall, large: card.imageLarge },
  };
}

export function createWishlistCardDetailProductCopy(ownership: CollectionOwnershipState): CardDetailProductCopy {
  const confirmedOwnership: ConfirmedOwnership | undefined = ownership.status === 'ready'
    ? ownership.value
    : ownership.status === 'loading' || ownership.status === 'error'
      ? ownership.previous
      : undefined;
  const presentation = createCardDetailOwnershipPresentation({
    ownership: confirmedOwnership,
    includeConflictSnapshotStatusItems: true,
  });

  return {
    statusItems: presentation.statusItems,
    physicalPresenceLabel: presentation.physicalPresenceLabel,
    managementMessage: presentation.conflictMessage,
  };
}
