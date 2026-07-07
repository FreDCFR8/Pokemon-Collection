import { createBrowserSupabaseClient } from '../../lib/supabase';
import { createAuthReadinessState, type AuthReadinessState } from './authReadinessTypes';

export async function checkAuthReadinessSessionStatus(): Promise<AuthReadinessState> {
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return createAuthReadinessState('config-missing', { sessionPresent: false });
  }

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return createAuthReadinessState('error', {
        sessionPresent: false,
        errorMessage: error.message,
      });
    }

    return createAuthReadinessState(data.session ? 'session-present' : 'signed-out', {
      sessionPresent: Boolean(data.session),
    });
  } catch (error) {
    return createAuthReadinessState('error', {
      sessionPresent: false,
      errorMessage: error instanceof Error ? error.message : 'Onbekende auth-readiness fout.',
    });
  }
}
