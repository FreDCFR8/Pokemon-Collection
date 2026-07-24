import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { isCollectedSetProgressRow } from '../src/features/setsPage/services/setsProgressService.ts';

test('set progress counts only owned rows with positive quantity', () => {
  assert.equal(isCollectedSetProgressRow({ status: 'owned', quantity: 1 }), true);
  assert.equal(isCollectedSetProgressRow({ status: 'owned', quantity: 3 }), true);
  assert.equal(isCollectedSetProgressRow({ status: 'owned', quantity: 0 }), false);
  assert.equal(isCollectedSetProgressRow({ status: 'owned', quantity: -1 }), false);
  assert.equal(isCollectedSetProgressRow({ status: 'owned', quantity: null }), false);
});

test('set progress excludes wishlist, trade and missing rows', () => {
  assert.equal(isCollectedSetProgressRow({ status: 'wishlist', quantity: 1 }), false);
  assert.equal(isCollectedSetProgressRow({ status: 'trade', quantity: 1 }), false);
  assert.equal(isCollectedSetProgressRow({ status: 'missing', quantity: 1 }), false);
  assert.equal(isCollectedSetProgressRow({ status: null, quantity: 1 }), false);
});

test('set progress query includes quantity so the ownership rule can be enforced', async () => {
  const source = await readFile('src/features/setsPage/services/setsProgressService.ts', 'utf8');
  assert.match(source, /card_catalog_id,\s*quantity,\s*status,/);
  assert.match(source, /row\.status === 'owned'/);
  assert.match(source, /row\.quantity > 0/);
});

test('Sets overlay uses the iOS-safe fixed-body scroll lock and restores position', async () => {
  const source = await readFile('src/features/setsPage/setsOverlayScrollLock.ts', 'utf8');
  const entry = await readFile('src/main.tsx', 'utf8');

  assert.match(source, /bodyStyle\.position = 'fixed'/);
  assert.match(source, /bodyStyle\.top = `-\$\{storedStyles\.scrollY\}px`/);
  assert.match(source, /document\.documentElement\.style\.overflow = 'hidden'/);
  assert.match(source, /window\.scrollTo\(0, previous\.scrollY\)/);
  assert.match(source, /\.sets-page-set-overlay/);
  assert.match(entry, /features\/setsPage\/setsOverlayScrollLock/);
});
