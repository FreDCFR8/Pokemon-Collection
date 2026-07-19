import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { canonicalLocalManifestJson, localManifestIdentity, localManifestIdentityFromText } from '../../scripts/catalog/catalog-manifest-identity.ts';
import { reportHash } from '../../scripts/catalog/setmapping-validation.ts';

const base = {
  source: 'pokemon_tcg_data' as const,
  datasetRepository: 'PokemonTCG/pokemon-tcg-data',
  datasetVersion: '0af6250a22495e4a3e9f60ff45fc3fedc2e0563d',
  sets: [
    { setId: 'zsv10pt5', jsonPath: 'cards/en/zsv10pt5.json', expectedCards: 172, enabled: true, name: 'Black Bolt', series: 'Scarlet & Violet' },
    { setId: 'bw9', jsonPath: 'cards/en/bw9.json', expectedCards: 122, enabled: true, name: 'Plasma Freeze', series: 'Black & White' },
  ],
};

test('read-only en write identity gebruiken dezelfde canonieke manifesthash', () => {
  const readOnly = localManifestIdentity(base);
  const writeRunner = localManifestIdentityFromText(JSON.stringify(base, null, 2));
  assert.equal(readOnly.manifestHash, writeRunner.manifestHash);
  assert.equal(readOnly.manifestHash, createHash('sha256').update(canonicalLocalManifestJson(base), 'utf8').digest('hex'));
});

test('JSON-roundtrip en LF/CRLF wijzigen de manifesthash niet', () => {
  const json = JSON.stringify(base, null, 2);
  assert.equal(localManifestIdentityFromText(JSON.stringify(JSON.parse(json))).manifestHash, localManifestIdentityFromText(json.replace(/\n/g, '\r\n')).manifestHash);
});

test('setvolgorde wordt deterministisch genormaliseerd', () => {
  const reordered = { ...base, sets: [...base.sets].reverse() };
  assert.equal(localManifestIdentity(base).manifestHash, localManifestIdentity(reordered).manifestHash);
});

test('dataset-, set- en veldwijzigingen veranderen de manifesthash', () => {
  for (const change of [
    { ...base, datasetVersion: '1'.repeat(40) },
    { ...base, datasetRepository: 'Other/repository' },
    { ...base, sets: [{ ...base.sets[0], expectedCards: 173 }, base.sets[1]] },
    { ...base, sets: [{ ...base.sets[0], jsonPath: 'cards/en/other.json' }, base.sets[1]] },
    { ...base, sets: [base.sets[0]] },
  ]) assert.notEqual(localManifestIdentity(base).manifestHash, localManifestIdentity(change).manifestHash);
});

test('reportHash blijft onafhankelijk van manifestHash', () => {
  const withReportHash = { ...base, reportHash: 'f'.repeat(64) };
  assert.equal(localManifestIdentity(base).manifestHash, localManifestIdentityFromText(JSON.stringify(withReportHash)).manifestHash);
  assert.equal(reportHash({ finalStatus: 'PASS' }), reportHash({ finalStatus: 'PASS' }));
});
