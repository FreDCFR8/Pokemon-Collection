import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  SET_CATALOG_RECOVERY_EXPECTED_SETS,
  SET_CATALOG_RECOVERY_EXPECTED_DATASET_VERSION,
  classifyRecoveryPreflight,
  parseRecoveryReview,
} from '../../scripts/catalog/set-catalog-recovery.ts';

const reviewPath = new URL('../../config/catalog/remaining-set-catalog-mapping-review.json', import.meta.url);
const currentReviewText = readFileSync(reviewPath, 'utf8');

test('remaining recovery review has exactly the approved 117-entry scope', () => {
  const entries = parseRecoveryReview(currentReviewText);

  assert.equal(entries.length, SET_CATALOG_RECOVERY_EXPECTED_SETS);
  assert.equal(new Set(entries.map((entry) => entry.setId)).size, SET_CATALOG_RECOVERY_EXPECTED_SETS);
  assert.equal(entries.some((entry) => ['cel25c', 'zsv10pt5', 'sv9', 'swsh9'].includes(entry.setId)), false);
  assert.equal(entries.every((entry) => entry.proposedSetCode === entry.setId), true);
  assert.equal(entries.every((entry) => entry.externalReference.externalId === entry.setId), true);
  assert.equal(entries.every((entry) => entry.externalReference.source === 'pokemon_tcg_api'), true);
});

test('remaining recovery review rejects a changed dataset identity', () => {
  const changed = JSON.parse(currentReviewText) as Record<string, unknown>;
  changed.createdFrom = { ...(changed.createdFrom as Record<string, unknown>), datasetVersion: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };

  assert.throws(() => parseRecoveryReview(JSON.stringify(changed)), /gepinde datasetidentiteit/);
});

test('remaining recovery review rejects a manual-review set in write scope', () => {
  const changed = JSON.parse(currentReviewText) as { proposedMappings: Array<Record<string, unknown>> };
  changed.proposedMappings[0] = {
    ...changed.proposedMappings[0],
    setId: 'sv9',
    proposedSetCode: 'sv9',
    externalReference: { source: 'pokemon_tcg_api', externalId: 'sv9' },
  };

  assert.throws(() => parseRecoveryReview(JSON.stringify(changed)), /uitgesloten set/);
});

test('remaining recovery review rejects a metadata or external-identity mismatch', () => {
  const changed = JSON.parse(currentReviewText) as { proposedMappings: Array<Record<string, unknown>>; createdFrom: { datasetVersion: string } };
  assert.equal(changed.createdFrom.datasetVersion, SET_CATALOG_RECOVERY_EXPECTED_DATASET_VERSION);
  changed.proposedMappings[0] = {
    ...changed.proposedMappings[0],
    externalReference: { source: 'pokemon_tcg_api', externalId: 'different' },
  };

  assert.throws(() => parseRecoveryReview(JSON.stringify(changed)), /exacte herstelidentiteit/);
});


function entry(index: number) {
  const code = `test${String(index).padStart(3, '0')}`;
  return {
    set_code: code, name: `Set ${index}`, series: 'Test', generation: null,
    release_date: '2020-01-01', printed_total: index, total: index,
    symbol_url: null, logo_url: null, source: 'pokemon_tcg_api' as const,
    source_id: code, external_id: code,
  };
}

test('preflight classifies an all-absent scope without treating it as PASS writes', () => {
  const entries = Array.from({ length: SET_CATALOG_RECOVERY_EXPECTED_SETS }, (_, index) => entry(index));
  const result = classifyRecoveryPreflight(entries, [], []);

  assert.equal(result.absent.length, SET_CATALOG_RECOVERY_EXPECTED_SETS);
  assert.deepEqual(result.exactExisting, []);
  assert.deepEqual(result.conflicts, []);
});

test('preflight accepts only exact existing catalog and reference identities', () => {
  const entries = Array.from({ length: SET_CATALOG_RECOVERY_EXPECTED_SETS }, (_, index) => entry(index));
  const sets = entries.map((item, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    set_code: item.set_code, name: item.name, series: item.series, generation: item.generation,
    release_date: item.release_date, printed_total: item.printed_total, total: item.total,
    symbol_url: item.symbol_url, logo_url: item.logo_url, source: item.source, source_id: item.source_id,
  }));
  const references = sets.map((set, index) => ({ set_catalog_id: set.id, source: 'pokemon_tcg_api', external_id: entries[index].external_id }));
  const result = classifyRecoveryPreflight(entries, sets, references);

  assert.equal(result.exactExisting.length, SET_CATALOG_RECOVERY_EXPECTED_SETS);
  assert.deepEqual(result.absent, []);
  assert.deepEqual(result.conflicts, []);
});

test('preflight blocks a metadata or reference conflict', () => {
  const item = entry(1);
  const result = classifyRecoveryPreflight(
    [item],
    [{ id: '00000000-0000-4000-8000-000000000001', ...item, name: 'Wrong name' }],
    [{ set_catalog_id: '00000000-0000-4000-8000-000000000001', source: 'pokemon_tcg_api', external_id: item.external_id }],
  );

  assert.deepEqual(result.conflicts, [item.set_code]);
});
