import type { CollectionPageCard } from './collectionPageTypes';

type CollectionPageOwnershipRow = {
  quantity: number | null;
  condition: string | null;
  status: string | null;
};

export type CardsCatalogPageRow = {
  id: unknown;
  pokemon: unknown;
  set_name: unknown;
  set_code: unknown;
  number: unknown;
  rarity: unknown;
  image_small: unknown;
  image_large: unknown;
  collection_cards: CollectionPageOwnershipRow | CollectionPageOwnershipRow[] | null;
};

function firstOwnershipRow(row: CardsCatalogPageRow['collection_cards']) {
  if (Array.isArray(row)) {
    return row[0] ?? null;
  }

  return row;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function toCollectionPageCard(row: CardsCatalogPageRow): CollectionPageCard | null {
  const cardCatalogId = optionalText(row.id);

  if (!cardCatalogId) {
    return null;
  }

  const ownership = firstOwnershipRow(row.collection_cards);

  return {
    cardCatalogId,
    pokemon: optionalText(row.pokemon),
    setName: optionalText(row.set_name),
    setCode: optionalText(row.set_code),
    number: optionalText(row.number),
    rarity: optionalText(row.rarity),
    imageSmall: optionalText(row.image_small),
    imageLarge: optionalText(row.image_large),
    quantity: ownership?.quantity ?? null,
    condition: ownership?.condition ?? null,
    status: ownership?.status ?? null,
  };
}
