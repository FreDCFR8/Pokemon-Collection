import { getIdentitySnapshot } from '../auth/identityRuntimeTypes';
import type { CollectionReadinessState } from './collectionReadinessTypes';

export async function checkCollectionReadiness(): Promise<CollectionReadinessState> {
  const identity = getIdentitySnapshot();
  switch (identity.status) {
    case 'authenticated_ready':
      return identity.mainCollection
        ? { status: 'collection-ready', message: 'Hoofdcollectie gevonden.', collections: [identity.mainCollection], mainCollection: identity.mainCollection }
        : { status: 'collection-missing', message: 'Er is geen hoofdcollectie beschikbaar.', collections: [], mainCollection: null };
    case 'authenticated_profile_missing':
      return { status: 'profile-missing', message: identity.message, collections: [], mainCollection: null };
    case 'signed_out':
      return { status: 'signed-out', message: 'Log eerst in om je collectie te openen.', collections: [], mainCollection: null };
    case 'initializing':
    case 'authenticated_profile_loading':
      return { status: 'loading', message: identity.message, collections: [], mainCollection: null };
    case 'error':
      return { status: 'error', message: identity.message, collections: [], mainCollection: null };
  }
}
