import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCollectionCardDetailCapabilities,
  CollectionCardDetailInvalidResultError,
  getCollectionCardDetailQuantityFromMutation,
  mapCollectionCardDetailDecreaseResult,
  mapCollectionCardDetailIncreaseResult,
  resolveCollectionCardDetailOwnershipRefresh,
  shouldApplyCollectionCardDetailResponse,
  toCollectionCardDetailCard,
  validateCollectionCardDetailMutationResult,
  type CollectionCardDetailRequest,
} from '../../src/features/collectionPage/collectionCardDetailAdapter.ts';
import { toCollectionPageCard, type CardsCatalogPageRow } from '../../src/features/collectionPage/collectionPageCardMapper.ts';
import type { CollectionOwnershipState, OwnershipRecord } from '../../src/features/collectionCards/index.ts';
import type { CardDetailMutationState } from '../../src/features/cardDetail/index.ts';

const collectionId = 'collection-1';
const cardCatalogId = 'card-1';

function ownershipState(records: Partial<Record<'owned' | 'wishlist' | 'trade' | 'missing', OwnershipRecord[]>>): CollectionOwnershipState {
  const byStatus = {
    owned: records.owned ?? [],
    wishlist: records.wishlist ?? [],
    trade: records.trade ?? [],
    missing: records.missing ?? [],
  };
  const manageableOwnedNearMintRecord = byStatus.owned.length === 1 && byStatus.owned[0]?.condition === 'Near Mint'
    ? byStatus.owned[0]
    : undefined;

  return {
    status: 'ready',
    value: {
      kind: 'snapshot',
      value: {
        byStatus,
        physicalPresence: byStatus.owned.length > 0 || byStatus.trade.length > 0 ? 'present' : 'absent',
        manageableOwnedNearMintRecord,
      },
    },
  };
}

const ownedRecord: OwnershipRecord<'owned'> = {
  collectionCardId: 'collection-card-1',
  collectionId,
  cardCatalogId,
  quantity: 2,
  condition: 'Near Mint',
  status: 'owned',
};

function pageRow(overrides: Partial<CardsCatalogPageRow> = {}): CardsCatalogPageRow {
  return {
    id: cardCatalogId,
    pokemon: 'Pikachu',
    set_name: 'Base Set',
    set_code: 'base1',
    number: '58',
    rarity: 'Common',
    image_small: 'https://images.example/small.png',
    image_large: 'https://images.example/large.png',
    collection_cards: { quantity: 1, condition: 'Near Mint', status: 'owned' },
    ...overrides,
  };
}

test('collection rows safely map stable catalog identity, set code, and both image sizes', () => {
  const card = toCollectionPageCard(pageRow({ id: '  card-1  ', set_code: ' base1 ', image_large: ' large.jpg ' }));

  assert.ok(card);
  assert.equal(card.cardCatalogId, 'card-1');
  assert.equal(card.setCode, 'base1');
  assert.equal(card.imageSmall, 'https://images.example/small.png');
  assert.equal(card.imageLarge, 'large.jpg');
  assert.deepEqual(toCollectionCardDetailCard(card).images, {
    small: 'https://images.example/small.png',
    large: 'large.jpg',
  });

  const cardWithInvalidOptionalValues = toCollectionPageCard(pageRow({
    set_code: { invalid: true },
    image_small: 123,
    image_large: '   ',
  }));
  assert.ok(cardWithInvalidOptionalValues);
  assert.equal(cardWithInvalidOptionalValues.setCode, null);
  assert.equal(cardWithInvalidOptionalValues.imageSmall, null);
  assert.equal(cardWithInvalidOptionalValues.imageLarge, null);
});

test('missing or invalid catalog IDs never produce a valid collection card detail model', () => {
  assert.equal(toCollectionPageCard(pageRow({ id: null })), null);
  assert.equal(toCollectionPageCard(pageRow({ id: '   ' })), null);

  const validCard = toCollectionPageCard(pageRow());
  assert.ok(validCard);
  assert.equal(toCollectionCardDetailCard({ ...validCard, cardCatalogId: '' }), null);
});

