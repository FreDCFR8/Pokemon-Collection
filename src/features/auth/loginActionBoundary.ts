import type { LoginActionInput, LoginActionResult } from './loginActionTypes';

export function prepareLoginAction(input: LoginActionInput): LoginActionResult {
  const username = input.username.trim();
  const password = input.password.trim();

  if (!username && !password) {
    return {
      status: 'failed',
      message: 'Gebruikersnaam en wachtwoord zijn verplicht om de login action boundary voor te bereiden.',
      errorMessage: 'Gebruikersnaam en wachtwoord ontbreken.',
    };
  }

  if (!username) {
    return {
      status: 'failed',
      message: 'Gebruikersnaam is verplicht om de login action boundary voor te bereiden.',
      errorMessage: 'Gebruikersnaam ontbreekt.',
    };
  }

  if (!password) {
    return {
      status: 'failed',
      message: 'Wachtwoord is verplicht om de login action boundary voor te bereiden.',
      errorMessage: 'Wachtwoord ontbreekt.',
    };
  }

  return {
    status: 'ready_for_later',
    message: 'Login action boundary is klaar. Echte login wordt in een volgende fase geactiveerd.',
  };
}
