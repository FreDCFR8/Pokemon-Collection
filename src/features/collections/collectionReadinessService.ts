import { createBrowserSupabaseClient } from '../../lib/supabase';
import { checkProfileReadiness } from '../profiles';
import type { AppCollection, CollectionReadinessState, CollectionType } from './collectionReadinessTypes';

type CollectionReadinessRow = {
  id: string;
  profile_id: string;
  name: string;
  type: CollectionType;
  created_at: string;
  updated_at: string;
};

function toSafeErrorMessage(message: string | undefined): string {
  if (!message) {
    return 'Onbekende collectiecontrolefout.';
  }

  return message.replace(/https?:\/\/\S+/g, '[url verborgen]').slice(0, 240);
}

export async function checkCollectionReadiness(): Promise<CollectionReadinessState> {
  const profileReadiness = await checkProfileReadiness();

  if (profileReadiness.status === 'config-missing') {
    return {
      status: 'config-missing',
      message: profileReadiness.message,
      collections: [],
      mainCollection: null,
    };
  }

  if (profileReadiness.status === 'signed-out') {
    return {
      status: 'signed-out',
      message: profileReadiness.message,
      collections: [],
      mainCollection: null,
    };
  }

  if (profileReadiness.status === 'profile-missing') {
    return {
      status: 'profile-missing',
      message: profileReadiness.message,
      collections: [],
      mainCollection: null,
    };
  }

  if (profileReadiness.status === 'error') {
    return {
      status: 'error',
      message: profileReadiness.message,
      collections: [],
      mainCollection: null,
      errorMessage: toSafeErrorMessage(profileReadiness.errorMessage),
    };
  }

  const profile = profileReadiness.profile;

  if (!profile) {
    return {
      status: 'profile-missing',
      message: 'Er is nog geen app-profiel gekoppeld aan deze Supabase gebruiker.',
      collections: [],
      mainCollection: null,
    };
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return {
      status: 'config-missing',
      message: 'Collectiecontrole kan niet starten omdat de publieke Supabase configuratie ontbreekt.',
      collections: [],
      mainCollection: null,
    };
  }

  const { data, error } = await supabase
    .from('collections')
    .select('id, profile_id, name, type, created_at, updated_at')
    .eq('profile_id', profile.id)
    .order('name', { ascending: true });

  if (error) {
    return {
      status: 'error',
      message: 'Collectiecontrole is mislukt.',
      collections: [],
      mainCollection: null,
      errorMessage: toSafeErrorMessage(error.message),
    };
  }

  const collections: AppCollection[] = ((data ?? []) as CollectionReadinessRow[]).map(
    ({ id, profile_id, name, type, created_at, updated_at }) => ({
      id,
      profileId: profile_id,
      name,
      type,
      createdAt: created_at,
      updatedAt: updated_at,
    }),
  );

  const mainCollection = collections.find((collection) => collection.type === 'main') ?? null;

  if (!mainCollection) {
    return {
      status: 'collection-missing',
      message: 'Er is nog geen hoofdcollectie gekoppeld aan dit profiel.',
      collections,
      mainCollection: null,
    };
  }

  return {
    status: 'collection-ready',
    message: 'Hoofdcollectie gevonden.',
    collections,
    mainCollection,
  };
}
