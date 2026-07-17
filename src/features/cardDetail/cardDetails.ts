export type CardDetailDetails = {
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  artist?: string;
  regulationMark?: string;
};

export type CardDetailDetailItem = {
  label: string;
  value: string;
};

function join(values: string[] | undefined): string | undefined {
  return values?.length ? values.join(', ') : undefined;
}

export function getCardDetailDetails(details: CardDetailDetails | null | undefined): CardDetailDetailItem[] {
  if (!details) return [];
  return [
    details.supertype ? { label: 'Type kaart', value: details.supertype } : undefined,
    join(details.subtypes) ? { label: 'Subtypes', value: join(details.subtypes)! } : undefined,
    details.hp ? { label: 'HP', value: details.hp } : undefined,
    join(details.types) ? { label: 'Types', value: join(details.types)! } : undefined,
    details.evolvesFrom ? { label: 'Evolves from', value: details.evolvesFrom } : undefined,
    join(details.evolvesTo) ? { label: 'Evolves to', value: join(details.evolvesTo)! } : undefined,
    details.artist ? { label: 'Illustrator', value: details.artist } : undefined,
    details.regulationMark ? { label: 'Regulation mark', value: details.regulationMark } : undefined,
  ].filter((item): item is CardDetailDetailItem => item !== undefined);
}
