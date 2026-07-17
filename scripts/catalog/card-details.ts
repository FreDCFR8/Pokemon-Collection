export type CardDetails = {
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  rules?: string[];
  abilities?: Array<{ name: string; text: string; type?: string }>;
  attacks?: Array<{ name: string; cost?: string[]; convertedEnergyCost?: number; damage?: string; text?: string }>;
  weaknesses?: Array<{ type: string; value?: string }>;
  resistances?: Array<{ type: string; value?: string }>;
  retreatCost?: string[];
  artist?: string;
  nationalPokedexNumbers?: number[];
  legalities?: Record<string, string>;
  regulationMark?: string;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null;
}

function readString(value: JsonObject, key: string): string | undefined {
  return typeof value[key] === 'string' ? value[key] : undefined;
}

function readStringArray(value: JsonObject, key: string): string[] | undefined {
  if (!Array.isArray(value[key])) return undefined;
  const items = value[key].filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

function readObjectArray(value: JsonObject, key: string): JsonObject[] | undefined {
  if (!Array.isArray(value[key])) return undefined;
  const items = value[key].filter(isObject);
  return items.length > 0 ? items : undefined;
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

export function parseCardDetails(value: unknown): CardDetails {
  if (!isObject(value)) return {};

  const abilities = readObjectArray(value, 'abilities')?.map((item) => compact({
    name: readString(item, 'name') ?? '',
    text: readString(item, 'text') ?? '',
    type: readString(item, 'type'),
  })).filter((item) => item.name || item.text);

  const attacks = readObjectArray(value, 'attacks')?.map((item) => compact({
    name: readString(item, 'name') ?? '',
    cost: readStringArray(item, 'cost'),
    convertedEnergyCost: typeof item.convertedEnergyCost === 'number' ? item.convertedEnergyCost : undefined,
    damage: readString(item, 'damage'),
    text: readString(item, 'text'),
  })).filter((item) => item.name || item.text);

  const weaknesses = readObjectArray(value, 'weaknesses')?.map((item) => compact({
    type: readString(item, 'type') ?? '',
    value: readString(item, 'value'),
  })).filter((item) => item.type);

  const resistances = readObjectArray(value, 'resistances')?.map((item) => compact({
    type: readString(item, 'type') ?? '',
    value: readString(item, 'value'),
  })).filter((item) => item.type);

  const legalities = isObject(value.legalities)
    ? Object.fromEntries(Object.entries(value.legalities).filter(([, item]) => typeof item === 'string'))
    : undefined;

  return compact({
    supertype: readString(value, 'supertype'),
    subtypes: readStringArray(value, 'subtypes'),
    hp: readString(value, 'hp'),
    types: readStringArray(value, 'types'),
    evolvesFrom: readString(value, 'evolvesFrom'),
    evolvesTo: readStringArray(value, 'evolvesTo'),
    rules: readStringArray(value, 'rules'),
    abilities: abilities?.length ? abilities : undefined,
    attacks: attacks?.length ? attacks : undefined,
    weaknesses: weaknesses?.length ? weaknesses : undefined,
    resistances: resistances?.length ? resistances : undefined,
    retreatCost: readStringArray(value, 'retreatCost'),
    artist: readString(value, 'artist'),
    nationalPokedexNumbers: Array.isArray(value.nationalPokedexNumbers)
      ? value.nationalPokedexNumbers.filter((item): item is number => typeof item === 'number')
      : undefined,
    legalities: legalities && Object.keys(legalities).length ? legalities : undefined,
    regulationMark: readString(value, 'regulationMark'),
  });
}

export function hasCardDetails(details: CardDetails): boolean {
  return Object.keys(details).length > 0;
}