test('late ownership responses are ignored after close, card, collection, or page changes', () => {
  const completedRequest: CollectionCardDetailRequest = {
    requestId: 4,
    collectionId,
    cardCatalogId,
    page: 2,
  };

  assert.equal(shouldApplyCollectionCardDetailResponse(completedRequest, completedRequest), true);
  assert.equal(shouldApplyCollectionCardDetailResponse(null, completedRequest), false);
  assert.equal(shouldApplyCollectionCardDetailResponse({ ...completedRequest, requestId: 5 }, completedRequest), false);
  assert.equal(shouldApplyCollectionCardDetailResponse({ ...completedRequest, cardCatalogId: 'card-2' }, completedRequest), false);
  assert.equal(shouldApplyCollectionCardDetailResponse({ ...completedRequest, collectionId: 'collection-2' }, completedRequest), false);
  assert.equal(shouldApplyCollectionCardDetailResponse({ ...completedRequest, page: 3 }, completedRequest), false);
});

test('Collection capabilities allow only one owned Near Mint row and never add', () => {
  assert.deepEqual(createCollectionCardDetailCapabilities(ownershipState({ owned: [ownedRecord] })), {
    canAdd: false,
    canIncrease: true,
    canDecrease: true,
    unavailableReason: undefined,
  });
});

test('Collection capabilities disable wishlist, trade, missing, conflict and unknown states', () => {
  for (const records of [
    { wishlist: [{ ...ownedRecord, status: 'wishlist' as const, condition: null }] },
    { trade: [{ ...ownedRecord, status: 'trade' as const, condition: null }] },
    { missing: [{ ...ownedRecord, status: 'missing' as const, condition: null }] },
  ]) {
    const capabilities = createCollectionCardDetailCapabilities(ownershipState(records));
    assert.equal(capabilities.canAdd, false);
    assert.equal(capabilities.canIncrease, false);
    assert.equal(capabilities.canDecrease, false);
  }

  const conflict = createCollectionCardDetailCapabilities({ status: 'ready', value: { kind: 'conflict', reason: 'conflict' } });
  const unknown = createCollectionCardDetailCapabilities({ status: 'error', retryable: true });
  assert.equal(conflict.canIncrease, false);
  assert.equal(conflict.canDecrease, false);
  assert.equal(unknown.canIncrease, false);
  assert.equal(unknown.canDecrease, false);
});

test('Collection capabilities stay disabled during loading with previous ownership and during mutation conflict', () => {
  const previous = ownershipState({ owned: [ownedRecord] }).value;
  const loading: CollectionOwnershipState = { status: 'loading', previous };

  assert.equal(createCollectionCardDetailCapabilities(loading).canIncrease, false);
  assert.equal(createCollectionCardDetailCapabilities(loading).canDecrease, false);
  assert.equal(createCollectionCardDetailCapabilities(ownershipState({ owned: [ownedRecord] }), 'conflict').canIncrease, false);
  assert.equal(createCollectionCardDetailCapabilities(ownershipState({ owned: [ownedRecord] }), 'conflict').canDecrease, false);
  assert.equal(createCollectionCardDetailCapabilities(ownershipState({ owned: [ownedRecord] }), 'idle').canIncrease, true);
  assert.equal(createCollectionCardDetailCapabilities(ownershipState({ owned: [ownedRecord] }), 'idle').canDecrease, true);
});

test('pending and conflict mutation become idle after a valid ownership refresh and controls reactivate', () => {
  const ownership = ownershipState({ owned: [ownedRecord] }).value;
  const pending: CardDetailMutationState = { status: 'pending', operation: 'increase' };
  const conflict: CardDetailMutationState = {
    status: 'conflict',
    operation: 'increase',
    refreshStatus: 'pending',
    message: 'Conflict',
  };

  assert.deepEqual(resolveCollectionCardDetailOwnershipRefresh(pending, { status: 'ready', ownership }), { status: 'idle' });
  assert.deepEqual(resolveCollectionCardDetailOwnershipRefresh(conflict, { status: 'ready', ownership }), { status: 'idle' });
  assert.equal(createCollectionCardDetailCapabilities({ status: 'ready', value: ownership }, 'idle').canIncrease, true);
  assert.equal(createCollectionCardDetailCapabilities({ status: 'ready', value: ownership }, 'idle').canDecrease, true);
});

