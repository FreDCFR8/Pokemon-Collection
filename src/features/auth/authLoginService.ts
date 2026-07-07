import { prepareLoginAction } from './loginActionBoundary';
import type { AuthLoginServiceInput, AuthLoginServiceResult } from './authLoginServiceTypes';

export function prepareAuthLogin(input: AuthLoginServiceInput): AuthLoginServiceResult {
  const preparedLoginAction = prepareLoginAction(input);

  if (preparedLoginAction.status === 'failed') {
    return {
      status: 'failed',
      message: preparedLoginAction.message,
      errorMessage: preparedLoginAction.errorMessage,
      resolvedUsername: preparedLoginAction.resolvedUsername,
      authTargetPrepared: preparedLoginAction.authTargetPrepared ?? false,
      loginExecuted: false,
    };
  }

  return {
    status: 'disabled',
    message: 'Auth login service is voorbereid, maar echte Supabase login blijft uitgeschakeld in deze fase.',
    resolvedUsername: preparedLoginAction.resolvedUsername,
    authTargetPrepared: true,
    loginExecuted: false,
  };
}
