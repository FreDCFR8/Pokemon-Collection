import { createBrowserSupabaseClient } from '../../lib/supabase';
import type { AppProfile, ProfileReadinessState } from './profileReadinessTypes';
import { getIdentitySnapshot } from '../auth/identityRuntimeTypes';

type ProfileReadinessRow = {
  id: string;
  auth_user_id: string;
  username: string;
  display_name: string;
  role: AppProfile['role'];
  child_key: AppProfile['childKey'];
};

export async function checkProfileReadiness(): Promise<ProfileReadinessState> {
  const identity = getIdentitySnapshot();
  if (identity.status === 'authenticated_ready' && identity.profile) return { status: 'profile-ready', message: 'App-profiel gevonden.', profile: identity.profile };
  if (identity.status === 'signed_out') return { status: 'signed-out', message: 'Log eerst in om je profiel te openen.', profile: null };
  if (identity.status === 'authenticated_profile_missing') return { status: 'profile-missing', message: identity.message, profile: null };
  if (identity.status === 'error') return { status: 'error', message: identity.message, profile: null };
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return {
      status: 'config-missing',
      message: 'Profielcontrole kan niet starten omdat de publieke Supabase configuratie ontbreekt.',
      profile: null,
    };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    return {
      status: 'error',
      message: 'Supabase sessiecontrole is mislukt.',
      profile: null,
      errorMessage: sessionError.message,
    };
  }

  const session = sessionData.session;

  if (!session?.user) {
    return {
      status: 'signed-out',
      message: 'Geen actieve Supabase sessie. Log eerst in om het profiel te controleren.',
      profile: null,
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, auth_user_id, username, display_name, role, child_key')
    .eq('auth_user_id', session.user.id)
    .maybeSingle<ProfileReadinessRow>();

  if (error) {
    return {
      status: 'error',
      message: 'Profielcontrole is mislukt.',
      profile: null,
      errorMessage: error.message,
    };
  }

  if (!data) {
    return {
      status: 'profile-missing',
      message: 'Er is nog geen app-profiel gekoppeld aan deze Supabase gebruiker.',
      profile: null,
    };
  }

  const profile: AppProfile = {
    id: data.id,
    authUserId: data.auth_user_id,
    username: data.username,
    displayName: data.display_name,
    role: data.role,
    childKey: data.child_key,
  };

  return {
    status: 'profile-ready',
    message: 'App-profiel gevonden.',
    profile,
  };
}
