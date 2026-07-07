import { resolveUsernameAuthTarget } from './usernameAuthMapping';
import type { LoginActionInput, LoginActionResult } from './loginActionTypes';

export function prepareLoginAction(input: LoginActionInput): LoginActionResult {
  const username = input.username.trim();
  const password = input.password.trim();

  if (!username && !password) {
    return {
      status: 'failed',
      message: 'Gebruikersnaam en wachtwoord zijn verplicht om de login action boundary voor te bereiden.',
      errorMessage: 'Gebruikersnaam en wachtwoord ontbreken.',
      authTargetPrepared: false,
    };
  }

  if (!username) {
    return {
      status: 'failed',
      message: 'Gebruikersnaam is verplicht om de login action boundary voor te bereiden.',
      errorMessage: 'Gebruikersnaam ontbreekt.',
      authTargetPrepared: false,
    };
  }

  if (!password) {
    return {
      status: 'failed',
      message: 'Wachtwoord is verplicht om de login action boundary voor te bereiden.',
      errorMessage: 'Wachtwoord ontbreekt.',
      authTargetPrepared: false,
    };
  }

  const authTarget = resolveUsernameAuthTarget(username);

  if (!authTarget) {
    return {
      status: 'failed',
      message: 'Deze gebruikersnaam is nog niet voorbereid voor login.',
      errorMessage: 'Onbekende gebruikersnaam.',
      authTargetPrepared: false,
    };
  }

  return {
    status: 'ready_for_later',
    message:
      'Login action boundary is klaar. Auth-target is voorbereid, maar echte login wordt in een volgende fase geactiveerd.',
    resolvedUsername: authTarget.username,
    authTargetPrepared: true,
  };
}
