import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCardDetails } from '../../scripts/catalog/card-details.ts';

test('normalized empty details are safe for idempotent backfill decisions', () => {
  assert.deepEqual(parseCardDetails({}), {});
  assert.equal(Object.keys(parseCardDetails({ supertype: 'Pokémon' })).length, 1);
});
