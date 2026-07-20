import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  SET_CATALOG_RECOVERY_EXPECTED_SETS,
  SET_CATALOG_RECOVERY_EXPECTED_DATASET_VERSION,
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
  changed.datasetVersion = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  assert.throws(() => parseRecoveryReview(JSON.stringify(changed)), /gepinde datasetidentiteit/);
});

test('remaining recovery review rejects a manual-review set in write scope', () => {
  const changed = JSON.parse(currentReviewText) as { entries: Array<Record<string, unknown>> };
  changed.entries[0] = {
    ...changed.entries[0],
    setId: 'sv9',
    proposedSetCode: 'sv9',
    externalReference: { source: 'pokemon_tcg_api', externalId: 'sv9' },
  };

  assert.throws(() => parseRecoveryReview(JSON.stringify(changed)), /uitgesloten set/);
});

test('remaining recovery review rejects a metadata or external-identity mismatch', () => {
  const changed = JSON.parse(currentReviewText) as { entries: Array<Record<string, unknown>>; datasetVersion: string };
  assert.equal(changed.datasetVersion, SET_CATALOG_RECOVERY_EXPECTED_DATASET_VERSION);
  changed.entries[0] = {
    ...changed.entries[0],
    externalReference: { source: 'pokemon_tcg_api', externalId: 'different' },
  };

  assert.throws(() => parseRecoveryReview(JSON.stringify(changed)), /exacte herstelidentiteit/);
});
