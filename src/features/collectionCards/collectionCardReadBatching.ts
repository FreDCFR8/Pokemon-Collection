export const COLLECTION_CARD_READ_BATCH_SIZE = 100;

export function createCollectionCardReadBatches(cardCatalogIds: readonly string[]): string[][] {
  const uniqueCardCatalogIds = [...new Set(cardCatalogIds.map((cardCatalogId) => cardCatalogId.trim()).filter(Boolean))];
  const batches: string[][] = [];

  for (let startIndex = 0; startIndex < uniqueCardCatalogIds.length; startIndex += COLLECTION_CARD_READ_BATCH_SIZE) {
    batches.push(uniqueCardCatalogIds.slice(startIndex, startIndex + COLLECTION_CARD_READ_BATCH_SIZE));
  }

  return batches;
}
