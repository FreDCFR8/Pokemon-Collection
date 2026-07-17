import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCardDetails, parseCardDetails } from '../../scripts/catalog/card-details.ts';

test('normalizes extended API card fields without copying unrelated payload', () => {
  const details = parseCardDetails({
    supertype: 'Pokémon',
    subtypes: ['Basic', 'ex'],
    hp: '220',
    types: ['Fire'],
    rules: ['Pokémon ex rule'],
    attacks: [{ name: 'Flare', cost: ['Fire'], damage: '120', text: 'Burn it.' }],
    artist: 'Artist',
    legalities: { standard: 'Legal' },
    images: { small: 'ignored' },
  });

  assert.deepEqual(details.supertype, 'Pokémon');
  assert.deepEqual(details.subtypes, ['Basic', 'ex']);
  assert.deepEqual(details.attacks, [{ name: 'Flare', cost: ['Fire'], damage: '120', text: 'Burn it.' }]);
  assert.equal('images' in details, false);
  assert.equal(hasCardDetails(details), true);
});

test('returns empty details for incomplete input', () => {
  assert.deepEqual(parseCardDetails(null), {});
  assert.equal(hasCardDetails({}), false);
});
