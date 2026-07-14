import { createBrowserSupabaseClient } from '../../lib/supabase';

export {
  CollectionCardMutationError,
  classifyDuplicateCollectionCardError,
  isDuplicateCollectionCardMutationError,
  type AddOwnedNearMintCollectionCardParams,
  type CollectionCardMutationErrorReason,
  type CollectionCardMutationRecord,
  type DecreaseCollectionCardQuantityMutationResult,
  type MutateCollectionCardQuantityParams,
} from './collectionCardMutationCore';

import {
  addOwnedNearMintCollectionCard as addOwnedNearMintCollectionCardCore,
  decreaseCollectionCardQuantity as decreaseCollectionCardQuantityCore,
  increaseCollectionCardQuantity as increaseCollectionCardQuantityCore,
  type AddOwnedNearMintCollectionCardParams,
  type CollectionCardMutationRecord,
  type DecreaseCollectionCardQuantityMutationResult,
  type MutateCollectionCardQuantityParams,
} from './collectionCardMutationCore';

const createDefaultMutationClient = createBrowserSupabaseClient as unknown as Parameters<typeof addOwnedNearMintCollectionCardCore>[1];

export function addOwnedNearMintCollectionCard(
  params: AddOwnedNearMintCollectionCardParams,
): Promise<CollectionCardMutationRecord> {
  return addOwnedNearMintCollectionCardCore(params, createDefaultMutationClient);
}

export function increaseCollectionCardQuantity(
  params: MutateCollectionCardQuantityParams,
): Promise<CollectionCardMutationRecord> {
  return increaseCollectionCardQuantityCore(params, createDefaultMutationClient);
}

export function decreaseCollectionCardQuantity(
  params: MutateCollectionCardQuantityParams,
): Promise<DecreaseCollectionCardQuantityMutationResult> {
  return decreaseCollectionCardQuantityCore(params, createDefaultMutationClient);
}
