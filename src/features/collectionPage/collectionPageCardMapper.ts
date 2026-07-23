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

function firstOwnedRow(row: CardsCatalogPageRow['collection_cards']) {
  const rows = Array.isArray(row) ? row : row ? [row] : [];

  return rows.find((ownership) => ownership.status === 'owned' && (ownership.quantity ?? 0) > 0) ?? null;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function toCollectionPageCard(row: CardsCatalogPageRow): CollectionPageCard | null {
  const cardCatalogId = optionalText(row.id);

  if (!cardCatalogId) {
    return null;
  }

  const ownership = firstOwnedRow(row.collection_cards);

  if (!ownership) {
    return null;
  }

  return {
    cardCatalogId,
    pokemon: optionalText(row.pokemon),
    setName: optionalText(row.set_name),
    setCode: optionalText(row.set_code),
    number: optionalText(row.number),
    rarity: optionalText(row.rarity),
    imageSmall: optionalText(row.image_small),
    imageLarge: optionalText(row.image_large),
    quantity: ownership.quantity,
    condition: ownership.condition,
    status: ownership.status,
  };
}
