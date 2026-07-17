import { readFileSync } from 'node:fs';

type JsonObject = Record<string, unknown>;

export type LocalPokemonCard = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images?: {
    small?: string;
    large?: string;
  };
};

export type LocalPokemonData = {
  setName: string;
  cards: LocalPokemonCard[];
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null;
}

function readString(value: JsonObject, key: string): string | undefined {
  return typeof value[key] === 'string' ? value[key] : undefined;
}

function parseCard(value: unknown, setId: string): LocalPokemonCard {
  if (!isObject(value)) throw new Error('Lokale JSON-input bevat een ongeldig kaartitem.');

  const cardSet = isObject(value.set) ? value.set : undefined;
  const cardSetId = cardSet ? readString(cardSet, 'id') : undefined;
  if (cardSetId !== undefined && cardSetId !== setId) {
    throw new Error(`Lokale JSON-input bevat kaart ${readString(value, 'id') ?? '[onbekend]'} uit set ${cardSetId} in plaats van ${setId}.`);
  }

  const images = isObject(value.images) ? value.images : undefined;
  return {
    id: readString(value, 'id') ?? '',
    name: readString(value, 'name') ?? '',
    number: readString(value, 'number') ?? '',
    rarity: readString(value, 'rarity'),
    images: images
      ? {
          small: readString(images, 'small'),
          large: readString(images, 'large'),
        }
      : undefined,
  };
}

export function parsePokemonTcgDataJson(text: string, setId: string): LocalPokemonData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Lokale JSON-input is geen geldige JSON.');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Lokale JSON-input moet een niet-lege array met kaarten zijn.');
  }

  const cards = parsed.map((value) => parseCard(value, setId));
  const firstSet = isObject(parsed[0]) && isObject(parsed[0].set) ? parsed[0].set : undefined;
  const setName = firstSet ? readString(firstSet, 'name') : undefined;

  return { setName: setName ?? setId, cards };
}

export function loadPokemonTcgDataJson(path: string, setId: string): LocalPokemonData {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Lokale JSON-input kon niet worden gelezen: ${path}`);
  }
  return parsePokemonTcgDataJson(text, setId);
}
