import { createBrowserSupabaseClient } from '../../lib/supabase';

export {
  CollectionCardMutationError,
  __collectionCardMutationServiceTestUtils,
  classifyDuplicateCollectionCardError,
  isDuplicateCollectionCardMutationError,
  type AddOwnedNearMintCollectionCardParams,
  type CollectionCardMutationErrorReason,
  type CollectionCardMutationRecord,
  type CollectionCardsMutationClientFactory,
  type DecreaseCollectionCardQuantityMutationResult,
  type MutateCollectionCardQuantityParams,
} from './collectionCardMutationCore';

import {
  addOwnedNearMintCollectionCard as addOwnedNearMintCollectionCardCore,
  decreaseCollectionCardQuantity as decreaseCollectionCardQuantityCore,
  increaseCollectionCardQuantity as increaseCollectionCardQuantityCore,
  type AddOwnedNearMintCollectionCardParams,
  type CollectionCardsMutationClientFactory,
  type DecreaseCollectionCardQuantityMutationResult,
  type MutateCollectionCardQuantityParams,
  type CollectionCardMutationRecord,
} from './collectionCardMutationCore';

const createDefaultMutationClient = createBrowserSupabaseClient as CollectionCardsMutationClientFactory;

export function addOwnedNearMintCollectionCard(
  params: AddOwnedNearMintCollectionCardParams,
  createClient: CollectionCardsMutationClientFactory = createDefaultMutationClient,
): Promise<CollectionCardMutationRecord> {
  return addOwnedNearMintCollectionCardCore(params, createClient);
}

export function increaseCollectionCardQuantity(
  params: MutateCollectionCardQuantityParams,
  createClient: CollectionCardsMutationClientFactory = createDefaultMutationClient,
): Promise<CollectionCardMutationRecord> {
  return increaseCollectionCardQuantityCore(params, createClient);
}

export function decreaseCollectionCardQuantity(
  params: MutateCollectionCardQuantityParams,
  createClient: CollectionCardsMutationClientFactory = createDefaultMutationClient,
): Promise<DecreaseCollectionCardQuantityMutationResult> {
  return decreaseCollectionCardQuantityCore(params, createClient);
}
