import { createHash } from 'node:crypto';
import { parseLocalCatalogManifestFromText, type LocalCatalogManifest } from './local-manifest.ts';
import { stableJson } from './setmapping-validation.ts';

export type CanonicalLocalManifest = {
  source: 'pokemon_tcg_data';
  datasetRepository: string;
  datasetVersion: string;
  sets: Array<{
    setId: string;
    jsonPath: string;
    expectedCards: number;
    enabled: boolean;
    name: string;
    series: string;
  }>;
};

function canonicalManifest(manifest: LocalCatalogManifest): CanonicalLocalManifest {
  return {
    source: manifest.source,
    datasetRepository: manifest.datasetRepository,
    datasetVersion: manifest.datasetVersion,
    sets: [...manifest.sets]
      .sort((a, b) => a.setId.localeCompare(b.setId, 'en'))
      .map(({ setId, jsonPath, expectedCards, enabled, name, series }) => ({ setId, jsonPath, expectedCards, enabled, name, series })),
  };
}

export function canonicalLocalManifestJson(manifest: LocalCatalogManifest): string {
  return stableJson(canonicalManifest(manifest));
}

export function localManifestIdentity(manifest: LocalCatalogManifest): { canonical: CanonicalLocalManifest; manifestHash: string } {
  const canonical = canonicalManifest(manifest);
  return { canonical, manifestHash: createHash('sha256').update(stableJson(canonical), 'utf8').digest('hex') };
}

export function localManifestIdentityFromText(text: string): { manifest: LocalCatalogManifest; canonical: CanonicalLocalManifest; manifestHash: string } {
  const manifest = parseLocalCatalogManifestFromText(text);
  const identity = localManifestIdentity(manifest);
  return { manifest, ...identity };
}
