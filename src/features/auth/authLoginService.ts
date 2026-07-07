import { createBrowserSupabaseClient } from '../../lib/supabase';
import { prepareLoginAction } from './loginActionBoundary';
import type { AuthLoginServiceInput, AuthLoginServiceResult } from './authLoginServiceTypes';
import { resolveUsernameAuthTarget } from './usernameAuthMapping';

export async function prepareAuthLogin(input: AuthLoginServiceInput): Promise<AuthLoginServiceResult> {
  const preparedLoginAction = prepareLoginAction(input);

  if (preparedLoginAction.status === 'failed') {
    return {
      status: 'failed',
      message: preparedLoginAction.message,
      errorMessage: preparedLoginAction.errorMessage,
      resolvedUsername: preparedLoginAction.resolvedUsername,
      authTargetPrepared: preparedLoginAction.authTargetPrepared ?? false,
      loginExecuted: false,
      sessionPresent: false,
    };
  }

  const authTarget = resolveUsernameAuthTarget(input.username);

  if (!authTarget) {
    return {
      status: 'failed',
      message: 'Deze gebruikersnaam is nog niet voorbereid voor login.',
      errorMessage: 'Onbekende gebruikersnaam.',
      resolvedUsername: preparedLoginAction.resolvedUsername,
      authTargetPrepared: false,
      loginExecuted: false,
      sessionPresent: false,
    };
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return {
      status: 'failed',
      message: 'Supabase login kan niet starten omdat de publieke configuratie ontbreekt.',
      errorMessage: 'Supabase configuratie ontbreekt.',
      resolvedUsername: authTarget.username,
      authTargetPrepared: true,
      loginExecuted: false,
      sessionPresent: false,
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: authTarget.hiddenAuthEmail,
    password: input.password,
  });

  if (error) {
    const safeErrorMessage = error.message.split(authTarget.hiddenAuthEmail).join('[hidden-auth-email]');

    return {
      status: 'failed',
      message: 'Login mislukt. Controleer gebruikersnaam en wachtwoord.',
      errorMessage: safeErrorMessage,
      resolvedUsername: authTarget.username,
      authTargetPrepared: true,
      loginExecuted: true,
      sessionPresent: false,
    };
  }

  if (data.session) {
    return {
      status: 'authenticated',
      message: 'Login gelukt. Supabase sessie is actief.',
      resolvedUsername: authTarget.username,
      authTargetPrepared: true,
      loginExecuted: true,
      sessionPresent: true,
    };
  }

  return {
    status: 'ready_for_later',
    message: 'Login-call uitgevoerd, maar er is nog geen actieve sessie bevestigd.',
    resolvedUsername: authTarget.username,
    authTargetPrepared: true,
    loginExecuted: true,
    sessionPresent: false,
  };
}
