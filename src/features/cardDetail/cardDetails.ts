export type CardDetailAbility = {
  name?: string;
  text?: string;
  type?: string;
};

export type CardDetailAttack = {
  name?: string;
  cost?: string[];
  convertedEnergyCost?: number;
  damage?: string;
  text?: string;
};

export type CardDetailDetails = {
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  artist?: string;
  regulationMark?: string;
  abilities?: CardDetailAbility[];
  attacks?: CardDetailAttack[];
  rules?: string[];
  weaknesses?: Array<{ type?: string; value?: string }>;
  resistances?: Array<{ type?: string; value?: string }>;
  retreatCost?: string[];
  nationalPokedexNumbers?: number[];
  legalities?: Record<string, string>;
};

export type CardDetailDetailItem = {
  label: string;
  value: string;
};

export type CardDetailDetailSection = {
  title: string;
  items: CardDetailDetailItem[];
};

function join(values: string[] | undefined): string | undefined {
  return values?.length ? values.join(', ') : undefined;
}

function formatAttack(attack: CardDetailAttack): string | undefined {
  const parts = [
    join(attack.cost),
    attack.damage ? `Schade: ${attack.damage}` : undefined,
    attack.text,
  ].filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(' · ') : undefined;
}

function formatLegalities(legalities: Record<string, string> | undefined): string | undefined {
  if (!legalities) return undefined;
  const entries = Object.entries(legalities);
  return entries.length ? entries.map(([format, status]) => `${format}: ${status}`).join(', ') : undefined;
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

export function getCardDetailSections(details: CardDetailDetails | null | undefined): CardDetailDetailSection[] {
  if (!details) return [];

  const sections: CardDetailDetailSection[] = [];
  const abilities = details.abilities
    ?.map((ability) => ({
      label: ability.name ?? ability.type ?? 'Ability',
      value: ability.text ?? '',
    }))
    .filter((item) => item.value);
  if (abilities?.length) sections.push({ title: 'Abilities', items: abilities });

  const attacks = details.attacks
    ?.map((attack) => ({ label: attack.name ?? 'Aanval', value: formatAttack(attack) ?? '' }))
    .filter((item) => item.value);
  if (attacks?.length) sections.push({ title: 'Aanvallen', items: attacks });

  const rules = details.rules?.filter(Boolean).map((value, index) => ({ label: `Regel ${index + 1}`, value }));
  if (rules?.length) sections.push({ title: 'Regels', items: rules });

  const weaknesses = details.weaknesses
    ?.map((item) => ({ label: item.type ?? 'Type', value: item.value ? `${item.type ?? 'Onbekend'} ${item.value}` : item.type ?? '' }))
    .filter((item) => item.value);
  if (weaknesses?.length) sections.push({ title: 'Zwaktes', items: weaknesses });

  const resistances = details.resistances
    ?.map((item) => ({ label: item.type ?? 'Type', value: item.value ? `${item.type ?? 'Onbekend'} ${item.value}` : item.type ?? '' }))
    .filter((item) => item.value);
  if (resistances?.length) sections.push({ title: 'Weerstanden', items: resistances });

  const retreatCost = join(details.retreatCost);
  if (retreatCost) sections.push({ title: 'Terugtrekkosten', items: [{ label: 'Energie', value: retreatCost }] });

  if (details.nationalPokedexNumbers?.length) {
    sections.push({
      title: 'Pokédex',
      items: [{ label: 'Nationale nummers', value: details.nationalPokedexNumbers.join(', ') }],
    });
  }

  const legalities = formatLegalities(details.legalities);
  if (legalities) sections.push({ title: 'Legaliteit', items: [{ label: 'Formaten', value: legalities }] });

  return sections;
}
