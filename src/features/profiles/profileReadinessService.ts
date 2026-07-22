import { getIdentitySnapshot } from '../auth/identityRuntimeTypes';
import type { ProfileReadinessState } from './profileReadinessTypes';

export async function checkProfileReadiness(): Promise<ProfileReadinessState> {
  const identity = getIdentitySnapshot();
  switch (identity.status) {
    case 'authenticated_ready':
      return identity.profile
        ? { status: 'profile-ready', message: 'App-profiel gevonden.', profile: identity.profile }
        : { status: 'error', message: 'Profielcontext is niet beschikbaar.', profile: null };
    case 'authenticated_profile_missing':
      return { status: 'profile-missing', message: identity.message, profile: null };
    case 'signed_out':
      return { status: 'signed-out', message: 'Log eerst in om je profiel te openen.', profile: null };
    case 'initializing':
    case 'authenticated_profile_loading':
      return { status: 'loading', message: identity.message, profile: null };
    case 'error':
      return { status: 'error', message: identity.message, profile: null };
  }
}
