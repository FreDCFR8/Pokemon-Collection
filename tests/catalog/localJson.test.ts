import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePokemonTcgDataJson } from '../../scripts/catalog/local-json.ts';

const fixture = JSON.stringify([
  {
    id: 'sv3-1',
    name: 'Oddish',
    number: '1',
    rarity: 'Common',
    set: { id: 'sv3', name: 'Obsidian Flames' },
    images: { small: 'small-url', large: 'large-url' },
  },
]);

test('parses the PokemonTCG local card JSON shape', () => {
  assert.deepEqual(parsePokemonTcgDataJson(fixture, 'sv3'), {
    setName: 'Obsidian Flames',
    cards: [
      {
        id: 'sv3-1',
        name: 'Oddish',
        number: '1',
        rarity: 'Common',
        images: { small: 'small-url', large: 'large-url' },
      },
    ],
  });
});

test('accepts the upstream per-set card file without repeated set metadata', () => {
  assert.deepEqual(parsePokemonTcgDataJson(JSON.stringify([{ id: 'sv3-1', name: 'Oddish', number: '1' }]), 'sv3'), {
    setName: 'sv3',
    cards: [{ id: 'sv3-1', name: 'Oddish', number: '1', rarity: undefined, images: undefined }],
  });
});

test('rejects mixed-set local JSON input when set metadata is present', () => {
  assert.throws(
    () =>
      parsePokemonTcgDataJson(
        JSON.stringify([
          { id: 'sv3-1', name: 'Oddish', number: '1', set: { id: 'sv3', name: 'Obsidian Flames' } },
          { id: 'sv3pt5-1', name: 'Alakazam', number: '1', set: { id: 'sv3pt5', name: '151' } },
        ]),
        'sv3',
      ),
    /uit set sv3pt5/i,
  );
});

test('rejects empty or malformed local JSON input', () => {
  assert.throws(() => parsePokemonTcgDataJson('[]', 'sv3'), /niet-lege array/i);
  assert.throws(() => parsePokemonTcgDataJson('{"cards": []}', 'sv3'), /niet-lege array/i);
  assert.throws(() => parsePokemonTcgDataJson('not-json', 'sv3'), /geldige JSON/i);
});
