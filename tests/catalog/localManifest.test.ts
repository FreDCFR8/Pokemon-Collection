import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLocalCatalogManifestFromText } from '../../scripts/catalog/local-manifest.ts';

const valid = JSON.stringify({ source: 'pokemon_tcg_data', datasetRepository: 'PokemonTCG/pokemon-tcg-data', datasetVersion: '0af6250a22495e4a3e9f60ff45fc3fedc2e0563d', sets: [{ setId: 'sv3pt5', jsonPath: 'cards/en/sv3pt5.json', expectedCards: 207, enabled: true }, { setId: 'sv3', jsonPath: 'cards/en/sv3.json', expectedCards: 230, enabled: true }] });

test('parses a valid local pokemon_tcg_data manifest', () => {
  assert.deepEqual(parseLocalCatalogManifestFromText(valid).sets.map((set) => set.setId), ['sv3pt5', 'sv3']);
});

test('rejects placeholder, short, missing, and non-hex dataset versions', () => {
  for (const datasetVersion of ['operator-pinned-local-checkout', 'abc123', 'g'.repeat(40), '', undefined]) {
    const manifest = JSON.parse(valid);
    if (datasetVersion === undefined) delete manifest.datasetVersion; else manifest.datasetVersion = datasetVersion;
    assert.throws(() => parseLocalCatalogManifestFromText(JSON.stringify(manifest)), /Git-commit SHA van 40 hexadecimale tekens/i);
  }
});

test('rejects an unexpected dataset repository', () => {
  const manifest = JSON.parse(valid);
  manifest.datasetRepository = 'SomeoneElse/pokemon-tcg-data';
  assert.throws(() => parseLocalCatalogManifestFromText(JSON.stringify(manifest)), /datasetRepository PokemonTCG\/pokemon-tcg-data/i);
});

test('rejects duplicate and invalid set IDs', () => {
  const duplicate = JSON.parse(valid); duplicate.sets[1].setId = 'sv3pt5';
  assert.throws(() => parseLocalCatalogManifestFromText(JSON.stringify(duplicate)), /Dubbele set-ID/i);
  const invalid = JSON.parse(valid); invalid.sets[0].setId = 'SV3';
  assert.throws(() => parseLocalCatalogManifestFromText(JSON.stringify(invalid)), /Ongeldige set-ID/i);
});

test('rejects absolute paths and dot-dot path escapes', () => {
  for (const jsonPath of ['/tmp/sv3.json', '../sv3.json', 'cards/../sv3.json']) {
    const manifest = JSON.parse(valid); manifest.sets[0].jsonPath = jsonPath;
    assert.throws(() => parseLocalCatalogManifestFromText(JSON.stringify(manifest)), /absoluut pad|\.\./i);
  }
});

test('rejects invalid expected card counts and manifests without enabled sets', () => {
  for (const expectedCards of [0, -1, 1.5, '207']) {
    const manifest = JSON.parse(valid); manifest.sets[0].expectedCards = expectedCards;
    assert.throws(() => parseLocalCatalogManifestFromText(JSON.stringify(manifest)), /kaartenaantal/i);
  }
  const disabled = JSON.parse(valid); disabled.sets.forEach((set: { enabled: boolean }) => { set.enabled = false; });
  assert.throws(() => parseLocalCatalogManifestFromText(JSON.stringify(disabled)), /minstens één actieve set/i);
});
