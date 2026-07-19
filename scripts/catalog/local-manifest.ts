import { isAbsolute, normalize, sep } from 'node:path';
import { isValidSetId } from './import-args.ts';

export const POKEMON_TCG_DATA_REPOSITORY = 'PokemonTCG/pokemon-tcg-data';

export type LocalCatalogManifestSet = {
  setId: string;
  name: string;
  series: string;
  jsonPath: string;
  expectedCards: number;
  enabled: boolean;
};

export type LocalCatalogManifest = {
  source: 'pokemon_tcg_data';
  datasetRepository: string;
  datasetVersion: string;
  sets: LocalCatalogManifestSet[];
};

export class LocalCatalogManifestError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertSafeRelativePath(path: string, setId: string): void {
  if (path.length === 0) throw new LocalCatalogManifestError(`Manifestset ${setId} heeft een leeg JSON-pad.`);
  if (isAbsolute(path)) throw new LocalCatalogManifestError(`Manifestset ${setId} gebruikt een absoluut pad; alleen relatieve paden zijn toegestaan.`);
  const originalParts = path.split(/[\\/]+/).filter(Boolean);
  if (originalParts.includes('..')) throw new LocalCatalogManifestError(`Manifestset ${setId} ontsnapt met .. buiten de gekozen input-root.`);
  const normalized = normalize(path);
  const parts = normalized.split(/[\\/]+/).filter(Boolean);
  if (normalized === '..' || normalized.startsWith(`..${sep}`) || parts.includes('..')) {
    throw new LocalCatalogManifestError(`Manifestset ${setId} ontsnapt met .. buiten de gekozen input-root.`);
  }
}

export function parseLocalCatalogManifestFromText(text: string): LocalCatalogManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new LocalCatalogManifestError('Lokaal catalogusmanifest is geen geldige JSON.');
  }
  if (!isRecord(parsed)) throw new LocalCatalogManifestError('Lokaal catalogusmanifest heeft een ongeldig formaat.');
  if (parsed.source !== 'pokemon_tcg_data') throw new LocalCatalogManifestError('Lokaal catalogusmanifest moet source pokemon_tcg_data gebruiken.');
  if (parsed.datasetRepository !== POKEMON_TCG_DATA_REPOSITORY) {
    throw new LocalCatalogManifestError(`Lokaal catalogusmanifest moet datasetRepository ${POKEMON_TCG_DATA_REPOSITORY} gebruiken.`);
  }
  if (typeof parsed.datasetVersion !== 'string' || !/^[0-9a-f]{40}$/.test(parsed.datasetVersion)) {
    throw new LocalCatalogManifestError('Lokaal catalogusmanifest moet datasetVersion als volledige Git-commit SHA van 40 hexadecimale tekens bevatten.');
  }
  if (!Array.isArray(parsed.sets)) throw new LocalCatalogManifestError('Lokaal catalogusmanifest moet een sets-array bevatten.');

  const seen = new Set<string>();
  const sets = parsed.sets.map((item, index) => {
    if (!isRecord(item)) throw new LocalCatalogManifestError(`Manifestset op positie ${index + 1} heeft een ongeldig formaat.`);
    const setId = item.setId;
    if (typeof setId !== 'string' || !isValidSetId(setId)) {
      throw new LocalCatalogManifestError(`Ongeldige set-ID in lokaal manifest: ${String(setId)}. Gebruik alleen lowercase ASCII-letters en cijfers.`);
    }
    if (seen.has(setId)) throw new LocalCatalogManifestError(`Dubbele set-ID in lokaal manifest: ${setId}.`);
    seen.add(setId);
    const jsonPath = item.jsonPath;
    const name = item.name;
    const series = item.series;
    if (typeof name !== 'string' || name.trim().length === 0) throw new LocalCatalogManifestError(`Manifestset ${setId} mist officiële setnaam.`);
    if (typeof series !== 'string' || series.trim().length === 0) throw new LocalCatalogManifestError(`Manifestset ${setId} mist officiële setserie.`);
    if (typeof jsonPath !== 'string') throw new LocalCatalogManifestError(`Manifestset ${setId} mist een geldig JSON-pad.`);
    assertSafeRelativePath(jsonPath, setId);
    const expectedCards = item.expectedCards;
    if (!Number.isInteger(expectedCards) || expectedCards <= 0) {
      throw new LocalCatalogManifestError(`Manifestset ${setId} heeft een ongeldig verwacht kaartenaantal.`);
    }
    const enabled = item.enabled === undefined ? true : item.enabled;
    if (typeof enabled !== 'boolean') throw new LocalCatalogManifestError(`Manifestset ${setId} heeft een ongeldige enabled-waarde.`);
    return { setId, name: name.trim(), series: series.trim(), jsonPath, expectedCards, enabled };
  });
  if (!sets.some((set) => set.enabled)) throw new LocalCatalogManifestError('Lokaal catalogusmanifest moet minstens één actieve set bevatten.');
  return {
    source: 'pokemon_tcg_data',
    datasetRepository: parsed.datasetRepository.trim(),
    datasetVersion: parsed.datasetVersion.trim(),
    sets,
  };
}
