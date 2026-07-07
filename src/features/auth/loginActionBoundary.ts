import type { LoginActionInput, LoginActionResult } from './loginActionTypes';

const loginActionReadyMessage =
  'Login action boundary is klaar. Echte login wordt in een volgende fase geactiveerd.';

export function prepareLoginAction(input: LoginActionInput): LoginActionResult {
  const email = input.email.trim();
  const password = input.password.trim();

  if (!email && !password) {
    return {
      status: 'failed',
      message: 'E-mail en wachtwoord zijn verplicht om de login action boundary voor te bereiden.',
      errorMessage: 'E-mail en wachtwoord ontbreken.',
    };
  }

  if (!email) {
    return {
      status: 'failed',
      message: 'E-mail is verplicht om de login action boundary voor te bereiden.',
      errorMessage: 'E-mail ontbreekt.',
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
    message: loginActionReadyMessage,
  };
}
