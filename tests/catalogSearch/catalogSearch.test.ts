import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CATALOG_SEARCH_PAGE_SIZE } from '../../src/features/catalogSearch/catalogSearchTypes.ts';
import { getCatalogSearchRange, isCatalogSearchTermValid, normalizeCatalogSearchTerm } from '../../src/features/catalogSearch/catalogSearchHelpers.ts';
import { createCatalogSearchCardDetailCapabilities, getCatalogSearchMutationRetryHandler, toCatalogSearchCardDetailCard } from '../../src/features/catalogSearch/catalogSearchCardDetailAdapter.ts';
import { getSafeCatalogSearchErrorMessage, shouldApplyCatalogSearchContext, shouldApplyCatalogSearchDetailContext, toCatalogSearchDetailOwnershipState } from '../../src/features/catalogSearch/catalogSearchStateHelpers.ts';
import type { ConfirmedOwnership } from '../../src/features/collectionCards/index.ts';

test('normalizes search input and strips PostgREST filter controls', () => {
  assert.equal(normalizeCatalogSearchTerm('  Pikachu, set.name % _ (x)  '), 'Pikachu set name x');
  assert.equal(normalizeCatalogSearchTerm('a'.repeat(100)).length, 80);
});

test('validates the three-to-eighty character search contract', () => {
  assert.equal(isCatalogSearchTermValid('a'), false);
  assert.equal(isCatalogSearchTermValid('ab'), false);
  assert.equal(isCatalogSearchTermValid('abc'), true);
  assert.equal(isCatalogSearchTermValid('a'.repeat(80)), true);
  assert.equal(isCatalogSearchTermValid('a'.repeat(81)), true);
});

test('calculates bounded 24-card ranges', () => {
  assert.deepEqual(getCatalogSearchRange(1), { page: 1, from: 0, to: 23 });
  assert.deepEqual(getCatalogSearchRange(3), { page: 3, from: 48, to: 71 });
  assert.equal(CATALOG_SEARCH_PAGE_SIZE, 24);
});

test('ignores stale search responses', () => {
  assert.equal(shouldApplyCatalogSearchContext({ requestId: 2, term: 'pik', page: 1 }, { requestId: 1, term: 'pik', page: 1 }), false);
  assert.equal(shouldApplyCatalogSearchContext({ requestId: 2, term: 'pik', page: 1 }, { requestId: 2, term: 'pik', page: 1 }), true);
});

test('invalidating or clearing a request prevents old search and ownership responses', () => {
  const oldSearch = { requestId: 1, term: 'pik', page: 1 };
  const newSearch = { requestId: 2, term: '', page: 1 };
  assert.equal(shouldApplyCatalogSearchContext(newSearch, oldSearch), false);
  assert.equal(shouldApplyCatalogSearchContext(newSearch, newSearch), true);
  assert.equal(shouldApplyCatalogSearchDetailContext(null, { requestId: 1, searchRequestId: 1, cardCatalogId: 'card-1' }), false);
});

test('detail ownership context accepts only the still-selected card and request', () => {
  const context = { requestId: 4, searchRequestId: 2, cardCatalogId: 'card-1' };
  assert.equal(shouldApplyCatalogSearchDetailContext(context, context), true);
  assert.equal(shouldApplyCatalogSearchDetailContext(context, { ...context, cardCatalogId: 'card-2' }), false);
  assert.deepEqual(toCatalogSearchDetailOwnershipState(undefined, 'error'), { status: 'error', retryable: true });
  assert.equal(getSafeCatalogSearchErrorMessage().includes('Supabase'), false);
});

test('direct ILIKE trigram migration contains only the requested index additions', () => {
  const migrationPath = 'supabase/migrations/20260715214824_phase_7d_1a_catalog_search_ilike_indexes.sql';
  const migration = readFileSync(migrationPath, 'utf8');
  for (const column of ['pokemon', 'set_name', 'number']) {
    assert.match(migration, new RegExp(`using gin \\(${column} extensions\\.gin_trgm_ops\\)`));
  }
  assert.match(migration, /create index if not exists cards_catalog_pokemon_ilike_trgm_idx/);
  assert.doesNotMatch(migration, /create table|create function|create policy|grant |rpc|enable row level security/i);
});

