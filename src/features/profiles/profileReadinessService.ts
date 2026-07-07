import { createBrowserSupabaseClient } from '../../lib/supabase';
import type { AppProfile, ProfileReadinessState } from './profileReadinessTypes';

type ProfileReadinessRow = {
  id: string;
  auth_user_id: string;
  username: string;
  display_name: string;
  role: AppProfile['role'];
  child_key: AppProfile['childKey'];
};

export async function checkProfileReadiness(): Promise<ProfileReadinessState> {
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
