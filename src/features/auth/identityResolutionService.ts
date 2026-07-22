import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AppCollection, CollectionType } from '../collections';
import type { AppProfile } from '../profiles';
import type { IdentityState } from './identityRuntimeTypes';

type ProfileRow = { id: string; auth_user_id: string; username: string; display_name: string; role: AppProfile['role']; child_key: AppProfile['childKey'] };
type CollectionRow = { id: string; profile_id: string; name: string; type: CollectionType; created_at: string; updated_at: string };
const cleared = (status: IdentityState['status'], message: string): IdentityState => ({ status, message, user: null, profile: null, mainCollection: null });
export const signedOutIdentityState = () => cleared('signed_out', 'Log in om je Pokémonverzameling te openen.');
export const identityErrorState = () => cleared('error', 'Je account kon niet veilig worden geladen. Probeer het opnieuw.');

export async function resolveAuthenticatedIdentity(client: SupabaseClient, user: User): Promise<IdentityState> {
  const profileResult = await client.from('profiles').select('id, auth_user_id, username, display_name, role, child_key').eq('auth_user_id', user.id).maybeSingle<ProfileRow>();
  if (profileResult.error) return identityErrorState();
  if (!profileResult.data) return { status: 'authenticated_profile_missing', user, profile: null, mainCollection: null, message: 'Aan dit account is nog geen profiel gekoppeld.' };
  const row = profileResult.data;
  if (row.auth_user_id !== user.id) return identityErrorState();
  const profile: AppProfile = { id: row.id, authUserId: row.auth_user_id, username: row.username, displayName: row.display_name, role: row.role, childKey: row.child_key };

  if (profile.role === 'admin') {
    return { status: 'authenticated_ready', user, profile, mainCollection: null, message: `Welkom, ${profile.displayName}.` };
  }

  const collectionResult = await client.from('collections').select('id, profile_id, name, type, created_at, updated_at').eq('profile_id', profile.id).eq('type', 'main').maybeSingle<CollectionRow>();
  if (collectionResult.error || !collectionResult.data || collectionResult.data.profile_id !== profile.id) return identityErrorState();
  const collection = collectionResult.data;
  const mainCollection: AppCollection = { id: collection.id, profileId: collection.profile_id, name: collection.name, type: collection.type, createdAt: collection.created_at, updatedAt: collection.updated_at };
  return { status: 'authenticated_ready', user, profile, mainCollection, message: `Welkom, ${profile.displayName}.` };
}
