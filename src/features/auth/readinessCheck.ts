import { createBrowserSupabaseClient } from '../../lib/supabase';
import {
  configMissingAuthReadinessState,
  failedAuthReadinessState,
  sessionPresentProfilePendingAuthReadinessState,
  signedOutAuthReadinessState,
  type AuthReadinessState,
} from './authStateTypes';

export async function checkReadiness(): Promise<AuthReadinessState> {
  const client = createBrowserSupabaseClient();

  if (!client) {
    return configMissingAuthReadinessState;
  }

  const result = await client.auth.getSession();

  if (result.error) {
    return failedAuthReadinessState();
  }

  if (!result.data.session) {
    return signedOutAuthReadinessState;
  }

  return sessionPresentProfilePendingAuthReadinessState;
}