test('pending mutation with failed or missing ownership refresh stays conflict and blocked', () => {
  const pending: CardDetailMutationState = { status: 'pending', operation: 'decrease' };
  const failed = resolveCollectionCardDetailOwnershipRefresh(pending, { status: 'error' });
  assert.equal(failed.status, 'conflict');
  assert.equal(createCollectionCardDetailCapabilities({ status: 'error', previous: ownershipState({ owned: [ownedRecord] }).value, retryable: true }, failed.status).canDecrease, false);

  const missing = resolveCollectionCardDetailOwnershipRefresh(pending, { status: 'error' });
  assert.equal(missing.status, 'conflict');
  assert.equal(missing.refreshStatus, 'error');
});

test('retry after a refresh conflict can return to idle after the next valid refresh', () => {
  const ownership = ownershipState({ owned: [ownedRecord] }).value;
  const conflict: CardDetailMutationState = {
    status: 'conflict',
    operation: 'increase',
    refreshStatus: 'error',
    message: 'Refresh mislukt',
  };

  const retried = resolveCollectionCardDetailOwnershipRefresh(conflict, { status: 'ready', ownership });
  assert.deepEqual(retried, { status: 'idle' });
  assert.equal(createCollectionCardDetailCapabilities({ status: 'ready', value: ownership }, retried.status).canIncrease, true);
});

test('Collection mutation result mapping accepts validated increase, decrease and delete responses', () => {
  const increased = mapCollectionCardDetailIncreaseResult({ ...ownedRecord, quantity: 3 });
  assert.equal(getCollectionCardDetailQuantityFromMutation(increased), 3);

  const decreased = mapCollectionCardDetailDecreaseResult({ action: 'updated', card: { ...ownedRecord, quantity: 1 } });
  assert.equal(getCollectionCardDetailQuantityFromMutation(decreased), 1);

  const deleted = mapCollectionCardDetailDecreaseResult({ action: 'deleted', collectionCardId: ownedRecord.collectionCardId });
  assert.deepEqual(deleted, { kind: 'deleted', collectionCardId: ownedRecord.collectionCardId });
  assert.equal(getCollectionCardDetailQuantityFromMutation(deleted), null);
});

test('Collection mutation response validation accepts exact update and delete responses', () => {
  const expected = {
    collectionId,
    collectionCardId: ownedRecord.collectionCardId,
    cardCatalogId,
    expectedQuantity: 3,
  };
  const update = mapCollectionCardDetailIncreaseResult({ ...ownedRecord, quantity: 3 });
  const deleteResult = mapCollectionCardDetailDecreaseResult({ action: 'deleted', collectionCardId: ownedRecord.collectionCardId });

  assert.deepEqual(validateCollectionCardDetailMutationResult(update, expected), update);
  assert.deepEqual(validateCollectionCardDetailMutationResult(deleteResult, { ...expected, expectedQuantity: 1 }), deleteResult);
});

test('Collection mutation response validation rejects collection, row, card and quantity mismatches as invalid-result', () => {
  const expected = {
    collectionId,
    collectionCardId: ownedRecord.collectionCardId,
    cardCatalogId,
    expectedQuantity: 3,
  };
  const update = mapCollectionCardDetailIncreaseResult({ ...ownedRecord, quantity: 3 });

  for (const mismatch of [
    { ...update.card, collectionId: 'other-collection' },
    { ...update.card, collectionCardId: 'other-row' },
    { ...update.card, cardCatalogId: 'other-card' },
    { ...update.card, quantity: 4 },
  ]) {
    assert.throws(
      () => validateCollectionCardDetailMutationResult({ kind: 'updated', card: mismatch }, expected),
      (error: unknown) => error instanceof CollectionCardDetailInvalidResultError && error.reason === 'invalid-result',
    );
  }

  assert.throws(
    () => validateCollectionCardDetailMutationResult({ kind: 'deleted', collectionCardId: 'other-row' }, expected),
    (error: unknown) => error instanceof CollectionCardDetailInvalidResultError && error.reason === 'invalid-result',
  );
});

test('stale/conflict responses do not become a quantity success and active Collection context remains part of the request identity', () => {
  const request: CollectionCardDetailRequest = { requestId: 7, collectionId, cardCatalogId, page: 3 };
  assert.equal(shouldApplyCollectionCardDetailResponse(request, { ...request, requestId: 8 }), false);
  assert.equal(shouldApplyCollectionCardDetailResponse(request, { ...request, page: 4 }), false);
  assert.equal(shouldApplyCollectionCardDetailResponse(request, request), true);
});