test('maps catalog metadata to the shared Card Detail contract', () => {
  assert.deepEqual(toCatalogSearchCardDetailCard({ id: '1', pokemon: 'Pikachu', setName: 'Base Set', setCode: 'base1', number: '25', rarity: 'Rare', imageSmall: 's', imageLarge: 'l' }), {
    cardCatalogId: '1', name: 'Pikachu', number: '25', set: { setCode: 'base1', name: 'Base Set' }, rarity: 'Rare', images: { small: 's', large: 'l' },
  });
});


const absentOwnership: ConfirmedOwnership = { kind: 'absent' };
const ownedOwnership: ConfirmedOwnership = {
  kind: 'snapshot',
  value: {
    physicalPresence: 'present',
    manageableOwnedNearMintRecord: { collectionCardId: 'owned-1', collectionId: 'collection-1', cardCatalogId: 'card-1', quantity: 2, condition: 'Near Mint', status: 'owned' },
    byStatus: { owned: [{ collectionCardId: 'owned-1', collectionId: 'collection-1', cardCatalogId: 'card-1', quantity: 2, condition: 'Near Mint', status: 'owned' }], wishlist: [], trade: [], missing: [] },
  },
};
const wishlistOwnership: ConfirmedOwnership = {
  kind: 'snapshot',
  value: {
    physicalPresence: 'absent',
    manageableOwnedNearMintRecord: null,
    byStatus: { owned: [], wishlist: [{ collectionCardId: 'wish-1', collectionId: 'collection-1', cardCatalogId: 'card-1', quantity: 1, condition: null, status: 'wishlist' }], trade: [], missing: [] },
  },
};
const conflictingSnapshot: ConfirmedOwnership = {
  kind: 'snapshot',
  value: {
    physicalPresence: 'present',
    manageableOwnedNearMintRecord: null,
    byStatus: { owned: [{ collectionCardId: 'owned-2', collectionId: 'collection-1', cardCatalogId: 'card-1', quantity: 1, condition: 'Played', status: 'owned' }], wishlist: [], trade: [], missing: [] },
  },
};

test('catalog search detail capabilities allow add actions for absent cards', () => {
  assert.deepEqual(createCatalogSearchCardDetailCapabilities({ ownership: absentOwnership }), {
    canAdd: true,
    canAddWishlist: true,
    canRemoveWishlist: false,
    canPromoteWishlist: false,
    canIncrease: false,
    canDecrease: false,
  });
});

test('catalog search detail capabilities allow quantity actions for manageable owned cards', () => {
  const capabilities = createCatalogSearchCardDetailCapabilities({ ownership: ownedOwnership });
  assert.equal(capabilities.canIncrease, true);
  assert.equal(capabilities.canDecrease, true);
  assert.equal(capabilities.canAdd, false);
  assert.equal(capabilities.canAddWishlist, false);
});

test('catalog search detail capabilities allow wishlist promotion and removal without quantity actions', () => {
  const capabilities = createCatalogSearchCardDetailCapabilities({ ownership: wishlistOwnership });
  assert.equal(capabilities.canPromoteWishlist, true);
  assert.equal(capabilities.canRemoveWishlist, true);
  assert.equal(capabilities.canIncrease, false);
  assert.equal(capabilities.canDecrease, false);
});

test('catalog search detail capabilities fail closed for conflicting or unmanageable state', () => {
  const unmanageable = createCatalogSearchCardDetailCapabilities({ ownership: conflictingSnapshot });
  assert.equal(unmanageable.canAdd, false);
  assert.equal(unmanageable.canIncrease, false);
  assert.equal(unmanageable.unavailableReason, 'Beheer via collectie');
  const unknown = createCatalogSearchCardDetailCapabilities({ ownership: { kind: 'conflict', reason: 'duplicate rows' } });
  assert.equal(unknown.canAddWishlist, false);
  assert.match(unknown.unavailableReason ?? '', /Status onbekend/);
});

test('catalog search detail capabilities block duplicate taps while pending', () => {
  const capabilities = createCatalogSearchCardDetailCapabilities({ ownership: absentOwnership, isPending: true });
  assert.equal(capabilities.canAdd, false);
  assert.equal(capabilities.canAddWishlist, false);
});

test('catalog search mutation retry resolves only the failed operation handler', () => {
  let retried = '';
  const retry = getCatalogSearchMutationRetryHandler('remove-wishlist', {
    add: () => { retried = 'add'; },
    'remove-wishlist': () => { retried = 'remove-wishlist'; },
  });
  retry?.();
  assert.equal(retried, 'remove-wishlist');
  assert.equal(getCatalogSearchMutationRetryHandler(undefined, {}), undefined);
});
