import { isAbsolute, normalize, sep } from 'node:path';
import { isValidSetId } from './import-args.ts';

export type LocalCatalogManifestSet = {
  setId: string;
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
  if (typeof parsed.datasetRepository !== 'string' || parsed.datasetRepository.trim().length === 0) {
    throw new LocalCatalogManifestError('Lokaal catalogusmanifest mist een geldige datasetRepository.');
  }
  if (typeof parsed.datasetVersion !== 'string' || parsed.datasetVersion.trim().length === 0) {
    throw new LocalCatalogManifestError('Lokaal catalogusmanifest mist een niet-lege datasetVersion of Git-commit.');
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
    if (typeof jsonPath !== 'string') throw new LocalCatalogManifestError(`Manifestset ${setId} mist een geldig JSON-pad.`);
    assertSafeRelativePath(jsonPath, setId);
    const expectedCards = item.expectedCards;
    if (!Number.isInteger(expectedCards) || expectedCards <= 0) {
      throw new LocalCatalogManifestError(`Manifestset ${setId} heeft een ongeldig verwacht kaartenaantal.`);
    }
    const enabled = item.enabled === undefined ? true : item.enabled;
    if (typeof enabled !== 'boolean') throw new LocalCatalogManifestError(`Manifestset ${setId} heeft een ongeldige enabled-waarde.`);
    return { setId, jsonPath, expectedCards, enabled };
  });
  if (!sets.some((set) => set.enabled)) throw new LocalCatalogManifestError('Lokaal catalogusmanifest moet minstens één actieve set bevatten.');
  return {
    source: 'pokemon_tcg_data',
    datasetRepository: parsed.datasetRepository.trim(),
    datasetVersion: parsed.datasetVersion.trim(),
    sets,
  };
}
